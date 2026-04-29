import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class ProjectImportRowDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  portfolioCode!: string;

  @IsOptional()
  @IsString()
  programCode?: string;

  @IsString()
  projectManagerId!: string;

  @IsString()
  initialPhaseCode!: string;

  @IsString()
  plannedStartDate!: string;

  @IsString()
  plannedEndDate!: string;

  @IsString()
  plannedBudget!: string;
}

export class ImportProjectsDto {
  @IsString()
  tenantId!: string;

  @IsString()
  fileName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectImportRowDto)
  rows!: ProjectImportRowDto[];
}

export class ExportProjectsDto {
  @IsString()
  tenantId!: string;
}
