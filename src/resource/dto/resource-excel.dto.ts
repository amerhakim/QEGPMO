import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreateAllocationDto, CreateCapacityPlanDto } from "./capacity-allocation.dto";
import { CreateResourceDto } from "./create-resource.dto";
import { AssignResourceSkillDto, CreateSkillDto } from "./create-role-skill.dto";

export class ResourceImportPreviewDto {
  @IsString()
  tenantId!: string;

  @IsString()
  entityName!: "RESOURCE" | "SKILL" | "ALLOCATION" | "CAPACITY";

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResourceDto)
  resources?: CreateResourceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkillDto)
  skills?: CreateSkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignResourceSkillDto)
  resourceSkills?: AssignResourceSkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAllocationDto)
  allocations?: CreateAllocationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCapacityPlanDto)
  capacityPlans?: CreateCapacityPlanDto[];
}

export class ResourceImportCommitDto {
  @IsString()
  tenantId!: string;
}

export class ResourceExportDto {
  @IsString()
  tenantId!: string;

  @IsString()
  entityName!: "RESOURCE" | "SKILL" | "ALLOCATION" | "CAPACITY";
}
