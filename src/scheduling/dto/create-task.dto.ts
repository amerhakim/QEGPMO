import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

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
}
