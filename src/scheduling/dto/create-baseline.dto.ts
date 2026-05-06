import { BaselineKind, BaselineScope } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateBaselineDto {
  @IsString()
  tenantId!: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsEnum(BaselineScope)
  scope!: BaselineScope;

  /** Defaults: version 1 → ORIGINAL; later versions → UPDATED (MSP-style). */
  @IsOptional()
  @IsEnum(BaselineKind)
  baselineKind?: BaselineKind;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  baselineVersion!: number;

  @IsDateString()
  plannedStartDate!: string;

  @IsDateString()
  plannedEndDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedEffortHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedCost?: number;
}
