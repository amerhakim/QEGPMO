import { IsString } from "class-validator";

export class SubmitWeeklyStatusReportDto {
  @IsString()
  tenantId!: string;
}
