import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { EventsSubscriber } from '../redis/events.subscriber';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [ClientsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EventsSubscriber],
  exports: [EventsSubscriber],
})
export class NotificationsModule {}
