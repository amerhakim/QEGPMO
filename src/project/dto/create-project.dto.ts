import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateProjectDto {
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
  projectManagerId!: string;

  @IsOptional()
  @IsString()
  sponsorId?: string;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsString()
  portfolioId!: string;

  @IsString()
  initialPhaseCode!: string;

  @IsDateString()
  plannedStartDate!: string;

  @IsDateString()
  plannedEndDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedBudget!: number;
}
