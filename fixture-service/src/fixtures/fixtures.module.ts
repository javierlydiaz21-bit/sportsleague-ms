import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';

@Module({
  imports: [ClientsModule],
  controllers: [FixturesController],
  providers: [FixturesService],
})
export class FixturesModule {}
