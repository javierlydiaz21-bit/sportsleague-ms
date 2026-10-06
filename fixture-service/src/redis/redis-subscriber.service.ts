import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { FixturesService } from '../fixtures/fixtures.service';

export const MATCH_EVENTS_CHANNEL = 'sportsleague.match-events';

/**
 * Consumidor ASINCRONO de los eventos del Live Score Service (match.event,
 * match.completed y match.suspended) para que el calendario muestre el estado
 * real de cada partido (consistencia eventual, documento 1.5 y 3.8).
 */
@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private client: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly fixtures: FixturesService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    try {
      await this.client.connect();
      await this.client.subscribe(MATCH_EVENTS_CHANNEL);
      this.logger.log(`Suscrito al canal "${MATCH_EVENTS_CHANNEL}"`);
      this.client.on('message', (_channel, message) => this.handle(message));
    } catch (err) {
      this.logger.error(`No se pudo conectar/suscribir a Redis: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  private async handle(raw: string) {
    let event: { type: string; data: { matchId: number } };
    try {
      event = JSON.parse(raw);
    } catch {
      this.logger.warn('Mensaje descartado: no es JSON valido');
      return;
    }
    try {
      const result = await this.fixtures.applyLiveEvent(event.type, event.data?.matchId);
      if (result && result.count > 0) {
        this.logger.log(`${event.type} recibido: estado del partido ${event.data.matchId} actualizado`);
      }
    } catch (err) {
      this.logger.error(`Fallo al procesar ${event.type}: ${(err as Error).message}`);
    }
  }
}
