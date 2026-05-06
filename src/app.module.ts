import { FinancialModule } from "./financial/financial.module";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ProjectModule } from "./project/project.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RiskDetectionModule } from "./risk-detection/risk-detection.module";
import { RicModule } from "./ric/ric.module";
import { ResourceModule } from "./resource/resource.module";
import { ScheduleMppModule } from "./mpp-integration/schedule-mpp.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { StatusReportModule } from "./status-report/status-report.module";
import { WorkflowModule } from "./workflow/workflow.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    WorkflowModule,
    ProjectModule,
    SchedulingModule,
    ScheduleMppModule,
    ResourceModule,
    FinancialModule,
    RicModule,
    RiskDetectionModule,
    StatusReportModule,
  ],
})
export class AppModule {}
