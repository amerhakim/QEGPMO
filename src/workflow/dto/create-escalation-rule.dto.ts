import { EscalationAction } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateEscalationRuleDto {
  @IsString()
  tenantId!: string;

  @IsString()
  workflowCode!: string;

  @IsString()
  stepCode!: string;

  @IsInt()
  @Min(1)
  escalateAfterMinutes!: number;

  @IsString()
  escalationRole!: string;

  @IsOptional()
  @IsEnum(EscalationAction)
  action?: EscalationAction;
}
