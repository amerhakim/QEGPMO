import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export type WeeklyStatusExportFormatAllowed = "XLSX" | "PDF" | "PPTX";

export class ExportWeeklyStatusReportDto {
  @IsString()
  tenantId!: string;

  @IsIn(["XLSX", "PDF", "PPTX"])
  format!: WeeklyStatusExportFormatAllowed;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revisionNumber?: number;

  /** When true, exports latest draft revision even if the report is published. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  useDraft?: boolean;
}
