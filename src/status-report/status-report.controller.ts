import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { EditWeeklyStatusReportDto } from "./dto/edit-weekly-status-report.dto";
import { ExportWeeklyStatusReportDto } from "./dto/export-weekly-status-report.dto";
import { GenerateWeeklyStatusReportDto } from "./dto/generate-weekly-status-report.dto";
import { SubmitWeeklyStatusReportDto } from "./dto/submit-weekly-status-report.dto";
import { StatusReportService } from "./status-report.service";

@Controller("weekly-status-reports")
@UseGuards(AuthGuard, RbacGuard)
export class StatusReportController {
  constructor(private readonly statusReportService: StatusReportService) {}

  @Post("generate")
  @Permissions("status_report.generate")
  generate(@Body() dto: GenerateWeeklyStatusReportDto, @Actor() actor: RequestUser) {
    return this.statusReportService.generate(dto, actor);
  }

  @Get()
  @Permissions("status_report.read")
  list(@Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.statusReportService.list(tenantId, actor);
  }

  @Get(":id")
  @Permissions("status_report.read")
  getOne(@Param("id") id: string, @Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.statusReportService.getOne(id, tenantId, actor);
  }

  @Get(":id/revisions")
  @Permissions("status_report.read")
  revisions(@Param("id") id: string, @Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.statusReportService.listRevisions(id, tenantId, actor);
  }

  @Patch(":id")
  @Permissions("status_report.edit")
  edit(@Param("id") id: string, @Body() dto: EditWeeklyStatusReportDto, @Actor() actor: RequestUser) {
    return this.statusReportService.edit(id, dto, actor);
  }

  @Post(":id/submit-for-approval")
  @Permissions("status_report.submit")
  submitForApproval(@Param("id") id: string, @Body() dto: SubmitWeeklyStatusReportDto, @Actor() actor: RequestUser) {
    return this.statusReportService.submitForApproval(id, dto, actor);
  }

  @Post(":id/export")
  @Permissions("status_report.export")
  async export(
    @Param("id") id: string,
    @Body() dto: ExportWeeklyStatusReportDto,
    @Actor() actor: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.statusReportService.exportReport(id, dto, actor);
    res.setHeader("X-Export-Job-Id", out.jobId);
    return new StreamableFile(out.buffer, {
      type: out.mimeType,
      disposition: `attachment; filename="${out.fileName}"`,
    });
  }
}
