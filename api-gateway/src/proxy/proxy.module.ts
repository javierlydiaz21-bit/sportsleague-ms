import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { ProxyController } from './proxy.controller';

@Module({
  controllers: [ProxyController],
  providers: [AccessService],
})
export class ProxyModule {}
