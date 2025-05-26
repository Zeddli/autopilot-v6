import {
  IsString,
  IsNumber,
  IsEnum,
  IsObject,
  IsDateString,
} from 'class-validator';

export class PhaseTransitionDto {
  @IsDateString()
  date: string;

  @IsNumber()
  projectId: number;

  @IsNumber()
  phaseId: number;

  @IsString()
  phaseTypeName: string;

  @IsEnum(['START', 'END'])
  state: 'START' | 'END';

  @IsString()
  operator: string;

  @IsString()
  projectStatus: string;
}

export class ChallengeUpdateDto {
  @IsDateString()
  date: string;

  @IsNumber()
  challengeId: number;

  @IsString()
  status: string;

  @IsString()
  operator: string;
}

export class CommandDto {
  @IsDateString()
  date: string;

  @IsString()
  commandId: string;

  @IsString()
  type: string;

  @IsObject()
  parameters: Record<string, any>;

  @IsString()
  operator: string;
}
