import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { CreateBaselineDto } from "./dto/create-baseline.dto";
import { CreateDependencyDto } from "./dto/create-dependency.dto";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { CommitScheduleImportDto, ExportScheduleDto, ImportScheduleDto } from "./dto/schedule-excel.dto";
import { UpdateTaskProgressDto } from "./dto/update-task-progress.dto";
import { SchedulingService } from "./scheduling.service";

@Controller("scheduling")
@UseGuards(AuthGuard, RbacGuard)
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post("tasks")
  @Permissions("scheduling.task.create")
  createTask(@Body() dto: CreateTaskDto, @Actor() actor: RequestUser) {
    return this.schedulingService.createTask(dto, actor);
  }

  @Get("wbs/:projectId")
  @Permissions("scheduling.task.read")
  listWbs(
    @Param("projectId") projectId: string,
    @Query("tenantId") tenantId: string,
    @Actor() actor: RequestUser,
  ) {
    return this.schedulingService.listWbs(projectId, tenantId, actor);
  }

  @Post("milestones")
  @Permissions("scheduling.milestone.create")
  createMilestone(@Body() dto: CreateMilestoneDto, @Actor() actor: RequestUser) {
    return this.schedulingService.createMilestone(dto, actor);
  }

  @Post("dependencies")
  @Permissions("scheduling.dependency.create")
  createDependency(@Body() dto: CreateDependencyDto, @Actor() actor: RequestUser) {
    return this.schedulingService.createDependency(dto, actor);
  }

  @Post("tasks/:taskId/progress")
  @Permissions("scheduling.progress.update")
  updateProgress(
    @Param("taskId") taskId: string,
    @Body() dto: UpdateTaskProgressDto,
    @Actor() actor: RequestUser,
  ) {
    return this.schedulingService.updateTaskProgress(taskId, dto, actor);
  }

  @Post("baselines")
  @Permissions("scheduling.baseline.create")
  createBaseline(@Body() dto: CreateBaselineDto, @Actor() actor: RequestUser) {
    return this.schedulingService.createBaseline(dto, actor);
  }

  @Get("progress/:projectId")
  @Permissions("scheduling.progress.read")
  calculateProjectProgress(
    @Param("projectId") projectId: string,
    @Query("tenantId") tenantId: string,
    @Actor() actor: RequestUser,
  ) {
    return this.schedulingService.calculateProjectProgress(projectId, tenantId, actor);
  }

  @Post("excel/import/preview")
  @Permissions("scheduling.excel.import")
  importPreview(@Body() dto: ImportScheduleDto, @Actor() actor: RequestUser) {
    return this.schedulingService.importSchedulePreview(dto, actor);
  }

  @Post("excel/import/commit/:jobId")
  @Permissions("scheduling.excel.import")
  importCommit(
    @Param("jobId") jobId: string,
    @Body() dto: CommitScheduleImportDto,
    @Actor() actor: RequestUser,
  ) {
    return this.schedulingService.commitScheduleImport(jobId, dto.tenantId, actor);
  }

  @Post("excel/export")
  @Permissions("scheduling.excel.export")
  exportSchedule(@Body() dto: ExportScheduleDto, @Actor() actor: RequestUser) {
    return this.schedulingService.exportSchedule(dto, actor);
  }
}
