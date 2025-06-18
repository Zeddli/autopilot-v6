import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PhaseState } from '../../scheduler/types/scheduler.types';
import { RecoveryStatus } from '../interfaces/recovery.interface';

/**
 * DTO for phase data used in recovery operations
 * Represents a single phase that needs to be recovered/scheduled
 */
export class RecoveryPhaseDto {
  /**
   * Unique identifier for the project/challenge
   * @example 123456
   */
  @IsNumber()
  @Min(1)
  projectId: number;

  /**
   * Unique identifier for the phase
   * @example 789012
   */
  @IsNumber()
  @Min(1)
  phaseId: number;

  /**
   * Name of the phase type
   * @example "Submission"
   */
  @IsString()
  phaseTypeName: string;

  /**
   * Current state of the phase
   * @example "START"
   */
  @IsString()
  state: PhaseState;

  /**
   * Phase end time (when transition should occur)
   * @example "2024-12-25T10:00:00.000Z"
   */
  @IsDateString()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : String(value),
  )
  endTime: string;

  /**
   * Current status of the project
   * @example "ACTIVE"
   */
  @IsString()
  projectStatus: string;

  /**
   * Operator/system initiating the recovery
   * @example "autopilot-recovery"
   */
  @IsString()
  operator: string;

  /**
   * Additional metadata for the phase
   * @example { "priority": "high", "category": "development" }
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO for recovery operation configuration
 * Allows customization of recovery behavior
 */
export class RecoveryOptionsDto {
  /**
   * Maximum number of phases to process in parallel
   * @example 10
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxConcurrentPhases?: number = 10;

  /**
   * Timeout for individual phase operations (in milliseconds)
   * @example 30000
   */
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  phaseOperationTimeout?: number = 30000;

  /**
   * Whether to process overdue phases immediately
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  processOverduePhases?: boolean = true;

  /**
   * Whether to skip phases with invalid data
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  skipInvalidPhases?: boolean = true;

  /**
   * Maximum age of phases to consider for recovery (in hours)
   * @example 72
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8760) // 1 year
  maxPhaseAge?: number = 72;
}

/**
 * DTO for recovery result information
 * Provides detailed information about recovery operation results
 */
export class RecoveryResultDto {
  /**
   * Whether the recovery was successful overall
   * @example true
   */
  @IsBoolean()
  success: boolean;

  /**
   * Number of phases that were successfully scheduled
   * @example 15
   */
  @IsNumber()
  @Min(0)
  scheduledCount: number;

  /**
   * Number of overdue phases that were processed
   * @example 3
   */
  @IsNumber()
  @Min(0)
  processedCount: number;

  /**
   * Number of phases that were skipped
   * @example 2
   */
  @IsNumber()
  @Min(0)
  skippedCount: number;

  /**
   * Array of error messages if any occurred
   * @example ["Failed to schedule phase 123", "Invalid end time for phase 456"]
   */
  @IsArray()
  @IsString({ each: true })
  errors: string[];

  /**
   * Total time taken for recovery operation (in milliseconds)
   * @example 5432
   */
  @IsNumber()
  @Min(0)
  duration: number;

  /**
   * Number of phases examined during recovery
   * @example 20
   */
  @IsNumber()
  @Min(0)
  totalExamined: number;
}

/**
 * DTO for recovery metrics and monitoring data
 * Provides monitoring information for health checks
 */
export class RecoveryMetricsDto {
  /**
   * Timestamp of last successful recovery
   * @example "2024-12-25T09:30:00.000Z"
   */
  @IsDateString()
  lastRecoveryTime: string;

  /**
   * Duration of last recovery operation (in milliseconds)
   * @example 4567
   */
  @IsNumber()
  @Min(0)
  lastRecoveryDuration: number;

  /**
   * Number of phases recovered in last operation
   * @example 18
   */
  @IsNumber()
  @Min(0)
  lastRecoveryCount: number;

  /**
   * Total number of recovery operations performed
   * @example 42
   */
  @IsNumber()
  @Min(0)
  totalRecoveryOperations: number;

  /**
   * Number of failed recovery operations
   * @example 2
   */
  @IsNumber()
  @Min(0)
  failedRecoveryOperations: number;

  /**
   * Current recovery status
   * @example "COMPLETED"
   */
  @IsEnum(RecoveryStatus)
  status: RecoveryStatus;
}

/**
 * DTO for phase filtering criteria
 * Used to specify which phases should be included in recovery
 */
export class PhaseFilterCriteriaDto {
  /**
   * Only include phases with these states
   * @example ["START", "END"]
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedStates?: PhaseState[];

  /**
   * Only include phases with these project statuses
   * @example ["ACTIVE", "DRAFT"]
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProjectStatuses?: string[];

  /**
   * Exclude phases older than this date
   * @example "2024-12-01T00:00:00.000Z"
   */
  @IsOptional()
  @IsDateString()
  minCreatedDate?: string;

  /**
   * Exclude phases newer than this date
   * @example "2024-12-31T23:59:59.999Z"
   */
  @IsOptional()
  @IsDateString()
  maxCreatedDate?: string;

  /**
   * Only include phases with end times after this date
   * @example "2024-12-25T00:00:00.000Z"
   */
  @IsOptional()
  @IsDateString()
  minEndTime?: string;

  /**
   * Only include phases with end times before this date
   * @example "2025-01-31T23:59:59.999Z"
   */
  @IsOptional()
  @IsDateString()
  maxEndTime?: string;
}

/**
 * DTO for bulk recovery operations
 * Used when processing multiple phases in a single operation
 */
export class BulkRecoveryDto {
  /**
   * Array of phases to recover
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecoveryPhaseDto)
  phases: RecoveryPhaseDto[];

  /**
   * Recovery configuration options
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => RecoveryOptionsDto)
  options?: RecoveryOptionsDto;

  /**
   * Batch identifier for tracking
   * @example "recovery-batch-20241225-093000"
   */
  @IsOptional()
  @IsString()
  batchId?: string;
}

/**
 * DTO for recovery status query parameters
 * Used for health check and status endpoints
 */
export class RecoveryStatusQueryDto {
  /**
   * Include detailed recovery information
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDetails?: boolean = false;

  /**
   * Include recovery metrics
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeMetrics?: boolean = false;

  /**
   * Include recent errors
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeErrors?: boolean = false;
}
