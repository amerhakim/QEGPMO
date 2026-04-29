import { Body, Controller, Param, Post, Query, UseGuards } from "@nestjs/common";
import { FinancialObjectType } from "@prisma/client";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { RicExportDto, RicImportCommitDto, RicImportPreviewDto } from "./dto/ric-excel.dto";
import {
  CreateChangeRequestDto,
  CreateIssueDto,
  CreateRicActionDto,
  CreateRiskDto,
  UpdateRecordStatusDto,
} from "./dto/risk-issue-change.dto";
import { RicService } from "./ric.service";

@Controller("ric")
@UseGuards(AuthGuard, RbacGuard)
export class RicController {
  constructor(private readonly ricService: RicService) {}

  @Post("risks")
  @Permissions("ric.risk.create")
  createRisk(@Body() dto: CreateRiskDto, @Actor() actor: RequestUser) {
    return this.ricService.createRisk(dto, actor);
  }

  @Post("issues")
  @Permissions("ric.issue.create")
  createIssue(@Body() dto: CreateIssueDto, @Actor() actor: RequestUser) {
    return this.ricService.createIssue(dto, actor);
  }

  @Post("changes")
  @Permissions("ric.change.create")
  createChange(@Body() dto: CreateChangeRequestDto, @Actor() actor: RequestUser) {
    return this.ricService.createChangeRequest(dto, actor);
  }

  @Post("actions")
  @Permissions("ric.action.create")
  createAction(@Body() dto: CreateRicActionDto, @Actor() actor: RequestUser) {
    return this.ricService.createAction(dto, actor);
  }

  @Post("risks/:id/status")
  @Permissions("ric.risk.update")
  updateRiskStatus(@Param("id") id: string, @Body() dto: UpdateRecordStatusDto, @Actor() actor: RequestUser) {
    return this.ricService.updateRiskStatus(id, dto, actor);
  }

  @Post("issues/:id/status")
  @Permissions("ric.issue.update")
  updateIssueStatus(@Param("id") id: string, @Body() dto: UpdateRecordStatusDto, @Actor() actor: RequestUser) {
    return this.ricService.updateIssueStatus(id, dto, actor);
  }

  @Post("rollup")
  @Permissions("ric.rollup.compute")
  computeRollup(
    @Query("tenantId") tenantId: string,
    @Query("objectType") objectType: FinancialObjectType,
    @Query("objectId") objectId: string,
    @Query("period") period: string,
    @Actor() actor: RequestUser,
  ) {
    return this.ricService.computeRollup(tenantId, objectType, objectId, period, actor);
  }

  @Post("issues/escalation/run")
  @Permissions("ric.issue.escalate")
  runEscalation() {
    return this.ricService.runIssueEscalation();
  }

  @Post("excel/import/preview")
  @Permissions("ric.excel.import")
  importPreview(@Body() dto: RicImportPreviewDto, @Actor() actor: RequestUser) {
    return this.ricService.importPreview(dto, actor);
  }

  @Post("excel/import/commit/:jobId")
  @Permissions("ric.excel.import")
  importCommit(@Param("jobId") jobId: string, @Body() dto: RicImportCommitDto, @Actor() actor: RequestUser) {
    return this.ricService.importCommit(jobId, dto, actor);
  }

  @Post("excel/export")
  @Permissions("ric.excel.export")
  export(@Body() dto: RicExportDto, @Actor() actor: RequestUser) {
    return this.ricService.exportData(dto, actor);
  }
}
