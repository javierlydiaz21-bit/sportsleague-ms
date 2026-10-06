import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthService, AuthUser } from './auth.service';

export const ROLES_KEY = 'roles';
/** Restringe un endpoint del gateway a ciertos roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Extrae el token del header Authorization: Bearer <token>. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Exige un access token valido y, si el endpoint lo indica, uno de los roles. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException('Falta el token de acceso (Authorization: Bearer)');
    const user = await this.auth.verify(token);
    req.user = user;
    res.locals.user = user;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException(`Requiere el rol ${roles.join(' o ')}`);
    }
    return true;
  }
}
