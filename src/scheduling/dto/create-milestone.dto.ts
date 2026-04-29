import { IsDateString, IsOptional, IsString, IsNumber } from "class-validator";

export class CreateMilestoneDto {
  @IsString()
  tenantId!: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsDateString()
  plannedDate!: string;

  @IsOptional()
  @IsNumber()
  msProjectTaskUid?: number;
}
