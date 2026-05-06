import { IsString } from "class-validator";

export class ExportScheduleMspDto {
  @IsString()
  tenantId!: string;
}
