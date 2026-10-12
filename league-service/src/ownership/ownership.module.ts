import { Module } from '@nestjs/common';
import { OwnershipController } from './ownership.controller';

@Module({
  controllers: [OwnershipController],
})
export class OwnershipModule {}
