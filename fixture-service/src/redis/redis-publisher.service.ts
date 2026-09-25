import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const FIXTURE_EVENTS_CHANNEL = 'sportsleague.fixture-events';

export interface FixturePublishedPayload {
  seasonId: number;
  categoryId: number;
  zone: string;
  jornada: number;
  matches: Array<{
    matchId: number;
    homeTeam: number;
    awayTeam: number;
    venue: string;
    scheduledAt: string;
  }>;
}

/**
 * Publicador de eventos ASINCRONOS sobre Redis Pub/Sub (documento, 2.3 y 4.2).
 * Evento: fixture.published, uno por cada jornada confirmada.
 * Consumidores segun el documento: Referee Service y Notification Service.
 */
@Injectable()
export class RedisPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    try {
      await this.client.connect();
      this.logger.log(`Conectado a Redis Pub/Sub en ${url}`);
    } catch (err) {
      this.logger.error(`No se pudo conectar a Redis: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async publishFixturePublished(payload: FixturePublishedPayload): Promise<void> {
    const envelope = { type: 'fixture.published', emittedAt: new Date().toISOString(), data: payload };
    try {
      await this.client.publish(FIXTURE_EVENTS_CHANNEL, JSON.stringify(envelope));
      this.logger.log(
        `Evento publicado: fixture.published (temporada ${payload.seasonId}, jornada ${payload.jornada}, ${payload.matches.length} partido(s))`,
      );
    } catch (err) {
      // Prioridad a la baja latencia (documento, 4.2): el calendario ya quedo
      // guardado; un evento perdido se corrige despues (consistencia eventual).
      this.logger.error(`Fallo al publicar fixture.published: ${(err as Error).message}`);
    }
  }
}
