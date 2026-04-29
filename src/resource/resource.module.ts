import { Module } from "@nestjs/common";
import { WorkflowModule } from "../workflow/workflow.module";
import { ResourceController } from "./resource.controller";
import { ResourceService } from "./resource.service";

@Module({
  imports: [WorkflowModule],
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class ResourceModule {}
