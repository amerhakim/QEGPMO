import { Injectable } from "@nestjs/common";
import { RequestUser } from "../common/auth/request-user.interface";
import { WorkflowHooksService } from "./workflow-hooks.service";

@Injectable()
export class WorkflowIntegrationFacade {
  constructor(private readonly hooks: WorkflowHooksService) {}

  forProjects() {
    return {
      startIntakeApproval: (tenantId: string, projectIntakeId: string, actor: RequestUser) =>
        this.hooks.startProjectIntakeApproval(tenantId, projectIntakeId, actor),
      startPhaseGateApproval: (tenantId: string, phaseGateId: string, actor: RequestUser) =>
        this.hooks.startPhaseGateApproval(tenantId, phaseGateId, actor),
    };
  }

  forChanges() {
    return {
      startChangeApproval: (tenantId: string, changeRequestId: string, actor: RequestUser) =>
        this.hooks.startChangeRequestApproval(tenantId, changeRequestId, actor),
    };
  }

  forBudgets() {
    return {
      startBudgetApproval: (tenantId: string, budgetRequestId: string, actor: RequestUser) =>
        this.hooks.startBudgetApproval(tenantId, budgetRequestId, actor),
    };
  }

  forResources() {
    return {
      startAllocationApproval: (tenantId: string, allocationId: string, actor: RequestUser) =>
        this.hooks.startResourceAllocationApproval(tenantId, allocationId, actor),
    };
  }

  forStatusReports() {
    return {
      startWeeklyStatusReportApproval: (tenantId: string, weeklyStatusReportId: string, actor: RequestUser) =>
        this.hooks.startWeeklyStatusReportApproval(tenantId, weeklyStatusReportId, actor),
    };
  }

  forRiskDetection() {
    return {
      startDetectedRiskSuggestionApproval: (tenantId: string, suggestionId: string, actor: RequestUser) =>
        this.hooks.startDetectedRiskSuggestionApproval(tenantId, suggestionId, actor),
    };
  }
}
