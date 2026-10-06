import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { EventsSubscriber } from '../redis/events.subscriber';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriber: EventsSubscriber,
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
    const redis = this.subscriber.isConnected() ? 'ok' : 'down';
    return {
      service: 'notification-service',
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
      service: 'notification-service',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
