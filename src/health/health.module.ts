import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { KafkaHealthIndicator } from './kafka.health';
import { SchedulerHealthIndicator } from './scheduler.health';
import { RecoveryHealthIndicator } from './recovery.health';
import { KafkaModule } from '../kafka/kafka.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { RecoveryModule } from '../recovery/recovery.module';

/**
 * Health Module
 *
 * Provides comprehensive health monitoring for all system components:
 * - Kafka connectivity and messaging health
 * - Scheduler service health and job queue monitoring
 * - Recovery service health and performance metrics
 * - Overall system health aggregation
 */
@Module({
  imports: [TerminusModule, KafkaModule, SchedulerModule, RecoveryModule],
  controllers: [HealthController],
  providers: [
    KafkaHealthIndicator,
    SchedulerHealthIndicator,
    RecoveryHealthIndicator,
  ],
  exports: [
    KafkaHealthIndicator,
    SchedulerHealthIndicator,
    RecoveryHealthIndicator,
  ],
})
export class HealthModule {}
