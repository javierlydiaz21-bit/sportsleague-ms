import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LeaguesModule } from './leagues/leagues.module';
import { SeasonsModule } from './seasons/seasons.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LeaguesModule,
    SeasonsModule,
    CategoriesModule,
    HealthModule,
  ],
})
export class AppModule {}
