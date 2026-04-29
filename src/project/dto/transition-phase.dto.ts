import { IsString } from "class-validator";

export class TransitionPhaseDto {
  @IsString()
  tenantId!: string;

  @IsString()
  targetPhaseCode!: string;
}
