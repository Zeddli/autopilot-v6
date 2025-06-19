import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { KafkaHealthIndicator } from './kafka.health';
import { SchedulerHealthIndicator } from './scheduler.health';
import { RecoveryHealthIndicator } from './recovery.health';
import { KafkaService } from '../kafka/kafka.service';

/**
 * Health Controller
 *
 * Provides comprehensive health check endpoints for all system components:
 * - Overall system health
 * - Kafka connectivity
 * - Scheduler service health
 * - Recovery service health
 * - Individual component checks
 */
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private kafkaHealth: KafkaHealthIndicator,
    private schedulerHealth: SchedulerHealthIndicator,
    private recoveryHealth: RecoveryHealthIndicator,
    private kafkaService: KafkaService,
  ) {}

  /**
   * Overall system health check
   * Includes all critical components
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.kafkaHealth.isHealthy('kafka'),
      () => this.schedulerHealth.isHealthy('scheduler'),
      () => this.recoveryHealth.isHealthy('recovery'),
    ]);
  }

  /**
   * Kafka service health check
   */
  @Get('kafka')
  @HealthCheck()
  checkKafka() {
    return this.health.check([() => this.kafkaHealth.isHealthy('kafka')]);
  }

  /**
   * Scheduler service health check
   */
  @Get('scheduler')
  @HealthCheck()
  checkScheduler() {
    return this.health.check([
      () => this.schedulerHealth.isHealthy('scheduler'),
    ]);
  }

  /**
   * Scheduler responsiveness check
   */
  @Get('scheduler/responsive')
  @HealthCheck()
  checkSchedulerResponsive() {
    return this.health.check([
      () => this.schedulerHealth.isResponsive('scheduler-responsive'),
    ]);
  }

  /**
   * Scheduler job queue health check
   */
  @Get('scheduler/queue')
  @HealthCheck()
  checkSchedulerQueue() {
    return this.health.check([
      () => this.schedulerHealth.checkJobQueue('scheduler-queue'),
    ]);
  }

  /**
   * Recovery service health check
   */
  @Get('recovery')
  @HealthCheck()
  checkRecovery() {
    return this.health.check([() => this.recoveryHealth.isHealthy('recovery')]);
  }

  /**
   * Recovery service responsiveness check
   */
  @Get('recovery/responsive')
  @HealthCheck()
  checkRecoveryResponsive() {
    return this.health.check([
      () => this.recoveryHealth.isResponsive('recovery-responsive'),
    ]);
  }

  /**
   * Recovery configuration health check
   */
  @Get('recovery/config')
  @HealthCheck()
  checkRecoveryConfig() {
    return this.health.check([
      () => this.recoveryHealth.checkConfiguration('recovery-config'),
    ]);
  }

  /**
   * Recovery performance health check
   */
  @Get('recovery/performance')
  @HealthCheck()
  checkRecoveryPerformance() {
    return this.health.check([
      () => this.recoveryHealth.checkPerformance('recovery-performance'),
    ]);
  }

  /**
   * Basic application health check
   */
  @Get('app')
  @HealthCheck()
  checkApp() {
    return this.health.check([]);
  }

  /**
   * Detailed system health check with all components
   */
  @Get('detailed')
  @HealthCheck()
  checkDetailed() {
    return this.health.check([
      () => this.kafkaHealth.isHealthy('kafka'),
      () => this.schedulerHealth.isHealthy('scheduler'),
      () => this.schedulerHealth.isResponsive('scheduler-responsive'),
      () => this.schedulerHealth.checkJobQueue('scheduler-queue'),
      () => this.recoveryHealth.isHealthy('recovery'),
      () => this.recoveryHealth.isResponsive('recovery-responsive'),
      () => this.recoveryHealth.checkConfiguration('recovery-config'),
      () => this.recoveryHealth.checkPerformance('recovery-performance'),
    ]);
  }

  /**
   * Debug endpoint to test Kafka service directly
   */
  @Get('debug/kafka')
  async debugKafka() {
    try {
      const isConnected = await this.kafkaService.isConnected();
      const isInMockMode = this.kafkaService.isInMockMode();
      
      return {
        status: 'success',
        data: {
          isConnected,
          isInMockMode,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const err = error as Error;
      return {
        status: 'error',
        data: {
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
