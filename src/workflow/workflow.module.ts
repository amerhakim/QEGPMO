import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { AuditService } from "./audit.service";
import { WorkflowController } from "./workflow.controller";
import { WorkflowHooksService } from "./workflow-hooks.service";
import { WorkflowIntegrationFacade } from "./workflow.integration";
import { WorkflowSlaService } from "./workflow-sla.service";
import { WorkflowService } from "./workflow.service";

@Module({
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowSlaService,
    WorkflowHooksService,
    WorkflowIntegrationFacade,
    AuditService,
    RbacGuard,
    Reflector,
  ],
  exports: [WorkflowService, WorkflowHooksService, WorkflowIntegrationFacade],
})
export class WorkflowModule {}
