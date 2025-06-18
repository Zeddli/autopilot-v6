import { Injectable, Logger } from '@nestjs/common';
import { SchedulerService } from '../../scheduler/services/scheduler.service';
import { ScheduledTransitionInfo } from '../../scheduler/dto/scheduled-transition-info.dto';
import { PhaseTransitionScheduleDto } from '../../scheduler/dto/phase-transition-schedule.dto';

export interface ScheduleChange {
  projectId: number;
  phaseId: number;
  oldEndTime?: string;
  newEndTime: string;
  phaseTypeName: string;
  operator: string;
  projectStatus: string;
  changeReason?: string;
}

export interface ScheduleAdjustmentResult {
  success: boolean;
  adjustedCount: number;
  cancelledCount: number;
  rescheduledCount: number;
  errors: string[];
  details: {
    cancelled: string[]; // job IDs
    rescheduled: { oldJobId: string; newJobId: string; phaseId: number }[];
  };
}

@Injectable()
export class ScheduleAdjustmentService {
  private readonly logger = new Logger(ScheduleAdjustmentService.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  /**
   * Process schedule changes for multiple phases
   * This is the main method for handling bulk schedule adjustments
   */
  async processScheduleChanges(
    changes: ScheduleChange[],
  ): Promise<ScheduleAdjustmentResult> {
    this.logger.log(`Processing ${changes.length} schedule changes`);

    const result: ScheduleAdjustmentResult = {
      success: true,
      adjustedCount: 0,
      cancelledCount: 0,
      rescheduledCount: 0,
      errors: [],
      details: {
        cancelled: [],
        rescheduled: [],
      },
    };

    // Get all currently scheduled transitions
    const currentTransitions =
      await this.schedulerService.getAllScheduledTransitions();

    for (const change of changes) {
      try {
        await this.processSingleScheduleChange(
          change,
          currentTransitions,
          result,
        );
        result.adjustedCount++;
      } catch (error) {
        this.logger.error(
          `Error processing schedule change for phase ${change.phaseId}:`,
          error,
        );
        result.errors.push(
          `Phase ${change.phaseId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        result.success = false;
      }
    }

    this.logger.log(
      `Schedule adjustment completed. Adjusted: ${result.adjustedCount}, Cancelled: ${result.cancelledCount}, Rescheduled: ${result.rescheduledCount}, Errors: ${result.errors.length}`,
    );
    return result;
  }

  /**
   * Process a single schedule change
   */
  private async processSingleScheduleChange(
    change: ScheduleChange,
    currentTransitions: ScheduledTransitionInfo[],
    result: ScheduleAdjustmentResult,
  ): Promise<void> {
    this.logger.log(
      `Processing schedule change for phase ${change.phaseId} in project ${change.projectId}`,
    );

    // Find existing scheduled transitions for this phase
    const existingTransitions = currentTransitions.filter(
      (t) => t.projectId === change.projectId && t.phaseId === change.phaseId,
    );

    if (existingTransitions.length === 0) {
      this.logger.log(
        `No existing scheduled transitions found for phase ${change.phaseId}, scheduling new transition`,
      );

      // No existing transitions, just schedule the new one
      await this.scheduleNewTransition(change, result);
      return;
    }

    // Process each existing transition
    for (const transition of existingTransitions) {
      await this.adjustExistingTransition(transition, change, result);
    }
  }

  /**
   * Schedule a new transition when none exists
   */
  private async scheduleNewTransition(
    change: ScheduleChange,
    result: ScheduleAdjustmentResult,
  ): Promise<void> {
    try {
      const scheduleDto: PhaseTransitionScheduleDto = {
        projectId: change.projectId,
        phaseId: change.phaseId,
        phaseTypeName: change.phaseTypeName,
        state: 'END', // Typically we schedule END transitions
        endTime: change.newEndTime,
        operator: change.operator,
        projectStatus: change.projectStatus,
        date: new Date().toISOString(),
        metadata: {
          reason: change.changeReason || 'schedule_adjustment',
          adjustedAt: new Date().toISOString(),
        },
      };

      const newJobId =
        await this.schedulerService.schedulePhaseTransition(scheduleDto);

      result.details.rescheduled.push({
        oldJobId: 'none',
        newJobId,
        phaseId: change.phaseId,
      });
      result.rescheduledCount++;

      this.logger.log(
        `Scheduled new transition for phase ${change.phaseId}, job ID: ${newJobId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule new transition for phase ${change.phaseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Adjust an existing transition based on schedule change
   */
  private async adjustExistingTransition(
    transition: ScheduledTransitionInfo,
    change: ScheduleChange,
    result: ScheduleAdjustmentResult,
  ): Promise<void> {
    const newEndTime = new Date(change.newEndTime);
    const currentTime = new Date();

    // Check if the new end time is in the past
    if (newEndTime <= currentTime) {
      this.logger.log(
        `New end time for phase ${change.phaseId} is in the past, cancelling scheduled transition`,
      );

      // Cancel the existing transition as it should have already happened
      const cancelled = await this.schedulerService.cancelScheduledTransition(
        transition.jobId,
      );
      if (cancelled) {
        result.details.cancelled.push(transition.jobId);
        result.cancelledCount++;

        // Optionally trigger immediate execution here
        // For now, we'll just log it
        this.logger.log(
          `Phase ${change.phaseId} should have ended at ${change.newEndTime}, may need immediate processing`,
        );
      }
      return;
    }

    // Check if the new time is significantly different from the old time
    const oldEndTime = new Date(transition.scheduledTime);
    const timeDifferenceMs = Math.abs(
      newEndTime.getTime() - oldEndTime.getTime(),
    );
    const minimumAdjustmentMs = 60000; // 1 minute threshold

    if (timeDifferenceMs < minimumAdjustmentMs) {
      this.logger.log(
        `Schedule change for phase ${change.phaseId} is minimal (${timeDifferenceMs}ms), skipping adjustment`,
      );
      return;
    }

    this.logger.log(
      `Rescheduling transition for phase ${change.phaseId} from ${transition.scheduledTime} to ${change.newEndTime}`,
    );

    try {
      // Create new schedule data
      const scheduleDto: PhaseTransitionScheduleDto = {
        projectId: change.projectId,
        phaseId: change.phaseId,
        phaseTypeName: change.phaseTypeName,
        state: transition.state,
        endTime: change.newEndTime,
        operator: change.operator,
        projectStatus: change.projectStatus,
        date: new Date().toISOString(),
        metadata: {
          reason: change.changeReason || 'schedule_adjustment',
          adjustedAt: new Date().toISOString(),
          originalJobId: transition.jobId,
          originalScheduledTime: transition.scheduledTime,
        },
      };

      // Update the existing transition (this will cancel and reschedule)
      const newJobId = await this.schedulerService.updateScheduledTransition(
        transition.jobId,
        scheduleDto,
      );

      result.details.rescheduled.push({
        oldJobId: transition.jobId,
        newJobId,
        phaseId: change.phaseId,
      });
      result.rescheduledCount++;

      this.logger.log(
        `Successfully rescheduled transition for phase ${change.phaseId}, old job: ${transition.jobId}, new job: ${newJobId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reschedule transition for phase ${change.phaseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Compare schedules and identify changes
   * This method can be used to detect what has changed in a challenge
   */
  async detectScheduleChanges(
    projectId: number,
    currentPhases: Array<{
      phaseId: number;
      phaseTypeName: string;
      endTime: string;
      projectStatus: string;
    }>,
    operator: string,
  ): Promise<ScheduleChange[]> {
    this.logger.log(`Detecting schedule changes for project ${projectId}`);

    const changes: ScheduleChange[] = [];
    const currentTransitions =
      await this.schedulerService.getAllScheduledTransitions();
    const projectTransitions = currentTransitions.filter(
      (t) => t.projectId === projectId,
    );

    // Check each current phase against scheduled transitions
    for (const phase of currentPhases) {
      const existingTransition = projectTransitions.find(
        (t) => t.phaseId === phase.phaseId,
      );

      if (!existingTransition) {
        // New phase or phase without scheduled transition
        changes.push({
          projectId,
          phaseId: phase.phaseId,
          newEndTime: phase.endTime,
          phaseTypeName: phase.phaseTypeName,
          operator,
          projectStatus: phase.projectStatus,
          changeReason: 'new_phase_schedule',
        });
      } else {
        // Check if end time has changed
        const existingEndTime = new Date(existingTransition.scheduledTime);
        const newEndTime = new Date(phase.endTime);

        if (
          Math.abs(existingEndTime.getTime() - newEndTime.getTime()) > 60000
        ) {
          // 1 minute threshold
          changes.push({
            projectId,
            phaseId: phase.phaseId,
            oldEndTime: existingTransition.scheduledTime,
            newEndTime: phase.endTime,
            phaseTypeName: phase.phaseTypeName,
            operator,
            projectStatus: phase.projectStatus,
            changeReason: 'end_time_change',
          });
        }
      }
    }

    // Check for phases that have been removed (scheduled but not in current phases)
    for (const transition of projectTransitions) {
      const stillExists = currentPhases.some(
        (p) => p.phaseId === transition.phaseId,
      );
      if (!stillExists) {
        changes.push({
          projectId,
          phaseId: transition.phaseId,
          oldEndTime: transition.scheduledTime,
          newEndTime: new Date().toISOString(), // Immediate cancellation
          phaseTypeName: transition.phaseTypeName,
          operator,
          projectStatus: transition.projectStatus,
          changeReason: 'phase_removed',
        });
      }
    }

    this.logger.log(
      `Detected ${changes.length} schedule changes for project ${projectId}`,
    );
    return changes;
  }

  /**
   * Cancel all scheduled transitions for a project
   * Useful when a challenge is cancelled or significantly restructured
   */
  async cancelAllProjectTransitions(
    projectId: number,
  ): Promise<ScheduleAdjustmentResult> {
    this.logger.log(
      `Cancelling all scheduled transitions for project ${projectId}`,
    );

    const result: ScheduleAdjustmentResult = {
      success: true,
      adjustedCount: 0,
      cancelledCount: 0,
      rescheduledCount: 0,
      errors: [],
      details: {
        cancelled: [],
        rescheduled: [],
      },
    };

    try {
      const currentTransitions =
        await this.schedulerService.getAllScheduledTransitions();
      const projectTransitions = currentTransitions.filter(
        (t) => t.projectId === projectId,
      );

      for (const transition of projectTransitions) {
        try {
          const cancelled =
            await this.schedulerService.cancelScheduledTransition(
              transition.jobId,
            );
          if (cancelled) {
            result.details.cancelled.push(transition.jobId);
            result.cancelledCount++;
            result.adjustedCount++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to cancel transition ${transition.jobId}:`,
            error,
          );
          result.errors.push(
            `Job ${transition.jobId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          result.success = false;
        }
      }

      this.logger.log(
        `Cancelled ${result.cancelledCount} transitions for project ${projectId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error cancelling transitions for project ${projectId}:`,
        error,
      );
      result.errors.push(
        `Project cancellation error: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.success = false;
    }

    return result;
  }
}
