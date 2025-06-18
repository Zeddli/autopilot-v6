import {
  IsString,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
} from 'class-validator';
import { JobStatus, PhaseState } from '../types/scheduler.types';

/**
 * DTO for information about a scheduled transition
 */
export class ScheduledTransitionInfo {
  @IsString()
  jobId: string;

  @IsNumber()
  projectId: number;

  @IsNumber()
  phaseId: number;

  @IsString()
  phaseTypeName: string;

  @IsEnum(['START', 'END'])
  state: PhaseState;

  @IsDateString()
  scheduledTime: string;

  @IsDateString()
  createdAt: string;

  @IsEnum(['scheduled', 'running', 'completed', 'failed', 'cancelled'])
  status: JobStatus;

  @IsString()
  operator: string;

  @IsString()
  projectStatus: string;

  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @IsOptional()
  @IsString()
  lastError?: string;

  @IsOptional()
  @IsDateString()
  lastExecutionAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO for paginated list of scheduled transitions
 */
export class ScheduledTransitionListDto {
  @IsNumber()
  total: number;

  @IsNumber()
  page: number;

  @IsNumber()
  limit: number;

  items: ScheduledTransitionInfo[];
}

/**
 * DTO for scheduled transition query parameters
 */
export class ScheduledTransitionQueryDto {
  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsNumber()
  phaseId?: number;

  @IsOptional()
  @IsEnum(['scheduled', 'running', 'completed', 'failed', 'cancelled'])
  status?: JobStatus;

  @IsOptional()
  @IsEnum(['START', 'END'])
  state?: PhaseState;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
