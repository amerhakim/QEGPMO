import { IsBoolean, IsString } from "class-validator";

export class CommitMppImportDto {
  @IsString()
  tenantId!: string;

  /** Import MUST fail unless explicitly confirmed by the client after reviewing validationReport. */
  @IsBoolean()
  confirm!: boolean;
}
