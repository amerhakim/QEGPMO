import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class CreateWorkflowStepDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsString()
  approverRole!: string;

  @IsInt()
  @Min(1)
  requiredApprovals!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

export class CreateWorkflowDefinitionDto {
  @IsString()
  tenantId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  entityType!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps!: CreateWorkflowStepDto[];
}
