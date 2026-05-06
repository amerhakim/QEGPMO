import { FinancialObjectType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

export class GenerateWeeklyStatusReportDto {
  @IsString()
  tenantId!: string;

  @IsEnum(FinancialObjectType)
  scopeType!: FinancialObjectType;

  /** PROJECT id, PROGRAM id, PORTFOLIO id, or tenant id when scopeType is ENTERPRISE. */
  @IsString()
  scopeId!: string;

  @IsString()
  reportingWeek!: string;

  /** Defaults to reportingWeek; must align with FinancialSummary/RIC rollup periods. */
  @IsOptional()
  @IsString()
  fiscalPeriod?: string;

  /** When true, recomputes financial and RIC roll-ups if already present for the fiscal period. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  refreshMetrics?: boolean;
}
