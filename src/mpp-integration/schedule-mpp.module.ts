import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { MppJavaBridgeService } from "./mpp-java-bridge.service";
import { MppScheduleValidationService } from "./mpp-schedule-validation.service";
import { MspdiXmlParserService } from "./mspdi-xml.parser";
import { MspdiXmlSerializerService } from "./mspdi-xml.serializer";
import { ScheduleMppController } from "./schedule-mpp.controller";
import { ScheduleMppService } from "./schedule-mpp.service";

@Module({
  imports: [PrismaModule, SchedulingModule, WorkflowModule],
  controllers: [ScheduleMppController],
  providers: [
    ScheduleMppService,
    MspdiXmlParserService,
    MspdiXmlSerializerService,
    MppScheduleValidationService,
    MppJavaBridgeService,
  ],
})
export class ScheduleMppModule {}
