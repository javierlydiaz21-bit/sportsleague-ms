import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { RedisService } from '../redis/redis.service';

const WINDOW_SECONDS = 60;
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Rate limiting por IP (documento 5.3): ventana fija de un minuto, con un limite
 * mas estricto para escrituras (por ejemplo, registrar eventos en vivo) que para
 * lecturas publicas (marcador, posiciones). Los contadores viven en Redis para
 * que todas las instancias del gateway compartan el mismo limite; si Redis no
 * responde, se cuenta en memoria.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly readLimit: number;
  private readonly writeLimit: number;
  private readonly memory = new Map<string, number>();

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.readLimit = Number(config.get('RATE_LIMIT_READ', 600));
    this.writeLimit = Number(config.get('RATE_LIMIT_WRITE', 120));
  }

  /** Cuenta la peticion y devuelve cuantas lleva la IP en la ventana actual. */
  async hit(key: string): Promise<number> {
    if (this.redis.isConnected()) {
      try {
        const count = await this.redis.client.incr(key);
        if (count === 1) await this.redis.client.expire(key, WINDOW_SECONDS);
        return count;
      } catch {
        /* se cae a memoria */
      }
    }
    if (this.memory.size > 10_000) this.memory.clear();
    const count = (this.memory.get(key) ?? 0) + 1;
    this.memory.set(key, count);
    return count;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const isRead = READ_METHODS.includes(req.method);
    const limit = isRead ? this.readLimit : this.writeLimit;
    const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const count = await this.hit(`ratelimit:${isRead ? 'read' : 'write'}:${req.ip}:${window}`);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
    if (count > limit) {
      const retryAfter = WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        statusCode: 429,
        message: `Demasiadas solicitudes. Intente de nuevo en ${retryAfter} s.`,
      });
      return;
    }
    next();
  }
}
