import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { WorkflowModule } from "./workflow/workflow.module";

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, WorkflowModule],
})
export class AppModule {}
