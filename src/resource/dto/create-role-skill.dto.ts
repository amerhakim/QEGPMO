import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateResourceRoleDto {
  @IsString()
  tenantId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultRate?: number;
}

export class CreateSkillDto {
  @IsString()
  tenantId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class AssignResourceSkillDto {
  @IsString()
  tenantId!: string;

  @IsString()
  resourceId!: string;

  @IsString()
  skillId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  proficiencyLevel!: number;
}
