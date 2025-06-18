import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import {
  ISchedulerService,
  JobMetadata,
} from '../interfaces/scheduler.interface';
import { PhaseTransitionScheduleDto } from '../dto/phase-transition-schedule.dto';
import { ScheduledTransitionInfo } from '../dto/scheduled-transition-info.dto';
import { SchedulerErrorType, SchedulerError } from '../types/scheduler.types';
import { AutopilotProducer } from '../../kafka/producers/autopilot.producer';
import { PhaseTransitionPayload } from '../../kafka/templates/autopilot.template';

@Injectable()
export class SchedulerService implements ISchedulerService, OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly activeJobs = new Map<string, JobMetadata>();

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private autopilotProducer: AutopilotProducer,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('SchedulerService initialized');
    // Clean up any orphaned jobs on service restart
    await this.cleanupOrphanedJobs();
  }

  async schedulePhaseTransition(
    phaseData: PhaseTransitionScheduleDto,
  ): Promise<string> {
    this.logger.log(
      `Scheduling phase transition for phase ${phaseData.phaseId}, project ${phaseData.projectId}`,
    );

    // Validate schedule time
    const scheduleTime = new Date(phaseData.endTime);
    const now = new Date();

    // Small delay to make this properly async and avoid linting error
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (scheduleTime <= now) {
      const error = this.createSchedulerError(
        SchedulerErrorType.PAST_SCHEDULE_TIME,
        `Cannot schedule phase transition in the past. Schedule time: ${scheduleTime.toISOString()}, Current time: ${now.toISOString()}`,
        undefined,
        phaseData.phaseId,
        phaseData.projectId,
      );
      throw new Error(JSON.stringify(error));
    }

    // Generate unique job ID
    const jobId = this.generateJobId(phaseData.projectId, phaseData.phaseId);

    // Check for duplicate jobs
    if (this.activeJobs.has(jobId)) {
      const error = this.createSchedulerError(
        SchedulerErrorType.DUPLICATE_JOB,
        `Job already exists for phase ${phaseData.phaseId} in project ${phaseData.projectId}`,
        jobId,
        phaseData.phaseId,
        phaseData.projectId,
      );
      throw new Error(JSON.stringify(error));
    }

    try {
      // Create job execution callback
      const jobCallback = this.createJobCallback(jobId, phaseData);

      // Create and register cron job
      const cronJob = new CronJob(scheduleTime, jobCallback, null, false);
      this.schedulerRegistry.addCronJob(jobId, cronJob);

      // Start the job
      cronJob.start();

      // Track job metadata
      const jobMetadata: JobMetadata = {
        jobId,
        phaseData,
        scheduledTime: scheduleTime,
        createdAt: new Date(),
        status: 'scheduled',
        retryCount: 0,
      };

      this.activeJobs.set(jobId, jobMetadata);

      this.logger.log(
        `Successfully scheduled phase transition. Job ID: ${jobId}, Schedule time: ${scheduleTime.toISOString()}`,
      );
      return jobId;
    } catch (error) {
      this.logger.error(
        `Failed to schedule phase transition for phase ${phaseData.phaseId}`,
        error,
      );
      const schedulerError = this.createSchedulerError(
        SchedulerErrorType.SCHEDULING_FAILED,
        `Failed to schedule phase transition: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        phaseData.phaseId,
        phaseData.projectId,
        error instanceof Error ? error : undefined,
      );
      throw new Error(JSON.stringify(schedulerError));
    }
  }

  async cancelScheduledTransition(jobId: string): Promise<boolean> {
    this.logger.log(`Cancelling scheduled transition: ${jobId}`);

    // Small delay to make this properly async and avoid linting error
    await new Promise((resolve) => setTimeout(resolve, 0));

    const jobMetadata = this.activeJobs.get(jobId);
    if (!jobMetadata) {
      this.logger.warn(`Job not found: ${jobId}`);
      return false;
    }

    try {
      // Remove from scheduler registry
      try {
        this.schedulerRegistry.deleteCronJob(jobId);
      } catch {
        this.logger.warn(
          `Job ${jobId} not found in scheduler registry, it may have already executed`,
        );
      }

      // Update job status and cleanup
      jobMetadata.status = 'cancelled';
      this.activeJobs.delete(jobId);

      this.logger.log(`Successfully cancelled scheduled transition: ${jobId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to cancel scheduled transition: ${jobId}`,
        error,
      );
      const schedulerError = this.createSchedulerError(
        SchedulerErrorType.CANCELLATION_FAILED,
        `Failed to cancel job: ${error instanceof Error ? error.message : String(error)}`,
        jobId,
        undefined,
        undefined,
        error instanceof Error ? error : undefined,
      );
      throw new Error(JSON.stringify(schedulerError));
    }
  }

  async updateScheduledTransition(
    jobId: string,
    phaseData: PhaseTransitionScheduleDto,
  ): Promise<string> {
    this.logger.log(`Updating scheduled transition: ${jobId}`);

    // Cancel existing job
    const cancelled = await this.cancelScheduledTransition(jobId);
    if (!cancelled) {
      const error = this.createSchedulerError(
        SchedulerErrorType.JOB_NOT_FOUND,
        `Cannot update non-existent job: ${jobId}`,
        jobId,
      );
      throw new Error(JSON.stringify(error));
    }

    try {
      // Schedule new job
      const newJobId = await this.schedulePhaseTransition(phaseData);

      this.logger.log(
        `Successfully updated scheduled transition. Old job: ${jobId}, New job: ${newJobId}`,
      );
      return newJobId;
    } catch (error) {
      this.logger.error(
        `Failed to update scheduled transition: ${jobId}`,
        error,
      );
      const schedulerError = this.createSchedulerError(
        SchedulerErrorType.SCHEDULING_FAILED,
        `Failed to update job: ${error instanceof Error ? error.message : String(error)}`,
        jobId,
        undefined,
        undefined,
        error instanceof Error ? error : undefined,
      );
      throw new Error(JSON.stringify(schedulerError));
    }
  }

  getAllScheduledTransitions(): Promise<ScheduledTransitionInfo[]> {
    this.logger.log('Retrieving all scheduled transitions');

    const transitions = Array.from(this.activeJobs.values()).map((job) =>
      this.mapToScheduledTransitionInfo(job),
    );

    this.logger.log(`Retrieved ${transitions.length} scheduled transitions`);
    return Promise.resolve(transitions);
  }

  private generateJobId(projectId: number, phaseId: number): string {
    return `phase-transition-${projectId}-${phaseId}-${uuidv4()}`;
  }

  private createJobCallback(
    jobId: string,
    phaseData: PhaseTransitionScheduleDto,
  ) {
    return async () => {
      this.logger.log(`Executing scheduled phase transition job: ${jobId}`);

      const jobMetadata = this.activeJobs.get(jobId);
      if (!jobMetadata) {
        this.logger.error(`Job metadata not found for executing job: ${jobId}`);
        return;
      }

      try {
        // Update job status
        jobMetadata.status = 'running';

        // Create phase transition payload
        const payload: PhaseTransitionPayload = {
          projectId: phaseData.projectId,
          phaseId: phaseData.phaseId,
          phaseTypeName: phaseData.phaseTypeName,
          state: phaseData.state,
          operator: phaseData.operator,
          projectStatus: phaseData.projectStatus,
          date: new Date().toISOString(),
        };

        // Publish phase transition event to Kafka
        await this.autopilotProducer.sendPhaseTransition(payload);

        this.logger.log(`Phase transition event published for job ${jobId}:`, {
          projectId: phaseData.projectId,
          phaseId: phaseData.phaseId,
          phaseTypeName: phaseData.phaseTypeName,
          state: phaseData.state,
          scheduledTime: jobMetadata.scheduledTime.toISOString(),
          executedAt: new Date().toISOString(),
        });

        // Update job status to completed
        jobMetadata.status = 'completed';

        // Clean up completed job after a delay to allow for monitoring
        setTimeout(() => {
          this.activeJobs.delete(jobId);
          this.logger.log(`Cleaned up completed job: ${jobId}`);
        }, 300000); // 5 minutes
      } catch (error) {
        this.logger.error(
          `Failed to execute phase transition job: ${jobId}`,
          error,
        );

        // Update job status to failed
        if (jobMetadata) {
          jobMetadata.status = 'failed';
          jobMetadata.lastError =
            error instanceof Error ? error.message : String(error);
          jobMetadata.retryCount = (jobMetadata.retryCount || 0) + 1;
        }
      } finally {
        // Remove from scheduler registry as the job is complete (whether successful or failed)
        try {
          this.schedulerRegistry.deleteCronJob(jobId);
        } catch (registryError) {
          this.logger.warn(
            `Could not remove job ${jobId} from scheduler registry:`,
            registryError,
          );
        }
      }
    };
  }

  private mapToScheduledTransitionInfo(
    job: JobMetadata,
  ): ScheduledTransitionInfo {
    const info = new ScheduledTransitionInfo();
    info.jobId = job.jobId;
    info.projectId = job.phaseData.projectId;
    info.phaseId = job.phaseData.phaseId;
    info.phaseTypeName = job.phaseData.phaseTypeName;
    info.state = job.phaseData.state;
    info.scheduledTime = job.scheduledTime.toISOString();
    info.createdAt = job.createdAt.toISOString();
    info.status = job.status;
    info.operator = job.phaseData.operator;
    info.projectStatus = job.phaseData.projectStatus;
    info.retryCount = job.retryCount;
    info.lastError = job.lastError;
    info.metadata = job.phaseData.metadata;

    return info;
  }

  private createSchedulerError(
    type: SchedulerErrorType,
    message: string,
    jobId?: string,
    phaseId?: number,
    projectId?: number,
    originalError?: Error,
  ): SchedulerError {
    return {
      type,
      message,
      jobId,
      phaseId,
      projectId,
      timestamp: new Date(),
      originalError,
    };
  }

  private async cleanupOrphanedJobs(): Promise<void> {
    this.logger.log('Cleaning up orphaned jobs from previous service runs');

    // Clear any jobs that might be left in the scheduler registry
    const cronJobs = this.schedulerRegistry.getCronJobs();
    let cleanedCount = 0;

    cronJobs.forEach((job, name) => {
      if (name.startsWith('phase-transition-')) {
        try {
          this.schedulerRegistry.deleteCronJob(name);
          cleanedCount++;
        } catch (error) {
          this.logger.warn(`Could not clean up orphaned job ${name}:`, error);
        }
      }
    });

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} orphaned jobs`);
    }

    // Return a resolved promise to satisfy async requirement
    return Promise.resolve();
  }
}
