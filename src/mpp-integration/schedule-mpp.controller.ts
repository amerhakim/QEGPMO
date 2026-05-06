import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import type { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import type { MppImportMergeMode } from "./canonical-schedule.types";
import { CommitMppImportDto } from "./dto/commit-mpp-import.dto";
import { ExportScheduleMspDto } from "./dto/export-schedule-msp.dto";
import { ScheduleMppService } from "./schedule-mpp.service";

function parseMergeMode(raw: string | undefined): MppImportMergeMode {
  return raw === "REPLACE_SCHEDULE" ? "REPLACE_SCHEDULE" : "STRICT_APPEND";
}

@Controller("schedule-mpp")
@UseGuards(AuthGuard, RbacGuard)
export class ScheduleMppController {
  constructor(private readonly scheduleMpp: ScheduleMppService) {}

  @Post("projects/:projectId/import/validate")
  @Permissions("scheduling.mpp.validate")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 52 * 1024 * 1024 },
    }),
  )
  validateImport(
    @Param("projectId") projectId: string,
    @Query("tenantId") tenantId: string,
    @Query("mergeMode") mergeModeRaw: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Actor() actor: RequestUser,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Missing upload file.");
    }
    return this.scheduleMpp.validateUpload({
      tenantId,
      projectId,
      mergeMode: parseMergeMode(mergeModeRaw),
      fileName: file.originalname,
      buffer: file.buffer,
      actor,
    });
  }

  @Post("import/:jobId/commit")
  @Permissions("scheduling.mpp.import")
  commitImport(@Param("jobId") jobId: string, @Body() dto: CommitMppImportDto, @Actor() actor: RequestUser) {
    return this.scheduleMpp.commitImport(jobId, dto, actor);
  }

  @Get("jobs/:jobId")
  @Permissions("scheduling.mpp.read")
  getJob(
    @Param("jobId") jobId: string,
    @Query("tenantId") tenantId: string,
    @Actor() actor: RequestUser,
  ) {
    return this.scheduleMpp.getJob(jobId, tenantId, actor);
  }

  @Post("projects/:projectId/export")
  @Permissions("scheduling.mpp.export")
  async exportProject(
    @Param("projectId") projectId: string,
    @Body() dto: ExportScheduleMspDto,
    @Actor() actor: RequestUser,
  ) {
    const out = await this.scheduleMpp.exportProject(projectId, dto.tenantId, actor);
    return new StreamableFile(out.buffer, {
      type: out.mimeType,
      disposition: `attachment; filename="${out.fileName}"`,
    });
  }
}
