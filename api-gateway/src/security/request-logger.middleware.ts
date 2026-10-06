import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { matchIdOf } from '../proxy/routes';

/**
 * Logging centralizado (documento 5.3 y 9.1): una linea JSON por solicitud con IP,
 * fecha y hora, metodo, endpoint, usuario autenticado, codigo de respuesta y tiempo
 * de respuesta. Si la solicitud es de un partido, se etiqueta con su match_id para
 * seguir el ciclo de vida del encuentro entre servicios. Tambien alimenta las
 * metricas de Prometheus. Ademas agrega cabeceras de seguridad basicas.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const path = req.originalUrl.split('?')[0];
      const service: string = res.locals.service ?? 'api-gateway';
      const user = res.locals.user;
      const entry = {
        timestamp: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info',
        service: 'api-gateway',
        target: service,
        ip: req.ip,
        method: req.method,
        endpoint: path,
        user: user ? `${user.sub}:${user.role}` : null,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        match_id: matchIdOf(path.replace(/^\/api\/v1/, '')) ?? null,
      };
      process.stdout.write(JSON.stringify(entry) + '\n');
      this.metrics.observe(req.method, service, res.statusCode, durationMs / 1000);
    });
    next();
  }
}
