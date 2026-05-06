import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { DetectedRiskSuggestionStatus } from "@prisma/client";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { DismissDetectedRiskSuggestionDto } from "./dto/dismiss-detected-risk.dto";
import { RunRiskDetectionDto } from "./dto/run-risk-detection.dto";
import { SubmitDetectedRiskSuggestionDto } from "./dto/submit-detected-risk.dto";
import { RiskDetectionService } from "./risk-detection.service";

@Controller("risk-detection")
@UseGuards(AuthGuard, RbacGuard)
export class RiskDetectionController {
  constructor(private readonly riskDetectionService: RiskDetectionService) {}

  @Post("runs")
  @Permissions("risk_detection.run")
  run(@Body() dto: RunRiskDetectionDto, @Actor() actor: RequestUser) {
    return this.riskDetectionService.runAnalysis(dto, actor);
  }

  @Get("runs")
  @Permissions("risk_detection.read")
  listRuns(@Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.riskDetectionService.listRuns(tenantId, actor);
  }

  @Get("runs/:runId")
  @Permissions("risk_detection.read")
  getRun(@Param("runId") runId: string, @Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.riskDetectionService.getRun(runId, tenantId, actor);
  }

  @Get("suggestions")
  @Permissions("risk_detection.read")
  listSuggestions(
    @Query("tenantId") tenantId: string,
    @Query("status") status: DetectedRiskSuggestionStatus | undefined,
    @Query("runId") runId: string | undefined,
    @Actor() actor: RequestUser,
  ) {
    return this.riskDetectionService.listSuggestions(tenantId, actor, status, runId);
  }

  @Get("suggestions/:suggestionId")
  @Permissions("risk_detection.read")
  getSuggestion(@Param("suggestionId") suggestionId: string, @Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.riskDetectionService.getSuggestion(suggestionId, tenantId, actor);
  }

  @Post("suggestions/:suggestionId/submit-for-approval")
  @Permissions("risk_detection.submit")
  submitForApproval(
    @Param("suggestionId") suggestionId: string,
    @Body() dto: SubmitDetectedRiskSuggestionDto,
    @Actor() actor: RequestUser,
  ) {
    return this.riskDetectionService.submitForApproval(suggestionId, dto, actor);
  }

  @Post("suggestions/:suggestionId/dismiss")
  @Permissions("risk_detection.dismiss")
  dismiss(@Param("suggestionId") suggestionId: string, @Body() dto: DismissDetectedRiskSuggestionDto, @Actor() actor: RequestUser) {
    return this.riskDetectionService.dismiss(suggestionId, dto, actor);
  }
}
