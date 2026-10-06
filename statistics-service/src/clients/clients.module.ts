import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ResilientHttpService } from './resilient-http.service';
import { LeagueClientService } from './league-client.service';

@Module({
  imports: [HttpModule],
  providers: [ResilientHttpService, LeagueClientService],
  exports: [LeagueClientService],
})
export class ClientsModule {}
