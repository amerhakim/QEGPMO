import { GateDecision } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";

export class GateDecisionDto {
  @IsString()
  tenantId!: string;

  @IsEnum(GateDecision)
  decision!: GateDecision;
}
