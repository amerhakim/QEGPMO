import { FinancialModule } from "./financial/financial.module";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ProjectModule } from "./project/project.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RicModule } from "./ric/ric.module";
import { ResourceModule } from "./resource/resource.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { WorkflowModule } from "./workflow/workflow.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    WorkflowModule,
    ProjectModule,
    SchedulingModule,
    ResourceModule,
    FinancialModule,
    RicModule,
  ],
})
export class AppModule {}
