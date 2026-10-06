import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { EventsSubscriber } from '../redis/events.subscriber';
import { LiveController } from './live.controller';
import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';

@Module({
  imports: [ClientsModule],
  controllers: [LiveController],
  providers: [LiveService, LiveGateway, EventsSubscriber],
})
export class LiveModule {}
