import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationsService } from '../notifications/notifications.service';

export const FIXTURE_EVENTS_CHANNEL = 'sportsleague.fixture-events';
export const MATCH_EVENTS_CHANNEL = 'sportsleague.match-events';

/**
 * Consumidor ASINCRONO (documento 2.7 y 4.2), en su totalidad orientado a eventos:
 *  - fixture.published: horarios confirmados.
 *  - fixture.venue_changed: cambios de sede de ultimo momento.
 *  - match.completed: resultado final.
 *  - match.suspended: partido suspendido.
 */
@Injectable()
export class EventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsSubscriber.name);
  private client: Redis;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    try {
      await this.client.connect();
      await this.client.subscribe(FIXTURE_EVENTS_CHANNEL, MATCH_EVENTS_CHANNEL);
      this.logger.log(`Suscrito a "${FIXTURE_EVENTS_CHANNEL}" y "${MATCH_EVENTS_CHANNEL}"`);
      this.client.on('message', (_channel, message) => {
        this.queue = this.queue.then(() => this.handle(message));
      });
    } catch (err) {
      this.logger.error(`No se pudo conectar/suscribir a Redis: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  private async handle(raw: string) {
    let event: { type: string; data: any };
    try {
      event = JSON.parse(raw);
    } catch {
      this.logger.warn('Mensaje descartado: no es JSON valido');
      return;
    }

    try {
      switch (event.type) {
        case 'fixture.published':
          await this.notifications.onFixturePublished(event.data);
          break;
        case 'fixture.venue_changed':
          await this.notifications.onVenueChanged(event.data);
          break;
        case 'match.completed':
          await this.notifications.onMatchCompleted(event.data);
          break;
        case 'match.suspended':
          await this.notifications.onMatchSuspended(event.data);
          break;
        default:
          return; // match.event y otros: no generan avisos
      }
      this.logger.log(`${event.type} recibido: notificaciones generadas`);
    } catch (err) {
      this.logger.error(`Fallo al procesar ${event.type}: ${(err as Error).message}`);
    }
  }
}
