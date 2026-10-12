import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

// Administrador de la plataforma (ADMIN_EMAIL por defecto) y otro organizador
const ADMIN: any = { sub: 1, email: 'admin@sportsleague.co', name: 'Organizador', role: 'organizador', refereeId: null };
const ORG: any = { sub: 9, email: 'otra@liga.co', name: 'Otra', role: 'organizador', refereeId: null };

function build() {
  const users: any[] = [];
  const tokens: any[] = [];
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }) => users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null),
      create: jest.fn(async ({ data }) => {
        const u = { id: users.length + 1, createdAt: new Date(), ...data };
        users.push(u);
        return u;
      }),
      findMany: jest.fn(async () => users),
    },
    refreshToken: {
      create: jest.fn(async ({ data }) => {
        const t = { id: tokens.length + 1, revokedAt: null, ...data };
        tokens.push(t);
        return t;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const t = tokens.find((x) => x.tokenHash === where.tokenHash);
        return t ? { ...t, user: users.find((u) => u.id === t.userId) } : null;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(tokens.find((t) => t.id === where.id), data)),
      updateMany: jest.fn(async ({ where, data }) => {
        tokens
          .filter((t) => (where.userId ? t.userId === where.userId : t.tokenHash === where.tokenHash) && t.revokedAt === null)
          .forEach((t) => Object.assign(t, data));
      }),
    },
  };
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } });
  const config: any = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
  // Propiedad: el arbitro 3 esta certificado en la categoria 5, de una liga del organizador 9
  const ownership: any = {
    refereeCategories: jest.fn(async () => [5]),
    categories: jest.fn(async () => [{ categoryId: 5, leagueId: 2, ownerId: 9 }]),
    assertOwnerOfAll: jest.fn((owners: any[], user: any) => {
      if (owners.some((o) => o.ownerId !== user.sub)) throw new ForbiddenException('Esta liga es de otro organizador');
    }),
  };
  return { service: new AuthService(prisma, jwt, config, ownership), users, tokens, ownership };
}

describe('AuthService', () => {
  it('crea el organizador inicial con la contrasena cifrada con bcrypt', async () => {
    const { service, users } = build();
    await service.onModuleInit();
    expect(users[0]).toMatchObject({ email: 'admin@sportsleague.co', role: 'organizador' });
    expect(users[0].passwordHash).not.toBe('admin12345');
    expect(await bcrypt.compare('admin12345', users[0].passwordHash)).toBe(true);
  });

  it('el registro publico crea siempre un espectador y devuelve los dos tokens', async () => {
    const { service } = build();
    const r = await service.register({ name: 'Ana', email: 'ANA@correo.com', password: 'clave-segura' });
    expect(r.user).toMatchObject({ email: 'ana@correo.com', role: 'espectador' });
    expect(r.accessToken.split('.')).toHaveLength(3);
    expect(r.refreshToken.length).toBeGreaterThan(40);
    expect(r.user).not.toHaveProperty('passwordHash');
  });

  it('no permite dos cuentas con el mismo correo', async () => {
    const { service } = build();
    await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'clave-segura' });
    await expect(service.register({ name: 'Ana 2', email: 'ana@correo.com', password: 'otra-clave' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('login: el token lleva el rol y se verifica; la contrasena erronea responde 401', async () => {
    const { service } = build();
    await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'clave-segura' });
    const r = await service.login({ email: 'ana@correo.com', password: 'clave-segura' });
    const payload = await service.verify(r.accessToken);
    expect(payload).toMatchObject({ email: 'ana@correo.com', role: 'espectador' });
    await expect(service.login({ email: 'ana@correo.com', password: 'equivocada' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.verify('token.falso.x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rota el token: el anterior ya no sirve y reutilizarlo cierra todas las sesiones', async () => {
    const { service, tokens } = build();
    const first = await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'clave-segura' });
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toThrow('ya utilizado');
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('una cuenta de arbitro necesita su refereeId', async () => {
    const { service } = build();
    await expect(
      service.createUser({ name: 'Arbitro', email: 'arb@correo.com', password: 'clave-segura', role: 'arbitro' as any }, ORG),
    ).rejects.toBeInstanceOf(BadRequestException);
    const u = await service.createUser({
      name: 'Arbitro',
      email: 'arb@correo.com',
      password: 'clave-segura',
      role: 'arbitro' as any,
      refereeId: 3,
    }, ORG);
    expect(u).toMatchObject({ role: 'arbitro', refereeId: 3 });
  });

  it('la cuenta de un arbitro solo la crea el propietario de las ligas en las que esta certificado (403)', async () => {
    const { service, users } = build();
    const dto = { name: 'Arbitro', email: 'arb2@correo.com', password: 'clave-segura', role: 'arbitro' as any, refereeId: 3 };
    await expect(service.createUser(dto, { ...ORG, sub: 10 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(users).toHaveLength(0);
  });

  it('solo el administrador de la plataforma crea cuentas de organizador (403)', async () => {
    const { service } = build();
    const dto = { name: 'Nueva', email: 'nueva@liga.co', password: 'clave-segura', role: 'organizador' as any };
    await expect(service.createUser(dto, ORG)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createUser(dto, ADMIN)).resolves.toMatchObject({ role: 'organizador' });
  });

  it('el administrador ve todas las cuentas; otro organizador solo las de arbitros', async () => {
    const { service } = build();
    const prisma = (service as any).prisma;
    await service.listUsers(ADMIN);
    expect(prisma.user.findMany).toHaveBeenLastCalledWith({ orderBy: { id: 'asc' } });
    await service.listUsers(ORG);
    expect(prisma.user.findMany).toHaveBeenLastCalledWith({ where: { role: 'arbitro' }, orderBy: { id: 'asc' } });
  });
});
