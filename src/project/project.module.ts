import { Module } from "@nestjs/common";
import { WorkflowModule } from "../workflow/workflow.module";
import { ProjectController } from "./project.controller";
import { ProjectService } from "./project.service";

@Module({
  imports: [WorkflowModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
