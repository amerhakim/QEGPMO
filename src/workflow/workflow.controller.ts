import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApprovalDecision } from "@prisma/client";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { ApprovalActionDto } from "./dto/approval-action.dto";
import { CreateEscalationRuleDto } from "./dto/create-escalation-rule.dto";
import { CreateWorkflowDefinitionDto } from "./dto/create-workflow-definition.dto";
import { StartWorkflowDto } from "./dto/start-workflow.dto";
import { WorkflowService } from "./workflow.service";

@Controller("workflows")
@UseGuards(AuthGuard, RbacGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post("definitions")
  @Permissions("workflow.definition.create")
  createDefinition(@Body() dto: CreateWorkflowDefinitionDto, @Actor() actor: RequestUser) {
    return this.workflowService.createWorkflowDefinition(dto, actor);
  }

  @Post("escalation-rules")
  @Permissions("workflow.escalation.create")
  createEscalationRule(@Body() dto: CreateEscalationRuleDto, @Actor() actor: RequestUser) {
    return this.workflowService.createEscalationRule(dto, actor);
  }

  @Post("instances")
  @Permissions("workflow.instance.start")
  startWorkflow(@Body() dto: StartWorkflowDto, @Actor() actor: RequestUser) {
    return this.workflowService.startWorkflow(dto, actor);
  }

  @Get("instances/:instanceId/:tenantId")
  @Permissions("workflow.instance.read")
  getWorkflowInstance(@Param("instanceId") instanceId: string, @Param("tenantId") tenantId: string) {
    return this.workflowService.getInstance(instanceId, tenantId);
  }

  @Post("instances/:instanceId/actions")
  @Permissions("workflow.instance.action")
  applyAction(
    @Param("instanceId") instanceId: string,
    @Body() dto: ApprovalActionDto,
    @Actor() actor: RequestUser,
  ) {
    if (dto.decision !== ApprovalDecision.APPROVE && dto.decision !== ApprovalDecision.REJECT) {
      throw new BadRequestException("Only APPROVE and REJECT decisions are accepted via this API.");
    }
    return this.workflowService.handleApprovalAction(instanceId, dto.tenantId, actor, dto.decision, dto.comments);
  }

  @Post("sla/run")
  @Permissions("workflow.sla.run")
  runSlaMonitor() {
    return this.workflowService.runSlaEscalation();
  }
}
