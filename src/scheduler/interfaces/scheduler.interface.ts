import { PhaseTransitionScheduleDto } from '../dto/phase-transition-schedule.dto';
import { ScheduledTransitionInfo } from '../dto/scheduled-transition-info.dto';

/**
 * Core interface for the scheduler service that manages dynamic job scheduling
 */
export interface ISchedulerService {
  /**
   * Schedule a phase transition event at a specific time
   * @param phaseData - Phase transition data including timing and metadata
   * @returns Promise<string> - Unique job ID for the scheduled transition
   */
  schedulePhaseTransition(
    phaseData: PhaseTransitionScheduleDto,
  ): Promise<string>;

  /**
   * Cancel a previously scheduled transition
   * @param jobId - Unique identifier for the scheduled job
   * @returns Promise<boolean> - Success status of cancellation
   */
  cancelScheduledTransition(jobId: string): Promise<boolean>;

  /**
   * Update an existing scheduled transition with new data
   * @param jobId - Unique identifier for the existing job
   * @param phaseData - Updated phase transition data
   * @returns Promise<string> - New job ID (may be different from original)
   */
  updateScheduledTransition(
    jobId: string,
    phaseData: PhaseTransitionScheduleDto,
  ): Promise<string>;

  /**
   * Get all currently scheduled transitions
   * @returns Promise<ScheduledTransitionInfo[]> - List of all active scheduled jobs
   */
  getAllScheduledTransitions(): Promise<ScheduledTransitionInfo[]>;
}

/**
 * Interface for phase data retrieved during recovery operations
 */
export interface PhaseData {
  projectId: number;
  phaseId: number;
  phaseTypeName: string;
  endTime: Date;
  state: 'START' | 'END';
  projectStatus: string;
  operator: string;
}

/**
 * Interface for job execution callback
 */
export interface JobExecutionCallback {
  (): Promise<void>;
}

/**
 * Interface for job metadata tracking
 */
export interface JobMetadata {
  jobId: string;
  phaseData: PhaseTransitionScheduleDto;
  scheduledTime: Date;
  createdAt: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  retryCount?: number;
  lastError?: string;
}
