import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AssignmentsService } from '../assignments/assignments.service';

const FIXTURE_EVENTS_CHANNEL = 'sportsleague.fixture-events';

interface FixturePublished {
  seasonId: number;
  categoryId: number;
  zone: string;
  jornada: number;
  matches: Array<{ matchId: number; scheduledAt: string }>;
}

/**
 * Consumidor ASINCRONO (documento 2.4 y 4.2): escucha fixture.published y
 * asigna automaticamente arbitros a cada partido de la jornada publicada.
 */
@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private client: Redis;
  // Los eventos se procesan en orden, uno tras otro, para que el balanceo de
  // carga entre arbitros vea las asignaciones de la jornada anterior.
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    private readonly assignments: AssignmentsService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    try {
      await this.client.connect();
      await this.client.subscribe(FIXTURE_EVENTS_CHANNEL);
      this.logger.log(`Suscrito al canal "${FIXTURE_EVENTS_CHANNEL}"`);
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
    let event: { type: string; data: FixturePublished };
    try {
      event = JSON.parse(raw);
    } catch {
      this.logger.warn('Mensaje descartado: no es JSON valido');
      return;
    }
    if (event.type !== 'fixture.published') return;

    const { seasonId, categoryId, zone, jornada, matches } = event.data;
    this.logger.log(
      `fixture.published recibido: temporada ${seasonId}, jornada ${jornada}, ${matches.length} partido(s)`,
    );

    const busy = new Set<number>();
    for (const match of matches) {
      try {
        const result = await this.assignments.autoAssign(match, categoryId, zone, busy);
        if (result.assignment) {
          busy.add(result.assignment.refereeId);
          if (result.created) {
            this.logger.log(`Partido ${match.matchId}: arbitro ${result.assignment.refereeId} asignado automaticamente`);
          }
        } else {
          this.logger.warn(
            `Partido ${match.matchId}: sin arbitro disponible (zona ${zone}, categoria ${categoryId}, dia ${result.day})`,
          );
        }
      } catch (err) {
        this.logger.error(`Fallo al asignar el partido ${match.matchId}: ${(err as Error).message}`);
      }
    }
  }
}
