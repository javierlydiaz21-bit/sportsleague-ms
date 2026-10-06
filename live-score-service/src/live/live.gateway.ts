import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import { MatchEnvelope } from '../redis/match-events.publisher';
import { LiveService } from './live.service';

// Origenes permitidos para el WebSocket (documento 7.2: WS_ALLOWED_ORIGINS)
function wsOrigins(): string[] | boolean {
  const list = (process.env.WS_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return list.length ? list : true;
}

const room = (matchId: number) => `match:${matchId}`;

/**
 * Canal WebSocket /live-scores (documento 2.5): el espectador se suscribe a un
 * partido y recibe el marcador actualizado sin hacer polling.
 *   cliente -> 'subscribe' { matchId }   servidor -> 'snapshot' (estado completo)
 *   servidor -> 'update' { type, live }  en cada gol, tarjeta, cierre o suspension
 */
@WebSocketGateway({ namespace: '/live-scores', cors: { origin: wsOrigins(), credentials: true } })
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);
  @WebSocketServer() server: Namespace;

  constructor(
    private readonly live: LiveService,
    private readonly metrics: MetricsService,
  ) {}

  handleConnection() {
    this.metrics.wsConnections.inc();
  }

  handleDisconnect() {
    this.metrics.wsConnections.dec();
  }

  viewers(matchId: number): number {
    return this.server.adapter.rooms.get(room(matchId))?.size ?? 0;
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { matchId?: number }) {
    const matchId = Number(body?.matchId);
    if (!Number.isInteger(matchId) || matchId < 1) {
      throw new WsException('matchId invalido');
    }
    for (const r of client.rooms) {
      if (r.startsWith('match:')) await client.leave(r);
    }
    await client.join(room(matchId));
    try {
      const live = await this.live.getLive(matchId);
      const viewers = this.viewers(matchId);
      await this.live.recordViewers(matchId, viewers);
      return { event: 'snapshot', data: { ...live, viewers } };
    } catch (err) {
      await client.leave(room(matchId));
      throw new WsException((err as Error).message);
    }
  }

  /** Difunde el estado del partido a los espectadores suscritos a este partido. */
  async broadcast(envelope: MatchEnvelope) {
    const matchId = envelope.data.matchId;
    const viewers = this.viewers(matchId);
    if (viewers === 0) return;
    try {
      const live = await this.live.getLive(matchId);
      this.server.to(room(matchId)).emit('update', { type: envelope.type, live: { ...live, viewers } });
      const registeredAt = envelope.data.registeredAt;
      if (typeof registeredAt === 'string') {
        this.metrics.liveLatency.observe((Date.now() - Date.parse(registeredAt)) / 1000);
      }
    } catch (err) {
      this.logger.error(`No se pudo difundir ${envelope.type} del partido ${matchId}: ${(err as Error).message}`);
    }
  }
}
