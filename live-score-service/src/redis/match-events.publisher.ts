import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject } from 'rxjs';

export const MATCH_EVENTS_CHANNEL = 'sportsleague.match-events';

export type MatchEventType = 'match.event' | 'match.event_annulled' | 'match.completed' | 'match.suspended';

export interface MatchEnvelope {
  type: MatchEventType;
  emittedAt: string;
  data: { matchId: number; [key: string]: unknown };
}

/**
 * Publicador de eventos ASINCRONOS sobre Redis Pub/Sub (documento 2.5 y 4.2):
 *  - match.event: cada gol, tarjeta o sustitucion registrada en vivo.
 *  - match.completed: el acta del partido al finalizar (o corregida despues).
 *  - match.suspended y match.event_annulled: cambios del marcador en vivo.
 * Si Redis no esta disponible, el mensaje se entrega solo a esta instancia
 * (local$) para que los espectadores conectados aqui sigan viendo el marcador.
 */
@Injectable()
export class MatchEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchEventsPublisher.name);
  private client: Redis;
  readonly local$ = new Subject<MatchEnvelope>();

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

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  async publish(type: MatchEventType, data: MatchEnvelope['data']): Promise<void> {
    const envelope: MatchEnvelope = { type, emittedAt: new Date().toISOString(), data };
    try {
      await this.client.publish(MATCH_EVENTS_CHANNEL, JSON.stringify(envelope));
      this.logger.log(`Evento publicado: ${type} (partido ${data.matchId})`);
    } catch (err) {
      // Prioridad a la baja latencia (4.2): el evento ya quedo guardado en la
      // Live Score DB; el acta se puede reenviar despues (consistencia eventual).
      this.logger.error(`Fallo al publicar ${type}: ${(err as Error).message}`);
      this.local$.next(envelope);
    }
  }
}
