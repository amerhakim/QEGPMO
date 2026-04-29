import { Module } from "@nestjs/common";
import { WorkflowModule } from "../workflow/workflow.module";
import { RicController } from "./ric.controller";
import { RicService } from "./ric.service";

@Module({
  imports: [WorkflowModule],
  controllers: [RicController],
  providers: [RicService],
  exports: [RicService],
})
export class RicModule {}
