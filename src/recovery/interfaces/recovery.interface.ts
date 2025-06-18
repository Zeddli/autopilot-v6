import { PhaseState } from '../../scheduler/types/scheduler.types';

/**
 * Interface for the RecoveryService
 * Defines the contract for startup recovery operations
 */
export interface IRecoveryService {
  /**
   * Execute the complete startup recovery process
   * This is the main entry point called on application startup
   * @returns Promise<void>
   */
  executeStartupRecovery(): Promise<void>;

  /**
   * Scan for all active phases that need scheduling
   * Fetches data from challenge service and filters relevant phases
   * @returns Promise<PhaseData[]> - Array of active phases
   */
  scanActivePhases(): Promise<PhaseData[]>;

  /**
   * Schedule upcoming phase transitions
   * Processes phases with future end times and schedules them
   * @param phases - Array of phase data to schedule
   * @returns Promise<void>
   */
  scheduleUpcomingTransitions(phases: PhaseData[]): Promise<void>;

  /**
   * Process phases that are overdue (past their end time)
   * Immediately triggers phase transitions for overdue phases
   * @param phases - Array of overdue phase data
   * @returns Promise<void>
   */
  processOverduePhases(phases: PhaseData[]): Promise<void>;
}

/**
 * Interface representing phase data for recovery operations
 * Contains all necessary information to schedule or process a phase transition
 */
export interface PhaseData {
  /** Unique identifier for the project/challenge */
  projectId: number;

  /** Unique identifier for the phase */
  phaseId: number;

  /** Name of the phase type (e.g., 'Submission', 'Review', 'Final Fix') */
  phaseTypeName: string;

  /** Current state of the phase */
  state: PhaseState;

  /** Phase end time (when transition should occur) */
  endTime: Date;

  /** Current status of the project */
  projectStatus: string;

  /** Operator/system initiating the recovery */
  operator: string;

  /** Additional metadata for the phase */
  metadata?: Record<string, any>;
}

/**
 * Interface representing the result of a recovery operation
 * Provides detailed information about what was recovered and any errors
 */
export interface RecoveryResult {
  /** Whether the recovery was successful overall */
  success: boolean;

  /** Number of phases that were successfully scheduled */
  scheduledCount: number;

  /** Number of overdue phases that were processed */
  processedCount: number;

  /** Number of phases that were skipped (invalid data, etc.) */
  skippedCount: number;

  /** Array of error messages if any occurred */
  errors: string[];

  /** Detailed breakdown of recovery operations */
  details: {
    /** Phase IDs that were scheduled */
    scheduled: number[];

    /** Phase IDs that were processed as overdue */
    processed: number[];

    /** Phase IDs that were skipped with reasons */
    skipped: Array<{
      phaseId: number;
      reason: string;
    }>;
  };

  /** Total time taken for recovery operation */
  duration: number;

  /** Number of phases examined during recovery */
  totalExamined: number;
}

/**
 * Interface for recovery configuration options
 * Allows customization of recovery behavior
 */
export interface RecoveryOptions {
  /** Maximum number of phases to process in parallel */
  maxConcurrentPhases?: number;

  /** Timeout for individual phase operations (in ms) */
  phaseOperationTimeout?: number;

  /** Whether to process overdue phases immediately */
  processOverduePhases?: boolean;

  /** Whether to skip phases with invalid data */
  skipInvalidPhases?: boolean;

  /** Maximum age of phases to consider for recovery (in hours) */
  maxPhaseAge?: number;
}

/**
 * Interface for recovery metrics and monitoring
 * Provides data for health checks and monitoring
 */
export interface RecoveryMetrics {
  /** Timestamp of last successful recovery */
  lastRecoveryTime: Date;

  /** Duration of last recovery operation */
  lastRecoveryDuration: number;

  /** Number of phases recovered in last operation */
  lastRecoveryCount: number;

  /** Total number of recovery operations performed */
  totalRecoveryOperations: number;

  /** Number of failed recovery operations */
  failedRecoveryOperations: number;

  /** Current recovery status */
  status: RecoveryStatus;
}

/**
 * Enum for recovery operation status
 */
export enum RecoveryStatus {
  /** Recovery has not been executed yet */
  NOT_STARTED = 'NOT_STARTED',

  /** Recovery is currently in progress */
  IN_PROGRESS = 'IN_PROGRESS',

  /** Recovery completed successfully */
  COMPLETED = 'COMPLETED',

  /** Recovery completed with some errors */
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',

  /** Recovery failed */
  FAILED = 'FAILED',

  /** Recovery is disabled */
  DISABLED = 'DISABLED',
}

/**
 * Interface for phase filtering criteria
 * Used to determine which phases should be included in recovery
 */
export interface PhaseFilterCriteria {
  /** Only include phases with these states */
  allowedStates?: PhaseState[];

  /** Only include phases with these project statuses */
  allowedProjectStatuses?: string[];

  /** Exclude phases older than this date */
  minCreatedDate?: string;

  /** Exclude phases newer than this date */
  maxCreatedDate?: string;

  /** Only include phases with end times after this date */
  minEndTime?: string;

  /** Only include phases with end times before this date */
  maxEndTime?: string;
}
