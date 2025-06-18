import { Module } from '@nestjs/common';
import { RecoveryService } from './services/recovery.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { AppConfigModule } from '../config/config.module';

/**
 * RecoveryModule
 *
 * Module that provides recovery and resilience functionality for the autopilot system.
 * This module handles startup recovery operations to ensure that any missed or interrupted
 * phase transitions are properly scheduled or executed.
 *
 * Key responsibilities:
 * - Startup recovery operations
 * - Active phase scanning and scheduling
 * - Overdue phase processing
 * - Recovery metrics and monitoring
 *
 * Dependencies:
 * - SchedulerModule: For scheduling recovered phase transitions
 * - ConfigModule: For recovery configuration settings
 */
@Module({
  imports: [
    // Import scheduler module to access scheduling services
    SchedulerModule,

    // Import config module for recovery settings
    AppConfigModule,
  ],
  providers: [
    // Core recovery service
    RecoveryService,
  ],
  exports: [
    // Export RecoveryService for use in main application
    RecoveryService,
  ],
})
export class RecoveryModule {}
