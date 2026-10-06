import { Controller, Get, Global, Header, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

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
