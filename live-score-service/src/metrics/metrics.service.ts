import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Metricas Prometheus (documento 9.2), con los dos indicadores propios del dominio:
 *  - eventos de partido registrados (Prometheus calcula el ritmo por minuto con rate()).
 *  - latencia del marcador en vivo: desde que el arbitro registra el evento hasta que
 *    se difunde por WebSocket a los espectadores.
 * Mas las metricas de proceso (CPU y memoria).
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly matchEvents = new Counter({
    name: 'sportsleague_match_events_total',
    help: 'Eventos de partido registrados en vivo (goles, tarjetas, sustituciones)',
    labelNames: ['type', 'season', 'category'],
    registers: [this.registry],
  });

  readonly liveLatency = new Histogram({
    name: 'sportsleague_live_update_latency_seconds',
    help: 'Segundos desde que se registra un evento hasta que se difunde por WebSocket',
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly wsConnections = new Gauge({
    name: 'sportsleague_ws_connections',
    help: 'Espectadores conectados por WebSocket a esta instancia',
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'live-score-service' });
    collectDefaultMetrics({ register: this.registry });
  }
}
