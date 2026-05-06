import { FinancialObjectType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class ComputeScheduleRollupDto {
  @IsString()
  tenantId!: string;

  @IsEnum(FinancialObjectType)
  objectType!: FinancialObjectType;

  /** Project / Program / Portfolio id, or tenant id when objectType is ENTERPRISE. */
  @IsString()
  objectId!: string;

  /** Reporting bucket label (e.g. ISO week `2026-W18`) — aligns with executive dashboards. */
  @IsString()
  reportingPeriod!: string;

  /** Anchor date for baseline time-elapsed expected % (defaults to request time). */
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
