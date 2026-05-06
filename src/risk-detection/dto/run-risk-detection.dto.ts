import { FinancialObjectType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

export class RunRiskDetectionDto {
  @IsString()
  tenantId!: string;

  @IsEnum(FinancialObjectType)
  scopeType!: FinancialObjectType;

  @IsString()
  scopeId!: string;

  /** Aligns with FinancialSummary / RicRollupSummary period buckets (e.g. fiscal period or ISO week). */
  @IsString()
  periodLabel!: string;

  /** Registered-risk owner when the suggestion is promoted (defaults to runner). */
  @IsOptional()
  @IsString()
  proposedOwnerId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  refreshMetrics?: boolean;
}
