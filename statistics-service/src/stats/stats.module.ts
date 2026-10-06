import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { EventsSubscriber } from '../redis/events.subscriber';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [ClientsModule],
  controllers: [StatsController],
  providers: [StatsService, EventsSubscriber],
})
export class StatsModule {}
