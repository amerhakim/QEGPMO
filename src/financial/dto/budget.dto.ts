import { BudgetCategory, FinancialObjectType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateBudgetDto {
  @IsString()
  tenantId!: string;

  @IsEnum(FinancialObjectType)
  objectType!: FinancialObjectType;

  @IsString()
  objectId!: string;

  @IsString()
  fiscalPeriod!: string;

  @IsEnum(BudgetCategory)
  category!: BudgetCategory;

  @Type(() => Number)
  @Min(0)
  plannedAmount!: number;

  @Type(() => Number)
  @Min(0)
  approvedAmount!: number;
}

export class CreateBudgetBaselineDto {
  @IsString()
  tenantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  baselineVersion!: number;

  @Type(() => Number)
  @Min(0)
  baselineAmount!: number;
}

export class CreateForecastDto {
  @IsString()
  tenantId!: string;

  @IsString()
  forecastPeriod!: string;

  @Type(() => Number)
  @Min(0)
  estimateToComplete!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  estimateAtCompletion?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateActualCostDto {
  @IsString()
  tenantId!: string;

  @IsString()
  postingPeriod!: string;

  @IsString()
  postingDate!: string;

  @Type(() => Number)
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  sourceReference?: string;
}

export class ComputeFinancialSummaryDto {
  @IsString()
  tenantId!: string;

  @IsEnum(FinancialObjectType)
  objectType!: FinancialObjectType;

  @IsString()
  objectId!: string;

  @IsString()
  period!: string;
}
