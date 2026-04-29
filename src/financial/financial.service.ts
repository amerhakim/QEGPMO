import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { FinancialAlertRag, FinancialObjectType, Prisma } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../workflow/audit.service";
import {
  ComputeFinancialSummaryDto,
  CreateActualCostDto,
  CreateBudgetBaselineDto,
  CreateBudgetDto,
  CreateForecastDto,
} from "./dto/budget.dto";
import { FinancialExportDto, FinancialImportCommitDto, FinancialImportPreviewDto } from "./dto/financial-excel.dto";

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createBudget(dto: CreateBudgetDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const budget = await this.prisma.financialBudget.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        fiscalPeriod: dto.fiscalPeriod,
        category: dto.category,
        plannedAmount: this.decimal(dto.plannedAmount),
        approvedAmount: this.decimal(dto.approvedAmount),
      },
    });
    await this.audit(dto.tenantId, "FinancialBudget", budget.id, "BUDGET_CREATED", actor.userId, undefined, budget);
    return budget;
  }

  async createBudgetBaseline(budgetId: string, dto: CreateBudgetBaselineDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureBudget(budgetId, dto.tenantId);
    const baseline = await this.prisma.financialBudgetBaseline.create({
      data: {
        tenantId: dto.tenantId,
        budgetId,
        baselineVersion: dto.baselineVersion,
        baselineAmount: this.decimal(dto.baselineAmount),
        approvedBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "FinancialBudgetBaseline", baseline.id, "BUDGET_BASELINE_APPROVED", actor.userId, undefined, baseline);
    return baseline;
  }

  async createForecast(budgetId: string, dto: CreateForecastDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const budget = await this.ensureBudget(budgetId, dto.tenantId);
    const actualToDate = await this.sumActuals(budgetId, dto.tenantId);
    const eac = dto.estimateAtCompletion ?? Number((actualToDate + dto.estimateToComplete).toFixed(2));
    const forecast = await this.prisma.financialForecast.create({
      data: {
        tenantId: dto.tenantId,
        budgetId,
        forecastPeriod: dto.forecastPeriod,
        estimateToComplete: this.decimal(dto.estimateToComplete),
        estimateAtCompletion: this.decimal(eac),
        notes: dto.notes,
        createdBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "FinancialForecast", forecast.id, "FORECAST_CREATED", actor.userId, undefined, {
      ...forecast,
      budgetApprovedAmount: budget.approvedAmount,
    });
    return forecast;
  }

  async createActualCost(budgetId: string, dto: CreateActualCostDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureBudget(budgetId, dto.tenantId);
    const actual = await this.prisma.financialActualCost.create({
      data: {
        tenantId: dto.tenantId,
        budgetId,
        postingPeriod: dto.postingPeriod,
        postingDate: new Date(dto.postingDate),
        amount: this.decimal(dto.amount),
        sourceReference: dto.sourceReference,
        createdBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "FinancialActualCost", actual.id, "ACTUAL_COST_CREATED", actor.userId, undefined, actual);
    return actual;
  }

  async computeSummary(dto: ComputeFinancialSummaryDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const budgets = await this.prisma.financialBudget.findMany({
      where: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        fiscalPeriod: dto.period,
      },
      include: {
        forecasts: { where: { forecastPeriod: dto.period }, orderBy: { createdAt: "desc" }, take: 1 },
        actuals: { where: { postingPeriod: dto.period } },
      },
    });

    if (!budgets.length) throw new NotFoundException("No budgets found for summary scope.");

    const approved = budgets.reduce((sum, b) => sum + Number(b.approvedAmount), 0);
    const eac = budgets.reduce((sum, b) => {
      const latestEac = b.forecasts[0] ? Number(b.forecasts[0].estimateAtCompletion) : Number(b.approvedAmount);
      return sum + latestEac;
    }, 0);
    const actual = budgets.reduce(
      (sum, b) => sum + b.actuals.reduce((inner, a) => inner + Number(a.amount), 0),
      0,
    );

    const cv = Number((approved - eac).toFixed(2));
    const cvPercent = approved === 0 ? 0 : Number((((approved - eac) / approved) * 100).toFixed(2));
    const rag = this.toFinancialRag(cvPercent);

    const summary = await this.prisma.financialSummary.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        period: dto.period,
        totalApprovedBudget: this.decimal(approved),
        totalForecastEac: this.decimal(eac),
        totalActualCost: this.decimal(actual),
        costVariance: this.decimal(cv),
        costVariancePercent: this.decimal(cvPercent),
        ragStatus: rag,
      },
    });

    const alert = await this.prisma.financialAlert.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        period: dto.period,
        metric: "CV_PERCENT",
        thresholdGreen: this.decimal(-5),
        thresholdAmber: this.decimal(-10),
        thresholdRed: this.decimal(-10.01),
        actualValue: this.decimal(cvPercent),
        ragStatus: rag,
      },
    });

    await this.audit(dto.tenantId, "FinancialSummary", summary.id, "FINANCIAL_SUMMARY_COMPUTED", actor.userId, undefined, {
      summary,
      alert,
      formula: {
        etc: "input",
        eac: "actual_to_date + etc (or provided)",
        cv: "approved_budget - eac",
        cvPercent: "(approved_budget - eac) / approved_budget * 100",
      },
    });
    return { summary, alert };
  }

  async computeRollup(tenantId: string, objectType: FinancialObjectType, objectId: string, period: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    // deterministic: aggregate latest summaries in scope
    const summaries = await this.prisma.financialSummary.findMany({
      where: { tenantId, objectType, objectId, period },
      orderBy: { computedAt: "desc" },
    });
    if (!summaries.length) {
      return this.computeSummary({ tenantId, objectType, objectId, period }, actor);
    }
    const latest = summaries[0];
    return { rollup: latest };
  }

  async importPreview(dto: FinancialImportPreviewDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const rows = dto.payload ?? [];
    const errors: Array<{ index: number; reason: string }> = [];
    rows.forEach((r, i) => {
      if (!r || typeof r !== "object") errors.push({ index: i, reason: "Invalid row payload." });
    });
    const job = await this.prisma.financialExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        operation: "IMPORT",
        entityName: dto.entityName,
        status: "VALIDATED",
        fileName: dto.fileName,
        rowCount: rows.length,
        payloadJson: rows as unknown as Prisma.InputJsonValue,
        resultSummary: {
          totalRows: rows.length,
          validRows: rows.length - errors.length,
          rejectedRows: errors.length,
          errors,
        },
        createdBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "FinancialExcelJob", job.id, "FINANCIAL_IMPORT_PREVIEWED", actor.userId, undefined, job);
    return job;
  }

  async importCommit(jobId: string, dto: FinancialImportCommitDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const job = await this.prisma.financialExcelJob.findFirst({
      where: { id: jobId, tenantId: dto.tenantId, operation: "IMPORT", status: "VALIDATED" },
    });
    if (!job) throw new NotFoundException("Validated import job not found.");

    const rows = (job.payloadJson ?? []) as unknown as Record<string, unknown>[];
    let inserted = 0;
    const errors: Array<{ index: number; reason: string }> = [];
    for (let i = 0; i < rows.length; i += 1) {
      try {
        const row = rows[i] as Record<string, unknown>;
        if (job.entityName === "BUDGET") {
          await this.createBudget(row as unknown as CreateBudgetDto, actor);
        } else if (job.entityName === "FORECAST") {
          await this.createForecast(String(row.budgetId), row as unknown as CreateForecastDto, actor);
        } else if (job.entityName === "ACTUAL_COST") {
          await this.createActualCost(String(row.budgetId), row as unknown as CreateActualCostDto, actor);
        } else if (job.entityName === "SUMMARY") {
          await this.computeSummary(row as unknown as ComputeFinancialSummaryDto, actor);
        } else {
          throw new BadRequestException("Unsupported import entityName.");
        }
        inserted += 1;
      } catch (error) {
        errors.push({ index: i, reason: (error as Error).message });
      }
    }

    const updated = await this.prisma.financialExcelJob.update({
      where: { id: jobId },
      data: {
        status: errors.length ? "FAILED" : "COMPLETED",
        resultSummary: {
          totalRows: rows.length,
          insertedRows: inserted,
          rejectedRows: errors.length,
          errors,
        },
      },
    });
    await this.audit(dto.tenantId, "FinancialExcelJob", jobId, "FINANCIAL_IMPORT_COMMITTED", actor.userId, job, updated);
    return updated;
  }

  async exportData(dto: FinancialExportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    let rows: unknown[] = [];
    if (dto.entityName === "BUDGET") {
      rows = await this.prisma.financialBudget.findMany({ where: { tenantId: dto.tenantId, fiscalPeriod: dto.period } });
    } else if (dto.entityName === "FORECAST") {
      rows = await this.prisma.financialForecast.findMany({ where: { tenantId: dto.tenantId, forecastPeriod: dto.period } });
    } else if (dto.entityName === "ACTUAL_COST") {
      rows = await this.prisma.financialActualCost.findMany({ where: { tenantId: dto.tenantId, postingPeriod: dto.period } });
    } else if (dto.entityName === "SUMMARY") {
      rows = await this.prisma.financialSummary.findMany({ where: { tenantId: dto.tenantId, period: dto.period } });
    }

    const job = await this.prisma.financialExcelJob.create({
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
    await this.audit(dto.tenantId, "FinancialExcelJob", job.id, "FINANCIAL_EXPORT_COMPLETED", actor.userId, undefined, {
      rowCount: rows.length,
    });
    return { jobId: job.id, rows };
  }

  private toFinancialRag(cvPercent: number): FinancialAlertRag {
    if (cvPercent >= -5) return "GREEN";
    if (cvPercent >= -10) return "AMBER";
    return "RED";
  }

  private async ensureBudget(id: string, tenantId: string) {
    const budget = await this.prisma.financialBudget.findFirst({ where: { id, tenantId } });
    if (!budget) throw new NotFoundException("Budget not found.");
    return budget;
  }

  private async sumActuals(budgetId: string, tenantId: string): Promise<number> {
    const rows = await this.prisma.financialActualCost.findMany({ where: { budgetId, tenantId } });
    return Number(rows.reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2));
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (tenantId !== actor.tenantId) {
      throw new ForbiddenException("Cross-tenant access denied.");
    }
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
