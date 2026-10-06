import { Global, Module } from '@nestjs/common';
import { MatchEventsPublisher } from './match-events.publisher';

@Global()
@Module({
  providers: [MatchEventsPublisher],
  exports: [MatchEventsPublisher],
})
export class RedisModule {}
