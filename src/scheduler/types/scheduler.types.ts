/**
 * Status of a scheduled job
 */
export type JobStatus =
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Types of schedule operations
 */
export type ScheduleOperation = 'create' | 'update' | 'cancel' | 'execute';

/**
 * Phase transition states
 */
export type PhaseState = 'START' | 'END';

/**
 * Scheduler error types
 */
export enum SchedulerErrorType {
  INVALID_SCHEDULE_TIME = 'INVALID_SCHEDULE_TIME',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  SCHEDULING_FAILED = 'SCHEDULING_FAILED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  CANCELLATION_FAILED = 'CANCELLATION_FAILED',
  INVALID_PHASE_DATA = 'INVALID_PHASE_DATA',
  PAST_SCHEDULE_TIME = 'PAST_SCHEDULE_TIME',
  DUPLICATE_JOB = 'DUPLICATE_JOB',
}

/**
 * Scheduler error details
 */
export interface SchedulerError {
  type: SchedulerErrorType;
  message: string;
  jobId?: string;
  phaseId?: number;
  projectId?: number;
  timestamp: Date;
  originalError?: Error;
}

/**
 * Job execution result
 */
export interface JobExecutionResult {
  success: boolean;
  jobId: string;
  executedAt: Date;
  error?: SchedulerError;
  retryCount: number;
}

/**
 * Scheduler configuration options
 */
export interface SchedulerConfig {
  maxRetries: number;
  retryDelay: number;
  jobTimeout: number;
  cleanupInterval: number;
  enableMetrics: boolean;
}

/**
 * Scheduler metrics
 */
export interface SchedulerMetrics {
  totalJobsScheduled: number;
  totalJobsExecuted: number;
  totalJobsFailed: number;
  totalJobsCancelled: number;
  activeJobsCount: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
}
