import { Injectable } from "@nestjs/common";
import { RequestUser } from "../common/auth/request-user.interface";
import { WorkflowService } from "./workflow.service";

@Injectable()
export class WorkflowHooksService {
  constructor(private readonly workflowService: WorkflowService) {}

  async startProjectIntakeApproval(tenantId: string, projectIntakeId: string, actor: RequestUser) {
    return this.workflowService.startWorkflow(
      {
        tenantId,
        workflowCode: "PROJECT_INTAKE_APPROVAL",
        entityType: "PROJECT_INTAKE",
        entityId: projectIntakeId,
      },
      actor,
    );
  }

  async startPhaseGateApproval(tenantId: string, phaseGateId: string, actor: RequestUser) {
    return this.workflowService.startWorkflow(
      {
        tenantId,
        workflowCode: "PHASE_GATE_APPROVAL",
        entityType: "PHASE_GATE",
        entityId: phaseGateId,
      },
      actor,
    );
  }

  async startChangeRequestApproval(tenantId: string, changeRequestId: string, actor: RequestUser) {
    return this.workflowService.startWorkflow(
      {
        tenantId,
        workflowCode: "CHANGE_REQUEST_APPROVAL",
        entityType: "CHANGE_REQUEST",
        entityId: changeRequestId,
      },
      actor,
    );
  }

  async startBudgetApproval(tenantId: string, budgetRequestId: string, actor: RequestUser) {
    return this.workflowService.startWorkflow(
      {
        tenantId,
        workflowCode: "BUDGET_APPROVAL",
        entityType: "BUDGET_REQUEST",
        entityId: budgetRequestId,
      },
      actor,
    );
  }

  async startResourceAllocationApproval(tenantId: string, allocationId: string, actor: RequestUser) {
    return this.workflowService.startWorkflow(
      {
        tenantId,
        workflowCode: "RESOURCE_ALLOCATION_APPROVAL",
        entityType: "RESOURCE_ALLOCATION",
        entityId: allocationId,
      },
      actor,
    );
  }
}
