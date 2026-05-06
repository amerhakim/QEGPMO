import { IsString } from "class-validator";

export class SubmitDetectedRiskSuggestionDto {
  @IsString()
  tenantId!: string;
}
