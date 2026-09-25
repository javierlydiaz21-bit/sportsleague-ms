import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RefereesModule } from './referees/referees.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RefereesModule,
    AssignmentsModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
