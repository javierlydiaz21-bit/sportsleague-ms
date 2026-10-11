import { Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Token interno entre servicios (seguridad, documento 10): este microservicio solo atiende
 * llamadas del API Gateway y de los demas microservicios. Cada llamada trae la cabecera
 * x-internal-token con el secreto compartido INTERNAL_TOKEN, una variable de entorno que no
 * esta en el codigo ni en el frontend y que es distinta del JWT de los usuarios. Asi, una
 * llamada directa a la URL publica del servicio no puede saltarse los controles del gateway.
 *
 * INTERNAL_AUTH permite activarlo por pasos sin cortar la comunicacion:
 *   enforce  rechaza con 401 lo que no traiga el token correcto (y todo, si falta INTERNAL_TOKEN)
 *   report   deja pasar, pero registra cada llamada sin el token correcto
 *   off      sin control
 * Sin INTERNAL_AUTH: enforce si hay INTERNAL_TOKEN; report si no lo hay.
 */
export const INTERNAL_HEADER = 'x-internal-token';
export type InternalAuthMode = 'enforce' | 'report' | 'off';

/** Rutas abiertas: estado del servicio (health checks), metricas y documentacion. */
const OPEN = [/^\/api\/v1\/(health|status|metrics)(\/|$)/, /^\/docs(\/|$)/, /^\/openapi\.json$/];

/** Cabecera que este servicio agrega a sus llamadas a otros microservicios. */
export function internalHeaders(): Record<string, string> {
  return { [INTERNAL_HEADER]: process.env.INTERNAL_TOKEN ?? '' };
}

/** Comparacion en tiempo constante, para no revelar el token por diferencias de tiempo. */
export function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function internalAuthMode(token: string, mode?: string): InternalAuthMode {
  if (mode === 'enforce' || mode === 'report' || mode === 'off') return mode;
  return token ? 'enforce' : 'report';
}

export function internalAuth(token = process.env.INTERNAL_TOKEN ?? '', configured = process.env.INTERNAL_AUTH) {
  const mode = internalAuthMode(token, configured);
  const logger = new Logger('InternalAuth');
  if (mode === 'enforce' && !token) logger.error('INTERNAL_AUTH=enforce sin INTERNAL_TOKEN: se rechazan todas las llamadas');
  logger.log(`Token interno entre servicios: modo ${mode}`);

  return (req: Request, res: Response, next: NextFunction) => {
    if (mode === 'off' || req.method === 'OPTIONS' || OPEN.some((r) => r.test(req.path))) return next();
    const given = req.get(INTERNAL_HEADER) ?? '';
    if (token && given && sameToken(given, token)) return next();
    if (mode === 'report') {
      logger.warn(`Llamada sin token interno valido: ${req.method} ${req.originalUrl}`);
      return next();
    }
    res.status(401).json({
      statusCode: 401,
      message: 'Llamada directa no autorizada: este servicio solo atiende al API Gateway',
      error: 'Unauthorized',
    });
  };
}
