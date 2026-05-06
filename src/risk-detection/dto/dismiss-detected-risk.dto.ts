import { IsOptional, IsString } from "class-validator";

export class DismissDetectedRiskSuggestionDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
