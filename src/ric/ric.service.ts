import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FinancialObjectType, Prisma, SeverityLevel } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../workflow/audit.service";
import { WorkflowIntegrationFacade } from "../workflow/workflow.integration";
import { RicExportDto, RicImportCommitDto, RicImportPreviewDto } from "./dto/ric-excel.dto";
import {
  CreateChangeRequestDto,
  CreateIssueDto,
  CreateRicActionDto,
  CreateRiskDto,
  UpdateRecordStatusDto,
} from "./dto/risk-issue-change.dto";

@Injectable()
export class RicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowIntegration: WorkflowIntegrationFacade,
  ) {}

  async createRisk(dto: CreateRiskDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const severityWeight = this.getSeverityWeight(dto.severity);
    const exposureScore = Number((dto.probability * dto.impact * severityWeight).toFixed(4));
    const risk = await this.prisma.risk.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        probability: this.decimal(dto.probability),
        impact: this.decimal(dto.impact),
        severity: dto.severity,
        severityWeight: this.decimal(severityWeight),
        exposureScore: this.decimal(exposureScore),
        ownerId: dto.ownerId,
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : undefined,
      },
    });
    await this.audit(dto.tenantId, "Risk", risk.id, "RISK_CREATED", actor.userId, undefined, risk);
    return risk;
  }

  async createIssue(dto: CreateIssueDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const issue = await this.prisma.issue.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        ownerId: dto.ownerId,
        targetResolutionDate: dto.targetResolutionDate ? new Date(dto.targetResolutionDate) : undefined,
        escalationSlaDays: dto.escalationSlaDays ?? 7,
      },
    });
    await this.audit(dto.tenantId, "Issue", issue.id, "ISSUE_CREATED", actor.userId, undefined, issue);
    return issue;
  }

  async createChangeRequest(dto: CreateChangeRequestDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const created = await this.prisma.changeRequest.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        title: dto.title,
        description: dto.description,
        requestedBy: actor.userId,
        scopeImpact: this.decimal(dto.scopeImpact),
        scheduleImpactDays: dto.scheduleImpactDays,
        costImpact: this.decimal(dto.costImpact),
        resourceImpactHours: this.decimal(dto.resourceImpactHours),
      },
    });
    const wf = await this.workflowIntegration.forChanges().startChangeApproval(dto.tenantId, created.id, actor);
    const updated = await this.prisma.changeRequest.update({
      where: { id: created.id },
      data: { workflowInstanceId: wf.id, status: "IN_PROGRESS" },
    });
    await this.audit(dto.tenantId, "ChangeRequest", created.id, "CHANGE_REQUEST_CREATED", actor.userId, undefined, updated);
    return updated;
  }

  async createAction(dto: CreateRicActionDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    if (!dto.riskId && !dto.issueId) throw new BadRequestException("Either riskId or issueId is required.");
    if (dto.riskId && dto.issueId) throw new BadRequestException("Action must be linked to either risk or issue, not both.");
    if (dto.riskId) await this.ensureRisk(dto.riskId, dto.tenantId);
    if (dto.issueId) await this.ensureIssue(dto.issueId, dto.tenantId);

    const action = await this.prisma.riskIssueAction.create({
      data: {
        tenantId: dto.tenantId,
        actionType: dto.actionType,
        riskId: dto.riskId,
        issueId: dto.issueId,
        title: dto.title,
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
    await this.audit(dto.tenantId, "RiskIssueAction", action.id, "RIC_ACTION_CREATED", actor.userId, undefined, action);
    return action;
  }

  async updateRiskStatus(id: string, dto: UpdateRecordStatusDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const prev = await this.ensureRisk(id, dto.tenantId);
    const updated = await this.prisma.risk.update({ where: { id }, data: { status: dto.status } });
    await this.audit(dto.tenantId, "Risk", id, "RISK_STATUS_UPDATED", actor.userId, prev, updated);
    return updated;
  }

  async updateIssueStatus(id: string, dto: UpdateRecordStatusDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const prev = await this.ensureIssue(id, dto.tenantId);
    const updated = await this.prisma.issue.update({
      where: { id },
      data: { status: dto.status, resolvedAt: dto.status === "CLOSED" ? new Date() : null },
    });
    await this.audit(dto.tenantId, "Issue", id, "ISSUE_STATUS_UPDATED", actor.userId, prev, updated);
    return updated;
  }

  async computeRollup(tenantId: string, objectType: FinancialObjectType, objectId: string, period: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const risks = await this.prisma.risk.findMany({ where: { tenantId, objectType, objectId, status: { not: "CLOSED" } } });
    const issues = await this.prisma.issue.findMany({ where: { tenantId, objectType, objectId, status: { not: "CLOSED" } } });

    const riskExposureTotal = risks.reduce((sum, r) => sum + Number(r.exposureScore), 0);
    const issueWeightedTotal = issues.reduce((sum, i) => sum + this.getSeverityWeight(i.severity), 0);
    const counts = this.getSeverityCounts([...risks.map((r) => r.severity), ...issues.map((i) => i.severity)]);

    const summary = await this.prisma.ricRollupSummary.create({
      data: {
        tenantId,
        objectType,
        objectId,
        period,
        riskExposureTotal: this.decimal(riskExposureTotal),
        issueWeightedTotal: this.decimal(issueWeightedTotal),
        criticalCount: counts.CRITICAL,
        highCount: counts.HIGH,
        mediumCount: counts.MEDIUM,
        lowCount: counts.LOW,
      },
    });
    await this.audit(tenantId, "RicRollupSummary", summary.id, "RIC_ROLLUP_COMPUTED", actor.userId, undefined, summary);
    return summary;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runIssueEscalationCron() {
    await this.runIssueEscalation();
  }

  async runIssueEscalation() {
    const openIssues = await this.prisma.issue.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, isEscalated: false },
    });
    let escalated = 0;
    const now = new Date();
    for (const issue of openIssues) {
      const agingDays = Math.floor((now.getTime() - issue.openedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (agingDays >= issue.escalationSlaDays) {
        await this.prisma.issue.update({
          where: { id: issue.id },
          data: { agingDays, isEscalated: true, status: "ESCALATED" },
        });
        await this.audit(issue.tenantId, "Issue", issue.id, "ISSUE_ESCALATED_BY_SLA", "SYSTEM", issue, {
          agingDays,
          status: "ESCALATED",
        });
        escalated += 1;
      } else {
        await this.prisma.issue.update({ where: { id: issue.id }, data: { agingDays } });
      }
    }
    return { checked: openIssues.length, escalated };
  }

  async importPreview(dto: RicImportPreviewDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const rows = dto.payload ?? [];
    const errors: Array<{ index: number; reason: string }> = [];
    rows.forEach((r, i) => {
      if (!r || typeof r !== "object") errors.push({ index: i, reason: "Invalid row payload." });
    });
    const job = await this.prisma.ricExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        operation: "IMPORT",
        entityName: dto.entityName,
        status: "VALIDATED",
        fileName: dto.fileName,
        rowCount: rows.length,
        payloadJson: rows as unknown as Prisma.InputJsonValue,
        resultSummary: { totalRows: rows.length, validRows: rows.length - errors.length, rejectedRows: errors.length, errors },
        createdBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "RicExcelJob", job.id, "RIC_IMPORT_PREVIEWED", actor.userId, undefined, job);
    return job;
  }

  async importCommit(jobId: string, dto: RicImportCommitDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const job = await this.prisma.ricExcelJob.findFirst({
      where: { id: jobId, tenantId: dto.tenantId, operation: "IMPORT", status: "VALIDATED" },
    });
    if (!job) throw new NotFoundException("Validated import job not found.");
    const rows = (job.payloadJson ?? []) as unknown as Record<string, unknown>[];
    let inserted = 0;
    const errors: Array<{ index: number; reason: string }> = [];
    for (let i = 0; i < rows.length; i += 1) {
      try {
        const row = rows[i] as Record<string, unknown>;
        if (job.entityName === "RISK") {
          await this.createRisk(row as unknown as CreateRiskDto, actor);
        } else if (job.entityName === "ISSUE") {
          await this.createIssue(row as unknown as CreateIssueDto, actor);
        } else if (job.entityName === "CHANGE_REQUEST") {
          await this.createChangeRequest(row as unknown as CreateChangeRequestDto, actor);
        } else if (job.entityName === "MITIGATION_ACTION") {
          await this.createAction(row as unknown as CreateRicActionDto, actor);
        } else {
          throw new BadRequestException("Unsupported entity for import.");
        }
        inserted += 1;
      } catch (error) {
        errors.push({ index: i, reason: (error as Error).message });
      }
    }
    const updated = await this.prisma.ricExcelJob.update({
      where: { id: jobId },
      data: {
        status: errors.length ? "FAILED" : "COMPLETED",
        resultSummary: { totalRows: rows.length, insertedRows: inserted, rejectedRows: errors.length, errors },
      },
    });
    await this.audit(dto.tenantId, "RicExcelJob", jobId, "RIC_IMPORT_COMMITTED", actor.userId, job, updated);
    return updated;
  }

  async exportData(dto: RicExportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    let rows: unknown[] = [];
    if (dto.entityName === "RISK") {
      rows = await this.prisma.risk.findMany({ where: { tenantId: dto.tenantId } });
    } else if (dto.entityName === "ISSUE") {
      rows = await this.prisma.issue.findMany({ where: { tenantId: dto.tenantId } });
    } else if (dto.entityName === "CHANGE_REQUEST") {
      rows = await this.prisma.changeRequest.findMany({ where: { tenantId: dto.tenantId } });
    } else if (dto.entityName === "MITIGATION_ACTION") {
      rows = await this.prisma.riskIssueAction.findMany({ where: { tenantId: dto.tenantId, actionType: "MITIGATION" } });
    } else if (dto.entityName === "ROLLUP") {
      rows = await this.prisma.ricRollupSummary.findMany({
        where: {
          tenantId: dto.tenantId,
          period: dto.period,
          objectType: dto.objectType,
          objectId: dto.objectId,
        },
      });
    }
    const job = await this.prisma.ricExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        operation: "EXPORT",
        entityName: dto.entityName,
        status: "COMPLETED",
        fileName: `${dto.entityName.toLowerCase()}-export-${Date.now()}.xlsx`,
        rowCount: rows.length,
        resultSummary: { rowCount: rows.length },
        createdBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "RicExcelJob", job.id, "RIC_EXPORT_COMPLETED", actor.userId, undefined, { rowCount: rows.length });
    return { jobId: job.id, rows };
  }

  private getSeverityWeight(severity: SeverityLevel): number {
    if (severity === "CRITICAL") return 10;
    if (severity === "HIGH") return 6;
    if (severity === "MEDIUM") return 3;
    return 1;
  }

  private getSeverityCounts(severities: SeverityLevel[]) {
    return severities.reduce(
      (acc, sev) => {
        acc[sev] += 1;
        return acc;
      },
      { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    );
  }

  private async ensureRisk(id: string, tenantId: string) {
    const risk = await this.prisma.risk.findFirst({ where: { id, tenantId } });
    if (!risk) throw new NotFoundException("Risk not found.");
    return risk;
  }

  private async ensureIssue(id: string, tenantId: string) {
    const issue = await this.prisma.issue.findFirst({ where: { id, tenantId } });
    if (!issue) throw new NotFoundException("Issue not found.");
    return issue;
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (tenantId !== actor.tenantId) throw new ForbiddenException("Cross-tenant access denied.");
  }

  private decimal(value: number): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private async audit(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.auditService.log({
      tenantId,
      entityType,
      entityId,
      action,
      actorId,
      oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
    });
  }
}
