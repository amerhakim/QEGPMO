import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateCapacityPlanDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  availableHours!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  thresholdPercent?: number;
}

export class CreateAllocationDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsString()
  objectType!: string;

  @IsString()
  objectId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocationPercent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedHours!: number;
}

export class ApproveAllocationDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedHours?: number;
}
