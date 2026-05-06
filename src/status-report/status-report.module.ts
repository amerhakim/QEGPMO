import { Module } from "@nestjs/common";
import { FinancialModule } from "../financial/financial.module";
import { RicModule } from "../ric/ric.module";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { StatusReportAiService } from "./status-report-ai.service";
import { StatusReportController } from "./status-report.controller";
import { StatusReportDataCollectorService } from "./status-report-data-collector.service";
import { StatusReportExportService } from "./status-report-export.service";
import { StatusReportSchedulerService } from "./status-report-scheduler.service";
import { StatusReportService } from "./status-report.service";

@Module({
  imports: [WorkflowModule, FinancialModule, SchedulingModule, RicModule],
  controllers: [StatusReportController],
  providers: [
    StatusReportService,
    StatusReportDataCollectorService,
    StatusReportAiService,
    StatusReportExportService,
    StatusReportSchedulerService,
  ],
  exports: [StatusReportService],
})
export class StatusReportModule {}
