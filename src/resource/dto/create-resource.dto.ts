import { ResourceStatus, ResourceType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateResourceDto {
  @IsString()
  tenantId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(ResourceType)
  type!: ResourceType;

  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  standardCapacityHoursPerDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  overAllocationThresholdPercent?: number;
}
