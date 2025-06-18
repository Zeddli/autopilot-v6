import { Injectable, Logger } from '@nestjs/common';
import {
  ScheduleAdjustmentService,
  ScheduleChange,
} from '../services/schedule-adjustment.service';
import { ChallengeUpdatePayload } from '../interfaces/autopilot.interface';
import {
  ChallengeScheduleUpdateDto,
  PhaseInfoDto,
} from '../dto/schedule-update.dto';

@Injectable()
export class ChallengeUpdateHandler {
  private readonly logger = new Logger(ChallengeUpdateHandler.name);

  constructor(
    private readonly scheduleAdjustmentService: ScheduleAdjustmentService,
  ) {}

  /**
   * Handle challenge update events and process any schedule adjustments
   */
  async handleChallengeUpdate(
    message: ChallengeUpdatePayload,
    challengeData?: ChallengeScheduleUpdateDto,
  ): Promise<void> {
    this.logger.log(
      `Processing challenge update for project ${message.projectId}`,
    );

    try {
      // If we have detailed challenge data, process schedule changes
      if (challengeData) {
        await this.processDetailedChallengeUpdate(challengeData);
        return;
      }

      // For basic challenge update messages, we need to determine what to do based on status
      await this.processBasicChallengeUpdate(message);
    } catch (error) {
      this.logger.error(
        `Error handling challenge update for project ${message.projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process a detailed challenge update with phase information
   */
  private async processDetailedChallengeUpdate(
    challengeData: ChallengeScheduleUpdateDto,
  ): Promise<void> {
    this.logger.log(
      `Processing detailed challenge update for project ${challengeData.projectId}`,
    );

    try {
      // Handle different project statuses
      switch (challengeData.projectStatus) {
        case 'CANCELLED':
        case 'COMPLETED':
          // Cancel all scheduled transitions for cancelled or completed challenges
          await this.handleCancelledOrCompletedChallenge(challengeData);
          break;

        case 'ACTIVE':
          // Process schedule changes for active challenges
          await this.handleActiveChallengeUpdate(challengeData);
          break;

        case 'DRAFT':
          // Draft challenges shouldn't have scheduled transitions yet
          this.logger.log(
            `Challenge ${challengeData.projectId} is in DRAFT status, no schedule adjustments needed`,
          );
          break;

        default:
          this.logger.warn(
            `Unknown project status: ${challengeData.projectStatus} for project ${challengeData.projectId}`,
          );
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error processing detailed challenge update for project ${challengeData.projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process a basic challenge update message
   */
  private async processBasicChallengeUpdate(
    message: ChallengeUpdatePayload,
  ): Promise<void> {
    this.logger.log(
      `Processing basic challenge update for project ${message.projectId}, status: ${message.status}`,
    );

    try {
      // Handle status changes that affect scheduling
      if (message.status === 'CANCELLED' || message.status === 'COMPLETED') {
        // Cancel all scheduled transitions
        const result =
          await this.scheduleAdjustmentService.cancelAllProjectTransitions(
            message.projectId,
          );

        this.logger.log(
          `Cancelled ${result.cancelledCount} scheduled transitions for ${message.status.toLowerCase()} challenge ${message.projectId}`,
        );

        if (result.errors.length > 0) {
          this.logger.warn(
            `Errors occurred while cancelling transitions:`,
            result.errors,
          );
        }
      } else {
        // For other status changes, we would need more detailed information
        // to determine if schedule adjustments are needed
        this.logger.log(
          `Challenge ${message.projectId} status changed to ${message.status}, but no detailed phase data available for schedule adjustment`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing basic challenge update for project ${message.projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle cancelled or completed challenges by cancelling all scheduled transitions
   */
  private async handleCancelledOrCompletedChallenge(
    challengeData: ChallengeScheduleUpdateDto,
  ): Promise<void> {
    this.logger.log(
      `Handling ${challengeData.projectStatus.toLowerCase()} challenge ${challengeData.projectId}`,
    );

    try {
      const result =
        await this.scheduleAdjustmentService.cancelAllProjectTransitions(
          challengeData.projectId,
        );

      this.logger.log(
        `Cancelled ${result.cancelledCount} scheduled transitions for ${challengeData.projectStatus.toLowerCase()} challenge ${challengeData.projectId}`,
      );

      if (result.errors.length > 0) {
        this.logger.error(
          `Errors occurred while cancelling transitions for challenge ${challengeData.projectId}:`,
          result.errors,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling ${challengeData.projectStatus.toLowerCase()} challenge ${challengeData.projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle active challenge updates by detecting and processing schedule changes
   */
  private async handleActiveChallengeUpdate(
    challengeData: ChallengeScheduleUpdateDto,
  ): Promise<void> {
    this.logger.log(
      `Handling active challenge update for project ${challengeData.projectId}`,
    );

    try {
      // Filter to only include active phases that need scheduling
      const schedulablePhases = challengeData.phases.filter(
        (phase) =>
          phase.phaseStatus === 'ACTIVE' || phase.phaseStatus === 'SCHEDULED',
      );

      if (schedulablePhases.length === 0) {
        this.logger.log(
          `No schedulable phases found for challenge ${challengeData.projectId}`,
        );
        return;
      }

      // Convert phase data to the format expected by detectScheduleChanges
      const currentPhases = schedulablePhases.map((phase) => ({
        phaseId: phase.phaseId,
        phaseTypeName: phase.phaseTypeName,
        endTime: phase.endTime,
        projectStatus: challengeData.projectStatus,
      }));

      // Detect what has changed
      const changes =
        await this.scheduleAdjustmentService.detectScheduleChanges(
          challengeData.projectId,
          currentPhases,
          challengeData.operator,
        );

      if (changes.length === 0) {
        this.logger.log(
          `No schedule changes detected for challenge ${challengeData.projectId}`,
        );
        return;
      }

      // Process the detected changes
      this.logger.log(
        `Processing ${changes.length} schedule changes for challenge ${challengeData.projectId}`,
      );
      const result =
        await this.scheduleAdjustmentService.processScheduleChanges(changes);

      this.logger.log(
        `Schedule adjustment completed for challenge ${challengeData.projectId}:`,
        {
          adjustedCount: result.adjustedCount,
          cancelledCount: result.cancelledCount,
          rescheduledCount: result.rescheduledCount,
          errorCount: result.errors.length,
          success: result.success,
        },
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          `Schedule adjustment errors for challenge ${challengeData.projectId}:`,
          result.errors,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling active challenge update for project ${challengeData.projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle phase-specific updates
   * This can be called when we receive updates about specific phases
   */
  async handlePhaseUpdate(
    projectId: number,
    phaseId: number,
    phaseData: PhaseInfoDto,
    operator: string,
  ): Promise<void> {
    this.logger.log(
      `Processing phase update for phase ${phaseId} in project ${projectId}`,
    );

    try {
      // Create a schedule change for this specific phase
      const change: ScheduleChange = {
        projectId,
        phaseId,
        newEndTime: phaseData.endTime,
        phaseTypeName: phaseData.phaseTypeName,
        operator,
        projectStatus: phaseData.phaseStatus,
        changeReason: 'phase_update',
      };

      // Process the single change
      const result =
        await this.scheduleAdjustmentService.processScheduleChanges([change]);

      this.logger.log(`Phase update processed for phase ${phaseId}:`, {
        adjustedCount: result.adjustedCount,
        cancelledCount: result.cancelledCount,
        rescheduledCount: result.rescheduledCount,
        success: result.success,
      });

      if (result.errors.length > 0) {
        this.logger.error(
          `Phase update errors for phase ${phaseId}:`,
          result.errors,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling phase update for phase ${phaseId} in project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Utility method to validate and process bulk schedule changes
   */
  async processBulkScheduleChanges(
    changes: ScheduleChange[],
    batchId?: string,
  ): Promise<void> {
    this.logger.log(
      `Processing bulk schedule changes${batchId ? ` (batch: ${batchId})` : ''}: ${changes.length} changes`,
    );

    try {
      const result =
        await this.scheduleAdjustmentService.processScheduleChanges(changes);

      this.logger.log(
        `Bulk schedule adjustment completed${batchId ? ` (batch: ${batchId})` : ''}:`,
        {
          adjustedCount: result.adjustedCount,
          cancelledCount: result.cancelledCount,
          rescheduledCount: result.rescheduledCount,
          errorCount: result.errors.length,
          success: result.success,
        },
      );

      if (result.errors.length > 0) {
        this.logger.error(
          `Bulk schedule adjustment errors${batchId ? ` (batch: ${batchId})` : ''}:`,
          result.errors,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing bulk schedule changes${batchId ? ` (batch: ${batchId})` : ''}:`,
        error,
      );
      throw error;
    }
  }
}
