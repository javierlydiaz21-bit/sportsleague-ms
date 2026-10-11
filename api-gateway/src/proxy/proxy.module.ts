import { Module } from '@nestjs/common';
import { IdempotencyService } from '../security/idempotency.service';
import { AccessService } from './access.service';
import { ProxyController } from './proxy.controller';

@Module({
  controllers: [ProxyController],
  providers: [AccessService, IdempotencyService],
})
export class ProxyModule {}
