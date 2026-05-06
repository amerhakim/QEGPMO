import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FinancialObjectType, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { RequestUser } from "../common/auth/request-user.interface";
import { FinancialService } from "../financial/financial.service";
import { PrismaService } from "../prisma/prisma.service";
import { RicService } from "../ric/ric.service";
import { SchedulingService } from "../scheduling/scheduling.service";
import { CollectedMetrics, isoWeekRangeUtc } from "./status-report.types";

@Injectable()
export class StatusReportDataCollectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialService: FinancialService,
    private readonly schedulingService: SchedulingService,
    private readonly ricService: RicService,
  ) {}

  async collect(tenantId: string, scopeType: FinancialObjectType, scopeId: string, reportingWeek: string, fiscalPeriod: string, actor: RequestUser, refreshMetrics: boolean): Promise<CollectedMetrics> {
    let weekStart: Date;
    let weekEnd: Date;
    try {
      const r = isoWeekRangeUtc(reportingWeek);
      weekStart = r.weekStart;
      weekEnd = r.weekEnd;
    } catch {
      throw new BadRequestException("reportingWeek must be YYYY-Www (ISO week).");
    }
    const projects = await this.resolveScopedProjects(tenantId, scopeType, scopeId);
    if (!projects.length) {
      throw new BadRequestException("No projects under selected scope.");
    }

    const scheduleBlock = await this.aggregateScheduleForProjects(projects, tenantId, actor);

    const financialBlock = await this.resolveFinancialSummary(tenantId, scopeType, scopeId, fiscalPeriod, actor, refreshMetrics);

    const ricBlock = await this.resolveRicRollup(tenantId, scopeType, scopeId, fiscalPeriod, actor, refreshMetrics);

    const horizonEnd = new Date(weekEnd);
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 14);

    const milestones = await this.prisma.milestone.findMany({
      where: {
        tenantId,
        projectId: { in: projects.map((p) => p.id) },
        plannedDate: { gte: weekStart, lte: horizonEnd },
      },
      orderBy: { plannedDate: "asc" },
      take: 25,
      include: { project: { select: { code: true } } },
    });

    const topRisks = await this.prisma.risk.findMany({
      where: {
        tenantId,
        objectType: scopeType,
        objectId: scopeId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      orderBy: [{ exposureScore: "desc" }],
      take: 5,
      include: {
        actions: {
          where: { status: { not: "CLOSED" } },
          orderBy: { dueDate: "asc" },
          take: 4,
        },
      },
    });

    const issuesClosedInWeek = await this.prisma.issue.findMany({
      where: {
        tenantId,
        objectType: scopeType,
        objectId: scopeId,
        status: "CLOSED",
        resolvedAt: { gte: weekStart, lte: weekEnd },
      },
      take: 15,
      select: { title: true, resolvedAt: true },
    });

    const scopeLabel =
      scopeType === "PROJECT"
        ? `${projects[0].code} — ${projects[0].name}`
        : scopeType === "PROGRAM"
          ? `Program ${scopeId}`
          : scopeType === "PORTFOLIO"
            ? `Portfolio ${scopeId}`
            : `Enterprise ${tenantId}`;

    const overallRag = this.combineOverallRag(scheduleBlock.scheduleStatus, financialBlock.ragStatus, ricBlock);

    const canonical = {
      reportingWeek,
      fiscalPeriod,
      scopeType,
      scopeId,
      schedule: scheduleBlock,
      financial: financialBlock,
      ric: ricBlock,
      milestones: milestones.map((m) => ({
        code: m.code,
        name: m.name,
        plannedDate: m.plannedDate.toISOString(),
        projectCode: m.project.code,
      })),
      topRisks: topRisks.map((r) => ({
        title: r.title,
        severity: r.severity,
        exposureScore: Number(r.exposureScore),
        mitigations: r.actions.map((a) => a.title),
      })),
      issuesClosed: issuesClosedInWeek.map((i) => ({ title: i.title, resolvedAt: i.resolvedAt?.toISOString() ?? "" })),
      overallRag,
    };

    const factsDigest = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");

    const provenance: string[] = [
      `Scheduling:${scheduleBlock.source}`,
      `Financial:${financialBlock.source}`,
      `RIC:${ricBlock.source}`,
      `Milestones:Prisma.Milestone`,
      `Risks:Prisma.Risk`,
      `Issues:Prisma.Issue`,
    ];

    return {
      collectedAt: new Date().toISOString(),
      reportingWeek,
      fiscalPeriod,
      scopeType,
      scopeId,
      scopeLabel,
      includedProjects: projects.map((p) => ({ id: p.id, code: p.code, name: p.name })),
      weekRange: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
      schedule: scheduleBlock,
      financial: financialBlock,
      ric: ricBlock,
      upcomingMilestones: milestones.map((m) => ({
        code: m.code,
        name: m.name,
        plannedDate: m.plannedDate.toISOString(),
        projectCode: m.project.code,
      })),
      topRisks: topRisks.map((r) => ({
        title: r.title,
        severity: r.severity,
        exposureScore: Number(r.exposureScore),
        mitigationActions: r.actions.map((a) => a.title),
      })),
      issuesClosedInWeek: issuesClosedInWeek.map((i) => ({
        title: i.title,
        resolvedAt: i.resolvedAt?.toISOString() ?? "",
      })),
      overallRag,
      factsDigest,
      provenance,
    };
  }

  private combineOverallRag(scheduleStatus: string, costRag?: string, ric?: { criticalCount?: number; highCount?: number }): "GREEN" | "AMBER" | "RED" {
    const order = { GREEN: 1, AMBER: 2, RED: 3 };
    let worst: keyof typeof order = "GREEN";
    const bump = (rag: string | undefined) => {
      if (!rag) return;
      const u = rag.toUpperCase();
      if (u === "GREEN" || u === "AMBER" || u === "RED") {
        if (order[u] > order[worst]) worst = u;
      }
    };
    bump(scheduleStatus);
    bump(costRag);
    if ((ric?.criticalCount ?? 0) > 0) worst = "RED";
    else if ((ric?.highCount ?? 0) > 5) worst = "AMBER";
    else if ((ric?.highCount ?? 0) > 2 && worst === "GREEN") worst = "AMBER";
    return worst;
  }

  private async resolveScopedProjects(
    tenantId: string,
    scopeType: FinancialObjectType,
    scopeId: string,
  ): Promise<Array<{ id: string; plannedBudget: Prisma.Decimal; code: string; name: string }>> {
    switch (scopeType) {
      case "PROJECT": {
        const p = await this.prisma.project.findFirst({
          where: { id: scopeId, tenantId },
          select: { id: true, plannedBudget: true, code: true, name: true },
        });
        if (!p) throw new NotFoundException("Project not found.");
        return [p];
      }
      case "PROGRAM": {
        const g = await this.prisma.program.findFirst({ where: { id: scopeId, tenantId } });
        if (!g) throw new NotFoundException("Program not found.");
        return this.prisma.project.findMany({
          where: { tenantId, programId: scopeId },
          select: { id: true, plannedBudget: true, code: true, name: true },
        });
      }
      case "PORTFOLIO": {
        const pf = await this.prisma.portfolio.findFirst({ where: { id: scopeId, tenantId } });
        if (!pf) throw new NotFoundException("Portfolio not found.");
        return this.prisma.project.findMany({
          where: { tenantId, portfolioId: scopeId },
          select: { id: true, plannedBudget: true, code: true, name: true },
        });
      }
      case "ENTERPRISE": {
        if (scopeId !== tenantId) throw new BadRequestException("ENTERPRISE scope requires scopeId equal to tenantId.");
        return this.prisma.project.findMany({
          where: { tenantId },
          select: { id: true, plannedBudget: true, code: true, name: true },
        });
      }
      default:
        throw new BadRequestException("Unsupported scope type.");
    }
  }

  private async aggregateScheduleForProjects(
    projects: Array<{ id: string; plannedBudget: Prisma.Decimal }>,
    tenantId: string,
    actor: RequestUser,
  ) {
    if (projects.length === 1) {
      const m = await this.schedulingService.calculateProjectProgress(projects[0].id, tenantId, actor);
      return {
        source: "SchedulingService.calculateProjectProgress",
        actualProgressPercent: m.actualProgressPercent,
        expectedProgressPercent: m.expectedProgressPercent,
        scheduleVariancePercent: m.scheduleVariancePercent,
        scheduleStatus: m.scheduleStatus,
        leafTaskCount: m.leafTaskCount,
        includedProjectCount: 1,
      };
    }

    let sumW = 0;
    let aw = 0;
    let ew = 0;
    let leafTotal = 0;
    for (const p of projects) {
      const m = await this.schedulingService.calculateProjectProgress(p.id, tenantId, actor);
      const w = Math.max(Number(p.plannedBudget), 0) || 1;
      sumW += w;
      aw += m.actualProgressPercent * w;
      ew += m.expectedProgressPercent * w;
      leafTotal += m.leafTaskCount ?? 0;
    }
    const actualProgressPercent = sumW ? Number((aw / sumW).toFixed(2)) : 0;
    const expectedProgressPercent = sumW ? Number((ew / sumW).toFixed(2)) : 0;
    const scheduleVariancePercent = Number((actualProgressPercent - expectedProgressPercent).toFixed(2));
    const scheduleStatus = scheduleVariancePercent >= -5 ? "GREEN" : scheduleVariancePercent >= -10 ? "AMBER" : "RED";
    return {
      source: "SchedulingService.calculateProjectProgress.weighted_budget",
      actualProgressPercent,
      expectedProgressPercent,
      scheduleVariancePercent,
      scheduleStatus,
      leafTaskCount: leafTotal,
      includedProjectCount: projects.length,
    };
  }

  private async resolveFinancialSummary(
    tenantId: string,
    scopeType: FinancialObjectType,
    scopeId: string,
    fiscalPeriod: string,
    actor: RequestUser,
    refreshMetrics: boolean,
  ): Promise<CollectedMetrics["financial"]> {
    let summary = !refreshMetrics
      ? await this.prisma.financialSummary.findFirst({
          where: { tenantId, objectType: scopeType, objectId: scopeId, period: fiscalPeriod },
          orderBy: { computedAt: "desc" },
        })
      : null;

    if (!summary) {
      try {
        const out = await this.financialService.computeSummary({ tenantId, objectType: scopeType, objectId: scopeId, period: fiscalPeriod }, actor);
        summary = out.summary;
      } catch {
        return {
          source: "FinancialService.computeSummary.unavailable",
          unavailableReason: "No budgets/summary could be computed for this scope and fiscal period.",
        };
      }
    }

    return {
      source: "FinancialSummary.snapshot",
      summaryId: summary.id,
      totalApprovedBudget: Number(summary.totalApprovedBudget),
      totalForecastEac: Number(summary.totalForecastEac),
      totalActualCost: Number(summary.totalActualCost),
      costVariancePercent: Number(summary.costVariancePercent),
      ragStatus: summary.ragStatus,
    };
  }

  private async resolveRicRollup(
    tenantId: string,
    scopeType: FinancialObjectType,
    scopeId: string,
    fiscalPeriod: string,
    actor: RequestUser,
    refreshMetrics: boolean,
  ): Promise<CollectedMetrics["ric"]> {
    let rollup = !refreshMetrics
      ? await this.prisma.ricRollupSummary.findFirst({
          where: { tenantId, objectType: scopeType, objectId: scopeId, period: fiscalPeriod },
          orderBy: { computedAt: "desc" },
        })
      : null;

    if (!rollup) {
      try {
        rollup = await this.ricService.computeRollup(tenantId, scopeType, scopeId, fiscalPeriod, actor);
      } catch {
        return {
          source: "RicService.computeRollup.unavailable",
          unavailableReason: "RIC rollup could not be computed.",
        };
      }
    }

    return {
      source: "RicRollupSummary.latest_or_compute",
      rollupId: rollup.id,
      riskExposureTotal: Number(rollup.riskExposureTotal),
      issueWeightedTotal: Number(rollup.issueWeightedTotal),
      criticalCount: rollup.criticalCount,
      highCount: rollup.highCount,
      mediumCount: rollup.mediumCount,
      lowCount: rollup.lowCount,
    };
  }
}
