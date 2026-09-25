import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { RedisSubscriberService } from './redis-subscriber.service';

@Module({
  imports: [AssignmentsModule],
  providers: [RedisSubscriberService],
})
export class RedisModule {}
