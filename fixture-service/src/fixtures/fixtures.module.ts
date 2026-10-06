import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';

@Module({
  imports: [ClientsModule],
  controllers: [FixturesController],
  providers: [FixturesService, RedisSubscriberService],
})
export class FixturesModule {}
