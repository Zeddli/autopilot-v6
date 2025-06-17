import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { KafkaModule } from './kafka/kafka.module';
import { AutopilotModule } from './autopilot/autopilot.module';
import { HealthModule } from './health/health.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { RecoveryModule } from './recovery/recovery.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    KafkaModule,
    SchedulerModule,
    RecoveryModule,
    AutopilotModule,
    HealthModule,
  ],
})
export class AppModule {}
