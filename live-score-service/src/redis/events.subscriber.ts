import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subscription } from 'rxjs';
import { LiveGateway } from '../live/live.gateway';
import { LiveService } from '../live/live.service';
import { MATCH_EVENTS_CHANNEL, MatchEnvelope, MatchEventsPublisher } from './match-events.publisher';

export const FIXTURE_EVENTS_CHANNEL = 'sportsleague.fixture-events';

/**
 * Consumidor ASINCRONO:
 *  - fixture.published: copia local de los partidos programados (3.8).
 *  - eventos de partido: cada instancia del Live Score Service los recibe por Redis
 *    y los difunde por WebSocket a sus espectadores. Asi el servicio escala
 *    horizontalmente: el evento registrado en una instancia llega a todas.
 */
@Injectable()
export class EventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsSubscriber.name);
  private client: Redis;
  private localSub: Subscription;

  constructor(
    private readonly config: ConfigService,
    private readonly publisher: MatchEventsPublisher,
    private readonly gateway: LiveGateway,
    private readonly live: LiveService,
  ) {}

  async onModuleInit() {
    this.localSub = this.publisher.local$.subscribe((envelope) => this.gateway.broadcast(envelope));

    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    try {
      await this.client.connect();
      await this.client.subscribe(FIXTURE_EVENTS_CHANNEL, MATCH_EVENTS_CHANNEL);
      this.logger.log(`Suscrito a "${FIXTURE_EVENTS_CHANNEL}" y "${MATCH_EVENTS_CHANNEL}"`);
      this.client.on('message', (channel, message) => this.handle(channel, message));
    } catch (err) {
      this.logger.error(`No se pudo conectar/suscribir a Redis: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    this.localSub?.unsubscribe();
    await this.client?.quit();
  }

  private async handle(channel: string, raw: string) {
    let event: { type: string; data: any };
    try {
      event = JSON.parse(raw);
    } catch {
      this.logger.warn('Mensaje descartado: no es JSON valido');
      return;
    }

    if (channel === MATCH_EVENTS_CHANNEL) {
      await this.gateway.broadcast(event as MatchEnvelope);
      return;
    }
    if (event.type !== 'fixture.published') return;
    try {
      await this.live.syncFromFixture(event.data);
      this.logger.log(
        `fixture.published recibido: temporada ${event.data.seasonId}, jornada ${event.data.jornada}, ${event.data.matches.length} partido(s)`,
      );
    } catch (err) {
      this.logger.error(`Fallo al procesar fixture.published: ${(err as Error).message}`);
    }
  }
}
