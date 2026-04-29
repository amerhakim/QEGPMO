import { Body, Controller, Param, Post, Query, UseGuards } from "@nestjs/common";
import { FinancialObjectType } from "@prisma/client";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import {
  ComputeFinancialSummaryDto,
  CreateActualCostDto,
  CreateBudgetBaselineDto,
  CreateBudgetDto,
  CreateForecastDto,
} from "./dto/budget.dto";
import { FinancialExportDto, FinancialImportCommitDto, FinancialImportPreviewDto } from "./dto/financial-excel.dto";
import { FinancialService } from "./financial.service";

@Controller("financial")
@UseGuards(AuthGuard, RbacGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post("budgets")
  @Permissions("financial.budget.create")
  createBudget(@Body() dto: CreateBudgetDto, @Actor() actor: RequestUser) {
    return this.financialService.createBudget(dto, actor);
  }

  @Post("budgets/:budgetId/baselines")
  @Permissions("financial.baseline.create")
  createBudgetBaseline(
    @Param("budgetId") budgetId: string,
    @Body() dto: CreateBudgetBaselineDto,
    @Actor() actor: RequestUser,
  ) {
    return this.financialService.createBudgetBaseline(budgetId, dto, actor);
  }

  @Post("budgets/:budgetId/forecasts")
  @Permissions("financial.forecast.create")
  createForecast(
    @Param("budgetId") budgetId: string,
    @Body() dto: CreateForecastDto,
    @Actor() actor: RequestUser,
  ) {
    return this.financialService.createForecast(budgetId, dto, actor);
  }

  @Post("budgets/:budgetId/actual-costs")
  @Permissions("financial.actual.create")
  createActualCost(
    @Param("budgetId") budgetId: string,
    @Body() dto: CreateActualCostDto,
    @Actor() actor: RequestUser,
  ) {
    return this.financialService.createActualCost(budgetId, dto, actor);
  }

  @Post("summary")
  @Permissions("financial.summary.compute")
  computeSummary(@Body() dto: ComputeFinancialSummaryDto, @Actor() actor: RequestUser) {
    return this.financialService.computeSummary(dto, actor);
  }

  @Post("rollup")
  @Permissions("financial.rollup.compute")
  computeRollup(
    @Query("tenantId") tenantId: string,
    @Query("objectType") objectType: FinancialObjectType,
    @Query("objectId") objectId: string,
    @Query("period") period: string,
    @Actor() actor: RequestUser,
  ) {
    return this.financialService.computeRollup(tenantId, objectType, objectId, period, actor);
  }

  @Post("excel/import/preview")
  @Permissions("financial.excel.import")
  importPreview(@Body() dto: FinancialImportPreviewDto, @Actor() actor: RequestUser) {
    return this.financialService.importPreview(dto, actor);
  }

  @Post("excel/import/commit/:jobId")
  @Permissions("financial.excel.import")
  importCommit(
    @Param("jobId") jobId: string,
    @Body() dto: FinancialImportCommitDto,
    @Actor() actor: RequestUser,
  ) {
    return this.financialService.importCommit(jobId, dto, actor);
  }

  @Post("excel/export")
  @Permissions("financial.excel.export")
  exportData(@Body() dto: FinancialExportDto, @Actor() actor: RequestUser) {
    return this.financialService.exportData(dto, actor);
  }
}
