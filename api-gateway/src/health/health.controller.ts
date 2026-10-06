import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SERVICES, ServiceKey, serviceUrl } from '../config/services';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Estado del gateway, su base de datos y Redis' })
  async health() {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const redis = this.redis.isConnected() ? 'ok' : 'down';
    return {
      service: 'api-gateway',
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
      service: 'api-gateway',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // GET /api/v1/health/services — estado de los ocho microservicios (9.3)
  @Get('health/services')
  @ApiOperation({ summary: 'Estado de todos los microservicios detras del gateway' })
  async services() {
    const keys = Object.keys(SERVICES) as ServiceKey[];
    const services = await Promise.all(
      keys.map(async (key) => {
        const started = Date.now();
        try {
          const res = await fetch(`${serviceUrl(key)}/api/v1/health`, { signal: AbortSignal.timeout(8000) });
          const body = (await res.json()) as Record<string, unknown>;
          return { key, name: SERVICES[key].name, ...body, latencyMs: Date.now() - started };
        } catch {
          return { key, name: SERVICES[key].name, status: 'down', latencyMs: Date.now() - started };
        }
      }),
    );
    return {
      gateway: await this.health(),
      services,
      timestamp: new Date().toISOString(),
    };
  }
}
