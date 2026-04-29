import { FinancialObjectType } from "@prisma/client";
import { IsOptional, IsString } from "class-validator";

export class RicImportPreviewDto {
  @IsString()
  tenantId!: string;
  @IsString()
  entityName!: "RISK" | "ISSUE" | "CHANGE_REQUEST" | "MITIGATION_ACTION";
  @IsString()
  fileName!: string;
  payload!: unknown[];
}

export class RicImportCommitDto {
  @IsString()
  tenantId!: string;
}

export class RicExportDto {
  @IsString()
  tenantId!: string;
  @IsString()
  entityName!: "RISK" | "ISSUE" | "CHANGE_REQUEST" | "MITIGATION_ACTION" | "ROLLUP";
  @IsOptional()
  @IsString()
  period?: string;
  @IsOptional()
  objectType?: FinancialObjectType;
  @IsOptional()
  @IsString()
  objectId?: string;
}
