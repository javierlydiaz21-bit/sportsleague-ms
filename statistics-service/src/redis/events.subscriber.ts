import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StatsService } from '../stats/stats.service';

export const FIXTURE_EVENTS_CHANNEL = 'sportsleague.fixture-events';
export const MATCH_EVENTS_CHANNEL = 'sportsleague.match-events';

const RETRY_DELAY_MS = 15_000;
const MAX_RETRIES = 3;

/**
 * Consumidor ASINCRONO (documento 2.6 y 4.2):
 *  - match.completed: guarda el acta y recalcula posiciones, goleadores y tarjetas.
 *  - match.event: se registra en el log; las estadisticas oficiales salen del acta.
 *  - fixture.published: agrega los equipos de la temporada a la tabla con 0 puntos.
 * Si el League Service no responde, el acta ya quedo guardada y el recalculo se
 * reintenta mas tarde (consistencia eventual).
 */
@Injectable()
export class EventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsSubscriber.name);
  private client: Redis;
  // Las actas se procesan en orden, una tras otra, para no recalcular la misma
  // temporada dos veces a la vez.
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    private readonly stats: StatsService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    try {
      await this.client.connect();
      await this.client.subscribe(MATCH_EVENTS_CHANNEL, FIXTURE_EVENTS_CHANNEL);
      this.logger.log(`Suscrito a "${MATCH_EVENTS_CHANNEL}" y "${FIXTURE_EVENTS_CHANNEL}"`);
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
        case 'match.completed': {
          const r = await this.stats.processMatchCompleted(event.data);
          this.logger.log(
            `match.completed${event.data.correction ? ' (acta corregida)' : ''}: partido ${event.data.matchId}, ` +
              `temporada ${r.seasonId} recalculada (${r.matches} acta(s), ${r.teams} equipo(s))`,
          );
          break;
        }
        case 'match.event':
          this.logger.log(
            `match.event: ${event.data.type} min ${event.data.minute} en el partido ${event.data.matchId} ` +
              `(${event.data.score.home}-${event.data.score.away})`,
          );
          break;
        case 'fixture.published': {
          const teams = new Set<number>(
            event.data.matches.flatMap((m: { homeTeam: number; awayTeam: number }) => [m.homeTeam, m.awayTeam]),
          );
          await this.stats.registerSeasonTeams(event.data.seasonId, [...teams]);
          break;
        }
      }
    } catch (err) {
      this.logger.error(`Fallo al procesar ${event.type}: ${(err as Error).message}`);
      if (event.type === 'match.completed') this.retry(event.data.seasonId, 1);
    }
  }

  private retry(seasonId: number, attempt: number) {
    if (attempt > MAX_RETRIES) {
      this.logger.error(
        `Temporada ${seasonId} sin recalcular tras ${MAX_RETRIES} reintentos. ` +
          `Use POST /api/v1/standings/${seasonId}/recalculate cuando el League Service responda.`,
      );
      return;
    }
    setTimeout(() => {
      this.queue = this.queue.then(async () => {
        try {
          await this.stats.recalculateSeason(seasonId);
          this.logger.log(`Temporada ${seasonId} recalculada en el reintento ${attempt}`);
        } catch (err) {
          this.logger.warn(`Reintento ${attempt} de la temporada ${seasonId} fallido: ${(err as Error).message}`);
          this.retry(seasonId, attempt + 1);
        }
      });
    }, RETRY_DELAY_MS).unref();
  }
}
