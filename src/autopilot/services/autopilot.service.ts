import { Injectable, Logger } from '@nestjs/common';
import {
  PhaseTransitionPayload,
  ChallengeUpdatePayload,
  CommandPayload,
} from '../interfaces/autopilot.interface';
import { SchedulerService } from '../../scheduler/services/scheduler.service';
import { PhaseTransitionScheduleDto } from '../../scheduler/dto/phase-transition-schedule.dto';
import { ChallengeUpdateHandler } from '../handlers/challenge-update.handler';

@Injectable()
export class AutopilotService {
  private readonly logger = new Logger(AutopilotService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly challengeUpdateHandler: ChallengeUpdateHandler,
  ) {}

  async handlePhaseTransition(message: PhaseTransitionPayload): Promise<void> {
    this.logger.log(`Handling phase transition: ${JSON.stringify(message)}`);

    // Small delay to make this properly async and avoid linting error
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      // For incoming phase transition messages, we can use them to trigger scheduling
      // This could be for scheduling the END transition when we receive a START transition
      if (message.state === 'START' && message.date) {
        // Example: If this is a START transition and we have phase end time data,
        // we could schedule the END transition
        this.logger.log(
          `Phase ${message.phaseId} started for project ${message.projectId}. Could schedule END transition if end time is available.`,
        );

        // In a real implementation, we would:
        // 1. Fetch phase end time from challenge service
        // 2. Schedule the END transition using schedulerService
        // For now, we'll just log this capability

        // Example scheduling (commented out as we don't have actual end times):
        /*
        const scheduleDto: PhaseTransitionScheduleDto = {
          projectId: message.projectId,
          phaseId: message.phaseId,
          phaseTypeName: message.phaseTypeName,
          state: 'END',
          endTime: phaseEndTime, // Would come from challenge service
          operator: message.operator,
          projectStatus: message.projectStatus,
          date: new Date().toISOString(),
        };
        
        const jobId = await this.schedulerService.schedulePhaseTransition(scheduleDto);
        this.logger.log(`Scheduled END transition for phase ${message.phaseId}, job ID: ${jobId}`);
        */
      }

      // Handle immediate phase transitions (when they should happen now)
      if (message.state === 'END') {
        this.logger.log(
          `Processing END transition for phase ${message.phaseId} in project ${message.projectId}`,
        );
        // This is where we would implement the actual phase transition logic
      }
    } catch (error) {
      this.logger.error(
        `Error handling phase transition for phase ${message.phaseId}:`,
        error,
      );
      throw error;
    }
  }

  async handleChallengeUpdate(message: ChallengeUpdatePayload): Promise<void> {
    this.logger.log(`Handling challenge update: ${JSON.stringify(message)}`);

    // Small delay to make this properly async and avoid linting error
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      // Use the ChallengeUpdateHandler to process schedule adjustments
      await this.challengeUpdateHandler.handleChallengeUpdate(message);

      this.logger.log(
        `Challenge update processing completed for project ${message.projectId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling challenge update for project ${message.projectId}:`,
        error,
      );
      throw error;
    }
  }

  async handleCommand(message: CommandPayload): Promise<void> {
    this.logger.log(`Handling command: ${JSON.stringify(message)}`);

    try {
      // Commands could include scheduler-related operations
      switch (message.command.toLowerCase()) {
        case 'schedule_phase_transition':
          this.logger.log('Received schedule phase transition command');
          // Implementation would extract phase data from command parameters
          // and call schedulerService.schedulePhaseTransition()
          break;

        case 'cancel_scheduled_transition':
          this.logger.log('Received cancel scheduled transition command');
          // Implementation would extract job ID from command parameters
          // and call schedulerService.cancelScheduledTransition()
          break;

        case 'list_scheduled_transitions': {
          this.logger.log('Received list scheduled transitions command');
          const transitions =
            await this.schedulerService.getAllScheduledTransitions();
          this.logger.log(
            `Currently scheduled transitions: ${transitions.length}`,
          );
          break;
        }

        default:
          this.logger.log(`Unknown command: ${message.command}`);
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling command ${message.command}:`, error);
      throw error;
    }
  }

  /**
   * Helper method to schedule a phase transition
   * This can be called by other services or during recovery
   */
  async schedulePhaseTransition(
    projectId: number,
    phaseId: number,
    phaseTypeName: string,
    state: 'START' | 'END',
    endTime: string,
    operator: string,
    projectStatus: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    this.logger.log(
      `Scheduling ${state} transition for phase ${phaseId} in project ${projectId}`,
    );

    try {
      const scheduleDto: PhaseTransitionScheduleDto = {
        projectId,
        phaseId,
        phaseTypeName,
        state,
        endTime,
        operator,
        projectStatus,
        date: new Date().toISOString(),
        metadata,
      };

      const jobId =
        await this.schedulerService.schedulePhaseTransition(scheduleDto);
      this.logger.log(
        `Successfully scheduled ${state} transition for phase ${phaseId}, job ID: ${jobId}`,
      );

      return jobId;
    } catch (error) {
      this.logger.error(
        `Failed to schedule ${state} transition for phase ${phaseId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper method to cancel a scheduled phase transition
   */
  async cancelScheduledTransition(jobId: string): Promise<boolean> {
    this.logger.log(`Cancelling scheduled transition: ${jobId}`);

    try {
      const cancelled =
        await this.schedulerService.cancelScheduledTransition(jobId);
      if (cancelled) {
        this.logger.log(
          `Successfully cancelled scheduled transition: ${jobId}`,
        );
      } else {
        this.logger.warn(
          `Could not cancel scheduled transition (not found): ${jobId}`,
        );
      }
      return cancelled;
    } catch (error) {
      this.logger.error(
        `Failed to cancel scheduled transition ${jobId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper method to get all scheduled transitions
   */
  async getScheduledTransitions() {
    try {
      const transitions =
        await this.schedulerService.getAllScheduledTransitions();
      this.logger.log(`Retrieved ${transitions.length} scheduled transitions`);
      return transitions;
    } catch (error) {
      this.logger.error('Failed to retrieve scheduled transitions:', error);
      throw error;
    }
  }
}
