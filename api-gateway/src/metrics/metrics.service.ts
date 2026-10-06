import { Controller, Get, Global, Header, Injectable, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Metricas Prometheus del gateway (documento 9.2): solicitudes por segundo, tiempo
 * de respuesta y errores por servicio destino, mas CPU y memoria del proceso.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly requests = new Counter({
    name: 'sportsleague_gateway_requests_total',
    help: 'Solicitudes atendidas por el API Gateway',
    labelNames: ['method', 'target', 'status'],
    registers: [this.registry],
  });

  private readonly duration = new Histogram({
    name: 'sportsleague_gateway_request_duration_seconds',
    help: 'Tiempo de respuesta del API Gateway',
    labelNames: ['target'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'api-gateway' });
    collectDefaultMetrics({ register: this.registry });
  }

  observe(method: string, target: string, status: number, seconds: number) {
    this.requests.inc({ method, target, status: String(status) });
    this.duration.observe({ target }, seconds);
  }
}

@ApiTags('health')
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  // GET /api/v1/metrics — lo consulta Prometheus (documento 9.5)
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Metricas en formato Prometheus' })
  metricsText() {
    return this.metrics.registry.metrics();
  }
}

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
