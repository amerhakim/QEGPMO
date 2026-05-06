import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, WeeklyStatusExportFormat, WeeklyStatusReportStatus } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { WorkflowIntegrationFacade } from "../workflow/workflow.integration";
import { AuditService } from "../workflow/audit.service";
import { EditWeeklyStatusReportDto } from "./dto/edit-weekly-status-report.dto";
import { ExportWeeklyStatusReportDto } from "./dto/export-weekly-status-report.dto";
import { GenerateWeeklyStatusReportDto } from "./dto/generate-weekly-status-report.dto";
import { SubmitWeeklyStatusReportDto } from "./dto/submit-weekly-status-report.dto";
import { StatusReportAiService } from "./status-report-ai.service";
import { StatusReportDataCollectorService } from "./status-report-data-collector.service";
import { StatusReportExportService } from "./status-report-export.service";
import { CollectedMetrics, StatusReportEditorContent } from "./status-report.types";

@Injectable()
export class StatusReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowIntegration: WorkflowIntegrationFacade,
    private readonly collector: StatusReportDataCollectorService,
    private readonly ai: StatusReportAiService,
    private readonly exporter: StatusReportExportService,
  ) {}

  async generate(dto: GenerateWeeklyStatusReportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const fiscalPeriod = dto.fiscalPeriod ?? dto.reportingWeek;
    const refreshMetrics = dto.refreshMetrics ?? false;

    const existing = await this.prisma.weeklyStatusReport.findUnique({
      where: {
        tenantId_scopeType_scopeId_reportingWeek: {
          tenantId: dto.tenantId,
          scopeType: dto.scopeType,
          scopeId: dto.scopeId,
          reportingWeek: dto.reportingWeek,
        },
      },
    });

    if (existing?.status === WeeklyStatusReportStatus.PUBLISHED) {
      throw new ConflictException("This reporting week is already published for the scope.");
    }
    if (existing?.status === WeeklyStatusReportStatus.UNDER_REVIEW) {
      throw new ConflictException("Report is awaiting workflow approval; generation is frozen.");
    }

    const metrics = await this.collector.collect(
      dto.tenantId,
      dto.scopeType,
      dto.scopeId,
      dto.reportingWeek,
      fiscalPeriod,
      actor,
      refreshMetrics,
    );

    const { proposal, accomplishmentsHint } = await this.ai.proposeNarrative(metrics);
    const executive = proposal.executiveSummaryRaw ?? "";
    const editorContent = this.buildInitialEditor(metrics, executive, accomplishmentsHint);

    const report =
      existing ??
      (await this.prisma.weeklyStatusReport.create({
        data: {
          tenantId: dto.tenantId,
          scopeType: dto.scopeType,
          scopeId: dto.scopeId,
          reportingWeek: dto.reportingWeek,
          fiscalPeriod,
          status: WeeklyStatusReportStatus.DRAFT,
          createdBy: actor.userId,
        },
      }));

    const lastRev = await this.prisma.weeklyStatusReportRevision.findFirst({
      where: { reportId: report.id },
      orderBy: { revisionNumber: "desc" },
    });
    const revisionNumber = (lastRev?.revisionNumber ?? 0) + 1;

    const revision = await this.prisma.weeklyStatusReportRevision.create({
      data: {
        reportId: report.id,
        revisionNumber,
        metricsSnapshot: this.json(metrics),
        aiProposal: this.json(proposal),
        editorContent: this.json(editorContent),
        createdBy: actor.userId,
      },
    });

    await this.audit(dto.tenantId, "WeeklyStatusReport", report.id, "STATUS_REPORT_GENERATED", actor.userId, undefined, {
      revisionId: revision.id,
      revisionNumber,
      factsDigest: metrics.factsDigest,
    });

    return { report, revision };
  }

  async edit(reportId: string, dto: EditWeeklyStatusReportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const report = await this.prisma.weeklyStatusReport.findFirst({
      where: { id: reportId, tenantId: dto.tenantId },
    });
    if (!report) throw new NotFoundException("Weekly status report not found.");
    if (report.status === WeeklyStatusReportStatus.PUBLISHED) {
      throw new ConflictException("Published reports cannot be edited.");
    }
    if (report.status === WeeklyStatusReportStatus.UNDER_REVIEW) {
      throw new ConflictException("Report is awaiting approval and cannot be edited.");
    }

    const latest = await this.prisma.weeklyStatusReportRevision.findFirst({
      where: { reportId },
      orderBy: { revisionNumber: "desc" },
    });
    if (!latest) throw new NotFoundException("No revisions exist for this report.");

    if (dto.baseRevisionNumber !== undefined && dto.baseRevisionNumber !== latest.revisionNumber) {
      throw new ConflictException("Stale revision: reload latest report before editing.");
    }

    const previousEditor = latest.editorContent as unknown as StatusReportEditorContent;
    const merged = this.mergeEditorContent(previousEditor, dto.editorContent);

    const revisionNumber = latest.revisionNumber + 1;
    const revision = await this.prisma.weeklyStatusReportRevision.create({
      data: {
        reportId,
        revisionNumber,
        metricsSnapshot: latest.metricsSnapshot as Prisma.InputJsonValue,
        aiProposal: latest.aiProposal as Prisma.InputJsonValue,
        editorContent: this.json(merged),
        createdBy: actor.userId,
      },
    });

    await this.audit(dto.tenantId, "WeeklyStatusReport", reportId, "STATUS_REPORT_EDITED", actor.userId, previousEditor, merged);

    return { report, revision };
  }

  /**
   * Submits the latest revision into the Workflow & Approval Engine.
   * Publishing occurs only after `WorkflowInstance` reaches APPROVED (see WorkflowService).
   */
  async submitForApproval(reportId: string, dto: SubmitWeeklyStatusReportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const report = await this.prisma.weeklyStatusReport.findFirst({
      where: { id: reportId, tenantId: dto.tenantId },
    });
    if (!report) throw new NotFoundException("Weekly status report not found.");
    if (report.status !== WeeklyStatusReportStatus.DRAFT) {
      throw new ConflictException("Only draft reports can be submitted for approval.");
    }
    if (report.workflowInstanceId) {
      throw new ConflictException("An approval workflow is already linked to this report.");
    }

    const latest = await this.prisma.weeklyStatusReportRevision.findFirst({
      where: { reportId },
      orderBy: { revisionNumber: "desc" },
    });
    if (!latest) throw new BadRequestException("Cannot submit without at least one revision.");

    const wf = await this.workflowIntegration.forStatusReports().startWeeklyStatusReportApproval(dto.tenantId, reportId, actor);

    const updated = await this.prisma.weeklyStatusReport.update({
      where: { id: reportId },
      data: {
        status: WeeklyStatusReportStatus.UNDER_REVIEW,
        workflowInstanceId: wf.id,
        pendingPublishRevisionId: latest.id,
      },
    });

    await this.audit(dto.tenantId, "WeeklyStatusReport", reportId, "STATUS_REPORT_SUBMITTED_FOR_APPROVAL", actor.userId, report, {
      workflowInstanceId: wf.id,
      pendingPublishRevisionId: latest.id,
    });

    return { report: updated, workflowInstance: wf };
  }

  async exportReport(reportId: string, dto: ExportWeeklyStatusReportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const report = await this.prisma.weeklyStatusReport.findFirst({
      where: { id: reportId, tenantId: dto.tenantId },
    });
    if (!report) throw new NotFoundException("Weekly status report not found.");

    const revision = await this.resolveExportRevision(reportId, report, dto);
    if (!revision) throw new NotFoundException("Revision not found.");

    const metrics = revision.metricsSnapshot as unknown as CollectedMetrics;
    const editor = revision.editorContent as unknown as StatusReportEditorContent;

    const artifact = await this.exporter.render(
      dto.format as WeeklyStatusExportFormat,
      report.reportingWeek,
      metrics.scopeLabel,
      metrics,
      editor,
    );

    const job = await this.prisma.weeklyStatusReportExportJob.create({
      data: {
        tenantId: dto.tenantId,
        reportId,
        revisionId: revision.id,
        format: dto.format as WeeklyStatusExportFormat,
        status: "COMPLETED",
        fileName: artifact.fileName,
        resultSummary: {
          mimeType: artifact.mimeType,
          reportingWeek: report.reportingWeek,
          revisionNumber: revision.revisionNumber,
        },
        createdBy: actor.userId,
      },
    });

    await this.audit(dto.tenantId, "WeeklyStatusReportExportJob", job.id, "STATUS_REPORT_EXPORTED", actor.userId, undefined, {
      format: dto.format,
      revisionNumber: revision.revisionNumber,
    });

    return { ...artifact, jobId: job.id };
  }

  async getOne(reportId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const report = await this.prisma.weeklyStatusReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 25 },
        publishedRevision: true,
      },
    });
    if (!report) throw new NotFoundException("Weekly status report not found.");
    return report;
  }

  async list(tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    return this.prisma.weeklyStatusReport.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });
  }

  async listRevisions(reportId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const report = await this.prisma.weeklyStatusReport.findFirst({ where: { id: reportId, tenantId } });
    if (!report) throw new NotFoundException("Weekly status report not found.");
    return this.prisma.weeklyStatusReportRevision.findMany({
      where: { reportId },
      orderBy: { revisionNumber: "desc" },
    });
  }

  private async resolveExportRevision(
    reportId: string,
    report: { status: WeeklyStatusReportStatus; publishedRevisionId: string | null },
    dto: ExportWeeklyStatusReportDto,
  ) {
    if (dto.revisionNumber !== undefined) {
      return this.prisma.weeklyStatusReportRevision.findUnique({
        where: {
          reportId_revisionNumber: {
            reportId,
            revisionNumber: dto.revisionNumber,
          },
        },
      });
    }
    if (report.status === WeeklyStatusReportStatus.PUBLISHED && report.publishedRevisionId && !dto.useDraft) {
      return this.prisma.weeklyStatusReportRevision.findUnique({ where: { id: report.publishedRevisionId } });
    }
    return this.prisma.weeklyStatusReportRevision.findFirst({
      where: { reportId },
      orderBy: { revisionNumber: "desc" },
    });
  }

  private buildInitialEditor(metrics: CollectedMetrics, executiveSummary: string, accomplishments: string[]): StatusReportEditorContent {
    return {
      executiveSummary,
      scheduleSummary: `Actual progress ${metrics.schedule.actualProgressPercent}% vs expected ${metrics.schedule.expectedProgressPercent}% (${metrics.schedule.scheduleStatus}). Variance ${metrics.schedule.scheduleVariancePercent}%.`,
      costSummary: metrics.financial.unavailableReason
        ? `Financial metrics unavailable: ${metrics.financial.unavailableReason}`
        : `Approved budget ${metrics.financial.totalApprovedBudget}, forecast EAC ${metrics.financial.totalForecastEac}, actual ${metrics.financial.totalActualCost}. CV% ${metrics.financial.costVariancePercent}. Cost RAG ${metrics.financial.ragStatus}.`,
      accomplishments: accomplishments.length ? accomplishments : ["No accomplishment bullets were generated for this period."],
      upcomingMilestones: metrics.upcomingMilestones.map((m) => `${m.projectCode} ${m.code} ${m.name} — ${m.plannedDate}`),
      topRisks: metrics.topRisks.map((r) => ({
        title: r.title,
        severity: r.severity,
        mitigationSummary: r.mitigationActions.length ? r.mitigationActions.join("; ") : "No open mitigation actions captured.",
      })),
    };
  }

  private mergeEditorContent(base: StatusReportEditorContent, patch: Record<string, unknown>): StatusReportEditorContent {
    const out: StatusReportEditorContent = { ...base };
    if (typeof patch.executiveSummary === "string") out.executiveSummary = patch.executiveSummary;
    if (typeof patch.scheduleSummary === "string") out.scheduleSummary = patch.scheduleSummary;
    if (typeof patch.costSummary === "string") out.costSummary = patch.costSummary;
    if (Array.isArray(patch.accomplishments)) {
      out.accomplishments = patch.accomplishments.map((x) => String(x));
    }
    if (Array.isArray(patch.upcomingMilestones)) {
      out.upcomingMilestones = patch.upcomingMilestones.map((x) => String(x));
    }
    if (Array.isArray(patch.topRisks)) {
      out.topRisks = patch.topRisks.map((row) => {
        if (!row || typeof row !== "object") throw new BadRequestException("Invalid topRisks entry.");
        const r = row as Record<string, unknown>;
        return {
          title: String(r.title ?? ""),
          severity: String(r.severity ?? ""),
          mitigationSummary: String(r.mitigationSummary ?? ""),
        };
      });
    }
    return out;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (tenantId !== actor.tenantId) {
      throw new ForbiddenException("Cross-tenant access denied.");
    }
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
