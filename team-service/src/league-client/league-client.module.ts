import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LeagueClientService } from './league-client.service';

@Module({
  imports: [HttpModule],
  providers: [LeagueClientService],
  exports: [LeagueClientService],
})
export class LeagueClientModule {}
