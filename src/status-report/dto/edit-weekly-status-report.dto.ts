import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

export class EditWeeklyStatusReportDto {
  @IsString()
  tenantId!: string;

  /** Partial or full editor payload (validated in service). */
  @IsObject()
  editorContent!: Record<string, unknown>;

  /** Optimistic concurrency: required revision number this edit builds upon. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseRevisionNumber?: number;
}
