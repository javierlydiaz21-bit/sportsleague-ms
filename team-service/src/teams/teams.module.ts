import { Module } from '@nestjs/common';
import { LeagueClientModule } from '../league-client/league-client.module';
import { TeamsController, PlayersController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [LeagueClientModule],
  controllers: [TeamsController, PlayersController],
  providers: [TeamsService],
})
export class TeamsModule {}
