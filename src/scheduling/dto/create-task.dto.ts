import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { TaskStatus } from "@prisma/client";

export class CreateTaskDto {
  @IsString()
  tenantId!: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsString()
  wbsCode!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  plannedStartDate!: string;

  @IsDateString()
  plannedEndDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedEffortHours!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  msProjectTaskUid?: number;

  @IsOptional()
  @IsString()
  msProjectOutlineNumber?: string;

  @IsOptional()
  @IsBoolean()
  isMilestone?: boolean;

  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualEffortHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  /// When importing external schedules, caller may set explicit lifecycle status (otherwise derived from progress).
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
