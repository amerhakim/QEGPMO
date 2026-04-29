import { IsOptional, IsString } from "class-validator";

export class FinancialImportPreviewDto {
  @IsString()
  tenantId!: string;

  @IsString()
  entityName!: "BUDGET" | "FORECAST" | "ACTUAL_COST" | "SUMMARY";

  @IsString()
  fileName!: string;

  // Keep generic to match global mapping-profile approach
  payload!: unknown[];
}

export class FinancialImportCommitDto {
  @IsString()
  tenantId!: string;
}

export class FinancialExportDto {
  @IsString()
  tenantId!: string;

  @IsString()
  entityName!: "BUDGET" | "FORECAST" | "ACTUAL_COST" | "SUMMARY";

  @IsOptional()
  @IsString()
  period?: string;
}
