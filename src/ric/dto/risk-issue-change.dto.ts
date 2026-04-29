import { ActionType, FinancialObjectType, RecordStatus, SeverityLevel } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateRiskDto {
  @IsString()
  tenantId!: string;
  @IsEnum(FinancialObjectType)
  objectType!: FinancialObjectType;
  @IsString()
  objectId!: string;
  @IsString()
  title!: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  category?: string;
  @Type(() => Number)
  @Min(0)
  @Max(1)
  probability!: number;
  @Type(() => Number)
  @Min(0)
  @Max(1)
  impact!: number;
  @IsEnum(SeverityLevel)
  severity!: SeverityLevel;
  @IsString()
  ownerId!: string;
  @IsOptional()
  @IsDateString()
  reviewDate?: string;
}

export class CreateIssueDto {
  @IsString()
  tenantId!: string;
  @IsEnum(FinancialObjectType)
  objectType!: FinancialObjectType;
  @IsString()
  objectId!: string;
  @IsString()
  title!: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsEnum(SeverityLevel)
  severity!: SeverityLevel;
  @IsString()
  ownerId!: string;
  @IsOptional()
  @IsDateString()
  targetResolutionDate?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  escalationSlaDays?: number;
}

export class CreateChangeRequestDto {
  @IsString()
  tenantId!: string;
  @IsEnum(FinancialObjectType)
  objectType!: FinancialObjectType;
  @IsString()
  objectId!: string;
  @IsString()
  title!: string;
  @IsOptional()
  @IsString()
  description?: string;
  @Type(() => Number)
  @Min(0)
  scopeImpact!: number;
  @Type(() => Number)
  @Min(0)
  scheduleImpactDays!: number;
  @Type(() => Number)
  @Min(0)
  costImpact!: number;
  @Type(() => Number)
  @Min(0)
  resourceImpactHours!: number;
}

export class CreateRicActionDto {
  @IsString()
  tenantId!: string;
  @IsEnum(ActionType)
  actionType!: ActionType;
  @IsOptional()
  @IsString()
  riskId?: string;
  @IsOptional()
  @IsString()
  issueId?: string;
  @IsString()
  title!: string;
  @IsString()
  ownerId!: string;
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateRecordStatusDto {
  @IsString()
  tenantId!: string;
  @IsEnum(RecordStatus)
  status!: RecordStatus;
}
