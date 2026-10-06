import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cache en Redis de las tablas de posiciones, consultadas con muchisima frecuencia
 * por espectadores y equipos (pila tecnologica del proyecto). Se invalida cada vez
 * que se recalcula la temporada. Si Redis no responde, se lee de la base de datos.
 */
@Injectable()
export class StandingsCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StandingsCacheService.name);
  private readonly ttlSeconds = 300;
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await this.client.connect();
      this.logger.log(`Cache de posiciones conectada a ${url}`);
    } catch (err) {
      this.logger.error(`No se pudo conectar a Redis: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  private key(seasonId: number) {
    return `statistics:standings:${seasonId}`;
  }

  async get<T>(seasonId: number): Promise<T | null> {
    if (!this.isConnected()) return null;
    try {
      const raw = await this.client.get(this.key(seasonId));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(seasonId: number, value: unknown): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.set(this.key(seasonId), JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch {
      /* la cache es opcional */
    }
  }

  async invalidate(seasonId: number): Promise<void> {
    if (!this.isConnected()) return;
    try {
      await this.client.del(this.key(seasonId));
    } catch {
      /* la cache es opcional */
    }
  }
}
