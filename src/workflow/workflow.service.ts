import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalDecision, EscalationAction, Prisma } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEscalationRuleDto } from "./dto/create-escalation-rule.dto";
import { CreateWorkflowDefinitionDto } from "./dto/create-workflow-definition.dto";
import { StartWorkflowDto } from "./dto/start-workflow.dto";
import { AuditService } from "./audit.service";

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createWorkflowDefinition(dto: CreateWorkflowDefinitionDto, actor: RequestUser) {
    this.assertTenant(actor, dto.tenantId);
    if (!dto.steps.length) {
      throw new BadRequestException("Workflow requires at least one step.");
    }

    const uniqueSequences = new Set(dto.steps.map((s) => s.sequence));
    if (uniqueSequences.size !== dto.steps.length) {
      throw new BadRequestException("Workflow step sequence values must be unique.");
    }

    const created = await this.prisma.workflowDefinition.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        entityType: dto.entityType,
        steps: {
          create: dto.steps.map((step) => ({
            code: step.code,
            name: step.name,
            sequence: step.sequence,
            approverRole: step.approverRole,
            requiredApprovals: step.requiredApprovals,
            slaMinutes: step.slaMinutes,
            isFinal: step.isFinal ?? false,
          })),
        },
      },
      include: { steps: { orderBy: { sequence: "asc" } } },
    });

    await this.auditService.log({
      tenantId: dto.tenantId,
      entityType: "WorkflowDefinition",
      entityId: created.id,
      action: "WORKFLOW_DEFINITION_CREATED",
      actorId: actor.userId,
      newValue: created,
    });

    return created;
  }

  async createEscalationRule(dto: CreateEscalationRuleDto, actor: RequestUser) {
    this.assertTenant(actor, dto.tenantId);
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { tenantId_code: { tenantId: dto.tenantId, code: dto.workflowCode } },
      include: { steps: true },
    });
    if (!workflow) throw new NotFoundException("Workflow definition not found.");

    const step = workflow.steps.find((s) => s.code === dto.stepCode);
    if (!step) throw new NotFoundException("Workflow step not found.");

    const rule = await this.prisma.escalationRule.create({
      data: {
        tenantId: dto.tenantId,
        workflowDefinitionId: workflow.id,
        workflowStepId: step.id,
        escalateAfterMinutes: dto.escalateAfterMinutes,
        escalationRole: dto.escalationRole,
        action: dto.action ?? EscalationAction.NOTIFY,
      },
    });

    await this.auditService.log({
      tenantId: dto.tenantId,
      entityType: "EscalationRule",
      entityId: rule.id,
      action: "ESCALATION_RULE_CREATED",
      actorId: actor.userId,
      newValue: rule,
    });
    return rule;
  }

  async startWorkflow(dto: StartWorkflowDto, actor: RequestUser) {
    this.assertTenant(actor, dto.tenantId);
    const definition = await this.prisma.workflowDefinition.findUnique({
      where: { tenantId_code: { tenantId: dto.tenantId, code: dto.workflowCode } },
      include: { steps: { orderBy: { sequence: "asc" } } },
    });

    if (!definition || !definition.isActive) {
      throw new NotFoundException("Active workflow definition not found.");
    }
    if (definition.entityType !== dto.entityType) {
      throw new BadRequestException("Workflow entityType does not match target entity.");
    }

    const firstStep = definition.steps[0];
    if (!firstStep) throw new BadRequestException("Workflow has no steps.");

    const instance = await this.prisma.workflowInstance.create({
      data: {
        tenantId: dto.tenantId,
        workflowDefinitionId: definition.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        startedBy: actor.userId,
        currentStepSequence: firstStep.sequence,
      },
    });

    await this.auditService.log({
      tenantId: dto.tenantId,
      entityType: "WorkflowInstance",
      entityId: instance.id,
      action: "WORKFLOW_STARTED",
      actorId: actor.userId,
      newValue: instance,
    });
    return instance;
  }

  async getInstance(instanceId: string, tenantId: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
      include: {
        workflowDefinition: { include: { steps: { orderBy: { sequence: "asc" } } } },
        approvalActions: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!instance) throw new NotFoundException("Workflow instance not found.");
    return instance;
  }

  async handleApprovalAction(
    instanceId: string,
    tenantId: string,
    actor: RequestUser,
    decision: ApprovalDecision,
    comments?: string,
  ) {
    this.assertTenant(actor, tenantId);
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
      include: {
        workflowDefinition: { include: { steps: true } },
        approvalActions: true,
      },
    });
    if (!instance) throw new NotFoundException("Workflow instance not found.");
    if (instance.status !== "IN_PROGRESS") {
      throw new BadRequestException("Workflow instance is not in progress.");
    }

    const currentStep = instance.workflowDefinition.steps.find(
      (s) => s.sequence === instance.currentStepSequence,
    );
    if (!currentStep) throw new BadRequestException("Current step not found.");

    if (!actor.roles.includes(currentStep.approverRole)) {
      throw new ForbiddenException("Actor role does not match required approver role.");
    }

    const duplicateAction = instance.approvalActions.find(
      (a) => a.workflowStepId === currentStep.id && a.actorId === actor.userId,
    );
    if (duplicateAction) {
      throw new BadRequestException("Actor has already decided this step.");
    }

    const previous = { status: instance.status, currentStepSequence: instance.currentStepSequence };
    const action = await this.prisma.approvalAction.create({
      data: {
        tenantId,
        workflowInstanceId: instance.id,
        workflowStepId: currentStep.id,
        actorId: actor.userId,
        actorRole: currentStep.approverRole,
        decision,
        comments,
      },
    });

    if (decision === ApprovalDecision.REJECT) {
      const updated = await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: { status: "REJECTED", completedAt: new Date() },
      });
      await this.logApprovalAudit(tenantId, instance.id, actor.userId, previous, updated, action);
      return updated;
    }

    const approvalsForStep = await this.prisma.approvalAction.count({
      where: {
        workflowInstanceId: instance.id,
        workflowStepId: currentStep.id,
        decision: ApprovalDecision.APPROVE,
      },
    });

    if (approvalsForStep >= currentStep.requiredApprovals) {
      const nextStep = instance.workflowDefinition.steps.find((s) => s.sequence === currentStep.sequence + 1);
      const updated = await this.prisma.workflowInstance.update({
        where: { id: instance.id },
        data: nextStep
          ? { currentStepSequence: nextStep.sequence, stepStartedAt: new Date() }
          : { status: "APPROVED", completedAt: new Date() },
      });
      await this.logApprovalAudit(tenantId, instance.id, actor.userId, previous, updated, action);
      return updated;
    }

    await this.logApprovalAudit(tenantId, instance.id, actor.userId, previous, previous, action);
    return instance;
  }

  async runSlaEscalation(now = new Date()) {
    const candidates = await this.prisma.workflowInstance.findMany({
      where: { status: "IN_PROGRESS" },
      include: { workflowDefinition: { include: { steps: true, escalations: { where: { isActive: true } } } } },
    });

    let escalatedCount = 0;
    for (const instance of candidates) {
      const step = instance.workflowDefinition.steps.find((s) => s.sequence === instance.currentStepSequence);
      if (!step) continue;
      const rule = instance.workflowDefinition.escalations.find((r) => r.workflowStepId === step.id);
      if (!rule) continue;

      const elapsedMinutes = Math.floor((now.getTime() - instance.stepStartedAt.getTime()) / 60000);
      if (elapsedMinutes < rule.escalateAfterMinutes) continue;

      await this.prisma.approvalAction.create({
        data: {
          tenantId: instance.tenantId,
          workflowInstanceId: instance.id,
          workflowStepId: step.id,
          actorId: "SYSTEM",
          actorRole: rule.escalationRole,
          decision: rule.action === EscalationAction.AUTO_REJECT ? ApprovalDecision.AUTO_REJECT : ApprovalDecision.ESCALATE,
          comments: `SLA escalation after ${elapsedMinutes} minutes`,
        },
      });

      if (rule.action === EscalationAction.AUTO_REJECT) {
        const previous = { status: instance.status };
        const updated = await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: { status: "REJECTED", completedAt: now },
        });
        await this.auditService.log({
          tenantId: instance.tenantId,
          entityType: "WorkflowInstance",
          entityId: instance.id,
          action: "WORKFLOW_AUTO_REJECTED_BY_SLA",
          actorId: "SYSTEM",
          oldValue: previous,
          newValue: updated,
        });
      } else {
        await this.prisma.workflowInstance.update({
          where: { id: instance.id },
          data: { status: "ESCALATED" },
        });
      }
      escalatedCount += 1;
    }
    return { checked: candidates.length, escalated: escalatedCount };
  }

  private async logApprovalAudit(
    tenantId: string,
    instanceId: string,
    actorId: string,
    oldValue: Prisma.InputJsonValue,
    newValue: Prisma.InputJsonValue,
    actionRecord: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.auditService.log({
      tenantId,
      entityType: "WorkflowInstance",
      entityId: instanceId,
      action: "WORKFLOW_ACTION_APPLIED",
      actorId,
      oldValue,
      newValue: { state: newValue, action: actionRecord },
    });
  }

  private assertTenant(actor: RequestUser, tenantId: string): void {
    if (actor.tenantId !== tenantId) {
      throw new ForbiddenException("Cross-tenant access denied.");
    }
  }
}
