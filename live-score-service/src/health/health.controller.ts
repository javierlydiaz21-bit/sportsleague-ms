import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MatchEventsPublisher } from '../redis/match-events.publisher';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MatchEventsPublisher,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Estado del servicio, su base de datos y el bus de eventos Redis' })
  async health() {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const redis = this.publisher.isConnected() ? 'ok' : 'down';
    return {
      service: 'live-score-service',
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Informacion extendida del proceso' })
  status() {
    return {
      service: 'live-score-service',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
