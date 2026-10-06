import { Module } from '@nestjs/common';
import { EtlService } from './etl.service';
import { ReplicasService } from './replicas.service';

@Module({
  providers: [ReplicasService, EtlService],
  exports: [EtlService],
})
export class EtlModule {}
