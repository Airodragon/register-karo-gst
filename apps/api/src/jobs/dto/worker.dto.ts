import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApplicationStatus, ApplicationStep } from '@prisma/client';

export class AutomationProgressDto {
  @IsNumber()
  percent!: number;

  @IsString()
  phase!: string;

  @IsString()
  label!: string;

  @IsString()
  updatedAt!: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class WorkerUpdateDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsEnum(ApplicationStep)
  currentStep?: ApplicationStep;

  @IsOptional()
  @IsString()
  trn?: string;

  @IsOptional()
  @IsString()
  trnExpiresAt?: string;

  @IsOptional()
  @IsString()
  arn?: string;

  @IsOptional()
  @IsString()
  pendingInput?: string | null;

  @IsOptional()
  @IsObject()
  pendingInputData?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  portalSession?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  errorLog?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutomationProgressDto)
  automationProgress?: AutomationProgressDto;
}

export class WorkerCompleteDto {
  @IsBoolean()
  success!: boolean;

  @IsOptional()
  @IsString()
  error?: string;
}
