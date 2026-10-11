import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';

@Module({
  imports: [ClientsModule],
  controllers: [LeaguesController],
  providers: [LeaguesService],
})
export class LeaguesModule {}
