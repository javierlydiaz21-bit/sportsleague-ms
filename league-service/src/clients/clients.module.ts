import { Module } from '@nestjs/common';
import { FixtureClientService } from './fixture-client.service';

@Module({
  providers: [FixtureClientService],
  exports: [FixtureClientService],
})
export class ClientsModule {}
