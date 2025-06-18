import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for a single phase schedule change
 */
export class PhaseScheduleChangeDto {
  @IsNumber()
  @Min(1)
  projectId: number;

  @IsNumber()
  @Min(1)
  phaseId: number;

  @IsString()
  phaseTypeName: string;

  @IsOptional()
  @IsDateString()
  oldEndTime?: string;

  @IsDateString()
  newEndTime: string;

  @IsString()
  operator: string;

  @IsString()
  projectStatus: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}

/**
 * DTO for bulk schedule update operations
 */
export class BulkScheduleUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseScheduleChangeDto)
  changes: PhaseScheduleChangeDto[];

  @IsString()
  operator: string;

  @IsOptional()
  @IsString()
  updateReason?: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}

/**
 * DTO for challenge update that affects scheduling
 */
export class ChallengeScheduleUpdateDto {
  @IsNumber()
  @Min(1)
  projectId: number;

  @IsString()
  operator: string;

  @IsEnum(['ACTIVE', 'CANCELLED', 'COMPLETED', 'DRAFT'])
  projectStatus: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseInfoDto)
  phases: PhaseInfoDto[];

  @IsOptional()
  @IsString()
  updateReason?: string;
}

/**
 * DTO for phase information in challenge updates
 */
export class PhaseInfoDto {
  @IsNumber()
  @Min(1)
  phaseId: number;

  @IsString()
  phaseTypeName: string;

  @IsDateString()
  endTime: string;

  @IsEnum(['ACTIVE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'])
  phaseStatus: string;
}

/**
 * DTO for schedule adjustment results
 */
export class ScheduleAdjustmentResultDto {
  @IsNumber()
  adjustedCount: number;

  @IsNumber()
  cancelledCount: number;

  @IsNumber()
  rescheduledCount: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];

  details: {
    cancelled: string[];
    rescheduled: Array<{
      oldJobId: string;
      newJobId: string;
      phaseId: number;
    }>;
  };
}

/**
 * DTO for schedule change detection request
 */
export class ScheduleChangeDetectionDto {
  @IsNumber()
  @Min(1)
  projectId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhaseInfoDto)
  currentPhases: PhaseInfoDto[];

  @IsString()
  operator: string;
}
