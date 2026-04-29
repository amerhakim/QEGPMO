import { DependencyType } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateDependencyDto {
  @IsString()
  tenantId!: string;

  @IsString()
  projectId!: string;

  @IsString()
  predecessorTaskId!: string;

  @IsString()
  successorTaskId!: string;

  @IsOptional()
  @IsEnum(DependencyType)
  dependencyType?: DependencyType;

  @IsOptional()
  @IsNumber()
  lagDays?: number;

  @IsOptional()
  @IsNumber()
  msProjectLinkUid?: number;
}
