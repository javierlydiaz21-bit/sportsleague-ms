import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ResilientHttpService } from './resilient-http.service';
import { LeagueClientService } from './league-client.service';
import { TeamClientService } from './team-client.service';

@Module({
  imports: [HttpModule],
  providers: [ResilientHttpService, LeagueClientService, TeamClientService],
  exports: [LeagueClientService, TeamClientService],
})
export class ClientsModule {}
