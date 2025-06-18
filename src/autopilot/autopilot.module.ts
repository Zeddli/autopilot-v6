import { Module, forwardRef } from '@nestjs/common';
import { AutopilotService } from './services/autopilot.service';
import { ScheduleAdjustmentService } from './services/schedule-adjustment.service';
import { ChallengeUpdateHandler } from './handlers/challenge-update.handler';
import { KafkaModule } from '../kafka/kafka.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [forwardRef(() => KafkaModule), forwardRef(() => SchedulerModule)],
  providers: [
    AutopilotService,
    ScheduleAdjustmentService,
    ChallengeUpdateHandler,
  ],
  exports: [
    AutopilotService,
    ScheduleAdjustmentService,
    ChallengeUpdateHandler,
  ],
})
export class AutopilotModule {}
