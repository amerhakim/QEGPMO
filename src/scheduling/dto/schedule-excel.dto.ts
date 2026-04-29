import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreateTaskDto } from "./create-task.dto";

export class ImportScheduleDto {
  @IsString()
  tenantId!: string;

  @IsString()
  projectId!: string;

  @IsString()
  fileName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks!: CreateTaskDto[];
}

export class CommitScheduleImportDto {
  @IsString()
  tenantId!: string;
}

export class ExportScheduleDto {
  @IsString()
  tenantId!: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  formatHint?: string;
}
