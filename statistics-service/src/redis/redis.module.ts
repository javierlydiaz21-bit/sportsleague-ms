import { Global, Module } from '@nestjs/common';
import { StandingsCacheService } from './standings-cache.service';

@Global()
@Module({
  providers: [StandingsCacheService],
  exports: [StandingsCacheService],
})
export class RedisModule {}
