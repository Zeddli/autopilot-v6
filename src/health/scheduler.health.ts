import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { SchedulerService } from '../scheduler/services/scheduler.service';

/**
 * Scheduler Health Indicator
 *
 * Monitors the health and status of the scheduler service including:
 * - Active job count
 * - Scheduled job count
 * - Failed job count
 * - Overall scheduler service availability
 */
@Injectable()
export class SchedulerHealthIndicator extends HealthIndicator {
  constructor(private readonly schedulerService: SchedulerService) {
    super();
  }

  /**
   * Check the overall health of the scheduler service
   *
   * @param key - Health check identifier
   * @returns Health indicator result with scheduler metrics
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Get scheduler metrics and status
      const schedulerMetrics = await this.getSchedulerMetrics();
      const isHealthy = this.evaluateSchedulerHealth(schedulerMetrics);

      if (isHealthy) {
        return this.getStatus(key, true, {
          ...schedulerMetrics,
          status: 'healthy',
          message: 'Scheduler service is operating normally',
        });
      } else {
        throw new HealthCheckError(
          'Scheduler service health check failed',
          this.getStatus(key, false, {
            ...schedulerMetrics,
            status: 'unhealthy',
            message: 'Scheduler service has issues',
          }),
        );
      }
    } catch (error) {
      const err = error as Error;
      throw new HealthCheckError(
        'Scheduler service health check failed',
        this.getStatus(key, false, {
          status: 'error',
          message: err.message || 'Unknown scheduler error',
          error: err.name || 'SchedulerError',
        }),
      );
    }
  }

  /**
   * Get detailed scheduler metrics
   *
   * @returns Scheduler metrics and status information
   */
  private async getSchedulerMetrics(): Promise<Record<string, any>> {
    try {
      // Get all scheduled transitions to analyze
      const scheduledTransitions =
        await this.schedulerService.getAllScheduledTransitions();

      // Calculate metrics
      const now = new Date();
      const activeJobs = scheduledTransitions.filter(
        (job) =>
          job.status === 'scheduled' && new Date(job.scheduledTime) > now,
      );
      const completedJobs = scheduledTransitions.filter(
        (job) => job.status === 'completed',
      );
      const failedJobs = scheduledTransitions.filter(
        (job) => job.status === 'failed',
      );
      const overdueJobs = scheduledTransitions.filter(
        (job) =>
          job.status === 'scheduled' && new Date(job.scheduledTime) <= now,
      );

      // Calculate health metrics
      const totalJobs = scheduledTransitions.length;
      const successRate =
        totalJobs > 0 ? (completedJobs.length / totalJobs) * 100 : 100;
      const failureRate =
        totalJobs > 0 ? (failedJobs.length / totalJobs) * 100 : 0;

      return {
        totalJobs,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
        overdueJobs: overdueJobs.length,
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        lastUpdate: now.toISOString(),
      };
    } catch (error) {
      const err = error as Error;
      return {
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        overdueJobs: 0,
        successRate: 0,
        failureRate: 100,
        lastUpdate: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  /**
   * Evaluate scheduler health based on metrics
   *
   * @param metrics - Scheduler metrics to evaluate
   * @returns Boolean indicating if scheduler is healthy
   */
  private evaluateSchedulerHealth(metrics: Record<string, any>): boolean {
    // Health criteria:
    // 1. Failure rate should be less than 10%
    // 2. Should not have too many overdue jobs (less than 5% of total)
    // 3. Should not have excessive failed jobs (less than 20 failed jobs)

    const failureRateThreshold = 10; // 10%
    const overdueJobsThreshold = 5; // 5%
    const maxFailedJobs = 20;

    const overdueJobsRate =
      metrics.totalJobs > 0
        ? (metrics.overdueJobs / metrics.totalJobs) * 100
        : 0;

    return (
      metrics.failureRate < failureRateThreshold &&
      overdueJobsRate < overdueJobsThreshold &&
      metrics.failedJobs < maxFailedJobs
    );
  }

  /**
   * Check if scheduler is responsive
   *
   * @param key - Health check identifier
   * @returns Health indicator result for scheduler responsiveness
   */
  async isResponsive(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();

      // Test scheduler responsiveness by getting job count
      await this.schedulerService.getAllScheduledTransitions();

      const responseTime = Date.now() - startTime;
      const isResponsive = responseTime < 5000; // 5 seconds threshold

      if (isResponsive) {
        return this.getStatus(key, true, {
          responseTime,
          status: 'responsive',
          message: 'Scheduler service is responsive',
        });
      } else {
        throw new HealthCheckError(
          'Scheduler service is not responsive',
          this.getStatus(key, false, {
            responseTime,
            status: 'slow',
            message: 'Scheduler service response time is too high',
          }),
        );
      }
    } catch (error) {
      const err = error as Error;
      throw new HealthCheckError(
        'Scheduler service responsiveness check failed',
        this.getStatus(key, false, {
          status: 'error',
          message: err.message || 'Scheduler responsiveness check failed',
          error: err.name || 'SchedulerError',
        }),
      );
    }
  }

  /**
   * Check scheduler job queue health
   *
   * @param key - Health check identifier
   * @returns Health indicator result for job queue health
   */
  async checkJobQueue(key: string): Promise<HealthIndicatorResult> {
    try {
      const metrics = await this.getSchedulerMetrics();

      // Job queue health criteria
      const maxActiveJobs = 1000; // Maximum active jobs threshold
      const maxOverdueJobs = 50; // Maximum overdue jobs threshold

      const isJobQueueHealthy =
        metrics.activeJobs < maxActiveJobs &&
        metrics.overdueJobs < maxOverdueJobs;

      if (isJobQueueHealthy) {
        return this.getStatus(key, true, {
          activeJobs: metrics.activeJobs as number,
          overdueJobs: metrics.overdueJobs as number,
          maxActiveJobs,
          maxOverdueJobs,
          status: 'healthy',
          message: 'Scheduler job queue is healthy',
        });
      } else {
        throw new HealthCheckError(
          'Scheduler job queue is unhealthy',
          this.getStatus(key, false, {
            activeJobs: metrics.activeJobs as number,
            overdueJobs: metrics.overdueJobs as number,
            maxActiveJobs,
            maxOverdueJobs,
            status: 'unhealthy',
            message: 'Scheduler job queue has too many jobs',
          }),
        );
      }
    } catch (error) {
      const err = error as Error;
      throw new HealthCheckError(
        'Scheduler job queue health check failed',
        this.getStatus(key, false, {
          status: 'error',
          message: err.message || 'Job queue health check failed',
          error: err.name || 'SchedulerError',
        }),
      );
    }
  }
}
