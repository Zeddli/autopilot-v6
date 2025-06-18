import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './services/scheduler.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [ScheduleModule.forRoot(), KafkaModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
