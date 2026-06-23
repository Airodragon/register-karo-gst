import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStep, ApplicationStatus } from '@prisma/client';

export class CreateApplicationDto {
  @IsString()
  clientRef!: string;

  @IsEnum(['proprietorship', 'partnership', 'huf'])
  constitution!: 'proprietorship' | 'partnership' | 'huf';

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}

export class UpdateFormDataDto {
  @IsObject()
  formData!: Record<string, unknown>;
}

export class UpdateStepDto {
  @IsEnum(ApplicationStep)
  step!: ApplicationStep;
}

export class UserInputDto {
  @IsOptional()
  @IsString()
  captcha?: string;

  @IsOptional()
  @IsString()
  mobileOtp?: string;

  @IsOptional()
  @IsString()
  emailOtp?: string;

  @IsOptional()
  @IsString()
  otp?: string;

  @IsOptional()
  @IsString()
  aadhaarOtp?: string;
}

export class StartAutomationDto {
  @IsOptional()
  @IsString()
  fromStep?: string;

  @IsOptional()
  @IsBoolean()
  headless?: boolean;
}

export class ResumeAutomationDto {
  @IsOptional()
  @IsBoolean()
  headless?: boolean;
}

export class ListApplicationsQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['updatedAt', 'createdAt', 'trnExpiresAt'])
  sort?: 'updatedAt' | 'createdAt' | 'trnExpiresAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  attention?: string;
}
