import {
  IsNumber,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PhaseState } from '../types/scheduler.types';

/**
 * DTO for scheduling a phase transition event
 */
export class PhaseTransitionScheduleDto {
  @IsNumber()
  @Min(1)
  projectId: number;

  @IsNumber()
  @Min(1)
  phaseId: number;

  @IsString()
  phaseTypeName: string;

  @IsEnum(['START', 'END'])
  state: PhaseState;

  @IsDateString()
  endTime: string;

  @IsString()
  operator: string;

  @IsString()
  projectStatus: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * DTO for bulk scheduling operations
 */
export class BulkPhaseTransitionScheduleDto {
  @ValidateNested({ each: true })
  @Type(() => PhaseTransitionScheduleDto)
  phases: PhaseTransitionScheduleDto[];

  @IsString()
  operator: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}
