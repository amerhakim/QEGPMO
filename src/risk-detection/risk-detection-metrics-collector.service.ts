import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AllocationStatus, FinancialObjectType, Prisma } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { FinancialService } from "../financial/financial.service";
import { PrismaService } from "../prisma/prisma.service";
import { RicService } from "../ric/ric.service";
import { SchedulingService } from "../scheduling/scheduling.service";

export interface DetectionMetricsPack {
  collectedAt: string;
  tenantId: string;
  scopeType: FinancialObjectType;
  scopeId: string;
  periodLabel: string;
  scopeLabel: string;
  projectIds: string[];
  schedule?: {
    source: string;
    actualProgressPercent: number;
    expectedProgressPercent: number;
    scheduleVariancePercent: number;
    scheduleStatus: string;
    includedProjectCount?: number;
  };
  financial?: {
    source: string;
    costVariancePercent?: number;
    ragStatus?: string;
    unavailableReason?: string;
  };
  ricRollup?: {
    source: string;
    riskExposureTotal?: number;
    criticalCount?: number;
    highCount?: number;
    unavailableReason?: string;
  };
  resourceStress: Array<{
    resourceId: string;
    resourceCode: string;
    sumAllocationPercent: number;
    thresholdPercent: number;
    overAllocated: boolean;
  }>;
  dependencyLagCount: number;
  openRiskSeverityCounts: { critical: number; high: number };
  escalatedOpenIssues: number;
  programProjectScheduleBands?: Array<{ projectId: string; code: string; scheduleStatus: string }>;
  provenance: string[];
}

@Injectable()
export class RiskDetectionMetricsCollectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingService: SchedulingService,
    private readonly financialService: FinancialService,
    private readonly ricService: RicService,
  ) {}

  async collect(
    tenantId: string,
    scopeType: FinancialObjectType,
    scopeId: string,
    periodLabel: string,
    actor: RequestUser,
    refreshMetrics: boolean,
  ): Promise<DetectionMetricsPack> {
    const projects = await this.resolveScopedProjects(tenantId, scopeType, scopeId);
    const projectIds = projects.map((p) => p.id);
    const provenance: string[] = [];

    if (refreshMetrics) {
      try {
        await this.financialService.computeSummary({ tenantId, objectType: scopeType, objectId: scopeId, period: periodLabel }, actor);
        provenance.push("FinancialSummary.refreshed_via_computeSummary");
      } catch {
        provenance.push("FinancialSummary.refresh_skipped_or_unavailable");
      }
      try {
        await this.ricService.computeRollup(tenantId, scopeType, scopeId, periodLabel, actor);
        provenance.push("RicRollupSummary.refreshed_via_computeRollup");
      } catch {
        provenance.push("RIC.refresh_skipped");
      }
    }

    const schedule = await this.aggregateSchedule(projects, tenantId, actor);
    provenance.push(schedule.source);

    const financialRow = await this.prisma.financialSummary.findFirst({
      where: { tenantId, objectType: scopeType, objectId: scopeId, period: periodLabel },
      orderBy: { computedAt: "desc" },
    });
    const financialBlock = financialRow
      ? {
          source: "FinancialSummary.latest",
          costVariancePercent: Number(financialRow.costVariancePercent),
          ragStatus: financialRow.ragStatus,
        }
      : {
          source: "FinancialSummary.missing",
          unavailableReason: "No FinancialSummary row for tenant/object/period.",
        };
    provenance.push(financialBlock.source);

    const ricRow = await this.prisma.ricRollupSummary.findFirst({
      where: { tenantId, objectType: scopeType, objectId: scopeId, period: periodLabel },
      orderBy: { computedAt: "desc" },
    });
    const ricBlock = ricRow
      ? {
          source: "RicRollupSummary.latest",
          riskExposureTotal: Number(ricRow.riskExposureTotal),
          criticalCount: ricRow.criticalCount,
          highCount: ricRow.highCount,
        }
      : {
          source: "RicRollupSummary.missing",
          unavailableReason: "No RIC rollup row for tenant/object/period.",
        };
    provenance.push(ricBlock.source);

    const allocations = await this.prisma.resourceAllocation.findMany({
      where: {
        tenantId,
        objectType: "PROJECT",
        objectId: { in: projectIds },
        status: AllocationStatus.APPROVED,
        resourceId: { not: null },
      },
      include: { resource: true },
    });
    const sumByResource = new Map<string, number>();
    for (const a of allocations) {
      if (!a.resourceId) continue;
      sumByResource.set(a.resourceId, (sumByResource.get(a.resourceId) ?? 0) + Number(a.allocationPercent));
    }
    const resourceStress: DetectionMetricsPack["resourceStress"] = [];
    for (const [resourceId, sumAllocationPercent] of sumByResource) {
      const r = await this.prisma.resource.findFirst({ where: { id: resourceId, tenantId } });
      if (!r) continue;
      const thresholdPercent = Number(r.overAllocationThresholdPercent);
      resourceStress.push({
        resourceId,
        resourceCode: r.code,
        sumAllocationPercent,
        thresholdPercent,
        overAllocated: sumAllocationPercent > thresholdPercent,
      });
    }
    provenance.push("ResourceAllocation.APPROVED.sum_by_resource");

    const deps = await this.prisma.taskDependency.findMany({
      where: { tenantId, projectId: { in: projectIds } },
      include: { successorTask: true },
    });
    const now = new Date();
    let dependencyLagCount = 0;
    for (const d of deps) {
      const succ = d.successorTask;
      if (!succ) continue;
      if (succ.plannedEndDate < now && Number(succ.progressPercent) < 100) {
        dependencyLagCount += 1;
      }
    }
    provenance.push("TaskDependency.successor_behind_planned_finish");

    const openRisks = await this.prisma.risk.findMany({
      where: {
        tenantId,
        objectType: scopeType,
        objectId: scopeId,
        status: { not: "CLOSED" },
      },
      select: { severity: true },
    });
    const openRiskSeverityCounts = {
      critical: openRisks.filter((x) => x.severity === "CRITICAL").length,
      high: openRisks.filter((x) => x.severity === "HIGH").length,
    };
    provenance.push("Risk.open_counts_by_severity");

    const escalatedOpenIssues = await this.prisma.issue.count({
      where: {
        tenantId,
        objectType: scopeType,
        objectId: scopeId,
        status: { not: "CLOSED" },
        isEscalated: true,
      },
    });
    provenance.push("Issue.escalated_open_count");

    let programProjectScheduleBands: DetectionMetricsPack["programProjectScheduleBands"];
    if (scopeType === "PROGRAM") {
      programProjectScheduleBands = [];
      for (const p of projects) {
        const m = await this.schedulingService.calculateProjectProgress(p.id, tenantId, actor);
        programProjectScheduleBands.push({
          projectId: p.id,
          code: p.code,
          scheduleStatus: m.scheduleStatus,
        });
      }
      provenance.push("SchedulingService.calculateProjectProgress.per_program_project");
    }

    const scopeLabel =
      scopeType === "PROJECT"
        ? `${projects[0].code} — ${projects[0].name}`
        : `${scopeType} ${scopeId}`;

    return {
      collectedAt: new Date().toISOString(),
      tenantId,
      scopeType,
      scopeId,
      periodLabel,
      scopeLabel,
      projectIds,
      schedule,
      financial: financialBlock,
      ricRollup: ricBlock,
      resourceStress,
      dependencyLagCount,
      openRiskSeverityCounts,
      escalatedOpenIssues,
      programProjectScheduleBands,
      provenance,
    };
  }

  private async aggregateSchedule(
    projects: Array<{ id: string; plannedBudget: Prisma.Decimal; code: string; name: string }>,
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
        includedProjectCount: 1,
      };
    }
    let sumW = 0;
    let aw = 0;
    let ew = 0;
    for (const p of projects) {
      const m = await this.schedulingService.calculateProjectProgress(p.id, tenantId, actor);
      const w = Math.max(Number(p.plannedBudget), 0) || 1;
      sumW += w;
      aw += m.actualProgressPercent * w;
      ew += m.expectedProgressPercent * w;
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
      includedProjectCount: projects.length,
    };
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
        throw new BadRequestException("Unsupported detection scope.");
    }
  }
}
