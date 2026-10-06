import { All, Controller, NotFoundException, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { bearerToken } from '../auth/auth.guard';
import { AuthService, AuthUser } from '../auth/auth.service';
import { SERVICES, serviceUrl } from '../config/services';
import { AccessService } from './access.service';
import { matchRoute } from './routes';

const TIMEOUT_MS = 20_000;
const WITH_BODY = ['POST', 'PUT', 'PATCH'];

/**
 * Enrutamiento (documento 5.1): todo /api/v1/* que no atiende el propio gateway se
 * reenvia al microservicio correspondiente, despues de validar el token y los
 * permisos. Los clientes nunca llaman directamente a un microservicio.
 */
@ApiExcludeController()
@Controller()
export class ProxyController {
  constructor(
    private readonly auth: AuthService,
    private readonly access: AccessService,
  ) {}

  @All('*')
  async forward(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace(/^\/api\/v1/, '');
    const matched = matchRoute(req.method, path);
    if (!matched) throw new NotFoundException(`No existe la ruta ${req.method} /api/v1${path}`);
    res.locals.service = matched.route.service;

    // Autenticacion (5.2): si llega un token debe ser valido, aunque la ruta sea publica
    const token = bearerToken(req);
    const user: AuthUser | null = token ? await this.auth.verify(token) : null;
    res.locals.user = user;
    await this.access.authorize(matched, user, req.body);

    const target = serviceUrl(matched.route.service) + req.originalUrl;
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const headers: Record<string, string> = { 'x-request-id': requestId, 'x-forwarded-for': req.ip ?? '' };
    if (user) {
      headers['x-user-id'] = String(user.sub);
      headers['x-user-role'] = user.role;
    }
    let body: string | undefined;
    if (WITH_BODY.includes(req.method)) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(req.body ?? {});
    }

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(target, { method: req.method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      // Gestion de errores (4.4): 503 si el servicio dependiente no esta disponible
      throw new ServiceUnavailableException(
        `${SERVICES[matched.route.service].name} no disponible. Intente de nuevo en unos segundos.`,
      );
    }
    res.status(upstream.status);
    res.setHeader('x-request-id', requestId);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }
}
