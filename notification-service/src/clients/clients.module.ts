import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ResilientHttpService } from './resilient-http.service';
import { TeamClientService } from './team-client.service';

@Module({
  imports: [HttpModule],
  providers: [ResilientHttpService, TeamClientService],
  exports: [TeamClientService],
})
export class ClientsModule {}
