import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, LoginDto, RegisterDto } from './dto/auth.dto';

/** Datos del usuario que viajan en el access token. */
export interface AuthUser {
  sub: number;
  email: string;
  name: string;
  role: Role;
  refereeId: number | null;
}

const BCRYPT_ROUNDS = 10;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, refereeId: u.refereeId, createdAt: u.createdAt };
}

/**
 * Autenticacion centralizada (documento 5.2 y 10.1):
 *  - Al iniciar sesion se valida la contrasena (hash bcrypt, 10.3) y se emiten un
 *    access token JWT de corta duracion y un refresh token de mayor duracion.
 *  - El refresh token se guarda como hash y rota en cada uso: si se reutiliza uno
 *    ya usado (posible robo), se cierran todas las sesiones del usuario.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.refreshDays = Number(this.config.get('REFRESH_TOKEN_DAYS', 7));
  }

  /** Crea el organizador inicial si no existe (ADMIN_EMAIL / ADMIN_PASSWORD). */
  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL', 'admin@sportsleague.co').toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD', 'admin12345');
    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) return;
      await this.prisma.user.create({
        data: {
          email,
          name: 'Organizador',
          role: Role.organizador,
          passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        },
      });
      this.logger.log(`Organizador inicial creado: ${email}`);
      if (!this.config.get('ADMIN_PASSWORD')) {
        this.logger.warn('ADMIN_PASSWORD no esta definida: se uso la contrasena por defecto. Cambiela en produccion.');
      }
    } catch (err) {
      this.logger.error(`No se pudo crear el organizador inicial: ${(err as Error).message}`);
    }
  }

  // POST /auth/register: registro publico, siempre como espectador
  async register(dto: RegisterDto) {
    const user = await this.createAccount({ ...dto, role: Role.espectador });
    return this.issueTokens(user);
  }

  // POST /auth/users: el organizador crea cuentas (por ejemplo, la de un arbitro)
  async createUser(dto: CreateUserDto) {
    if (dto.role === Role.arbitro && !dto.refereeId) {
      throw new BadRequestException('Una cuenta de arbitro necesita refereeId (su id en el Referee Service)');
    }
    return publicUser(await this.createAccount(dto));
  }

  private async createAccount(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException(`Ya existe una cuenta con el correo ${email}`);
    }
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: dto.role,
        refereeId: dto.role === Role.arbitro ? dto.refereeId : null,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });
  }

  // POST /auth/login
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    // Mismo mensaje si el correo no existe o la contrasena no coincide
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Correo o contrasena incorrectos');
    }
    return this.issueTokens(user);
  }

  // POST /auth/refresh: entrega un access token nuevo y rota el refresh token
  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('Refresh token invalido');
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Refresh token reutilizado: sesiones del usuario ${stored.userId} cerradas`);
      throw new UnauthorizedException('Refresh token ya utilizado. Inicie sesion de nuevo.');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Refresh token vencido. Inicie sesion de nuevo.');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.user);
  }

  // POST /auth/logout
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('El usuario ya no existe');
    return publicUser(user);
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({ orderBy: { id: 'asc' } });
    return users.map(publicUser);
  }

  /** Verifica firma y expiracion del access token (5.2). */
  async verify(token: string): Promise<AuthUser> {
    try {
      return await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Token invalido o vencido');
    }
  }

  private async issueTokens(user: User) {
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      refereeId: user.refereeId,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshDays * 24 * 3600 * 1000),
      },
    });
    return { accessToken, refreshToken, user: publicUser(user) };
  }
}
