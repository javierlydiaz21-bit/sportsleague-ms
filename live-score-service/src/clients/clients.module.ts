import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ResilientHttpService } from './resilient-http.service';
import { FixtureClientService } from './fixture-client.service';

@Module({
  imports: [HttpModule],
  providers: [ResilientHttpService, FixtureClientService],
  exports: [FixtureClientService],
})
export class ClientsModule {}
