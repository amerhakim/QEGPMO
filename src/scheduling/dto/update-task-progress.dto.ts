import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateTaskProgressDto {
  @IsString()
  tenantId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualEffortHours?: number;

  @IsOptional()
  @IsDateString()
  progressDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
