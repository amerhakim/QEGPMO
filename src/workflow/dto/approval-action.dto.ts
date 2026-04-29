import { ApprovalDecision } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class ApprovalActionDto {
  @IsString()
  tenantId!: string;

  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @IsOptional()
  @IsString()
  comments?: string;
}
