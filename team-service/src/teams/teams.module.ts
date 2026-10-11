import { Module } from '@nestjs/common';
import { LeagueClientModule } from '../league-client/league-client.module';
import { CategoryEligibilityController, TeamsController, PlayersController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [LeagueClientModule],
  controllers: [TeamsController, PlayersController, CategoryEligibilityController],
  providers: [TeamsService],
})
export class TeamsModule {}
