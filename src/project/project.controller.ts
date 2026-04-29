import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { CreateProjectDto } from "./dto/create-project.dto";
import { GateDecisionDto } from "./dto/gate-decision.dto";
import { ExportProjectsDto, ImportProjectsDto } from "./dto/project-excel.dto";
import { TransitionPhaseDto } from "./dto/transition-phase.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectService } from "./project.service";

@Controller("projects")
@UseGuards(AuthGuard, RbacGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Permissions("project.create")
  create(@Body() dto: CreateProjectDto, @Actor() actor: RequestUser) {
    return this.projectService.createProject(dto, actor);
  }

  @Get()
  @Permissions("project.read")
  list(@Query("tenantId") tenantId: string, @Actor() actor: RequestUser) {
    return this.projectService.listProjects(tenantId, actor);
  }

  @Get(":projectId")
  @Permissions("project.read")
  get(
    @Param("projectId") projectId: string,
    @Query("tenantId") tenantId: string,
    @Actor() actor: RequestUser,
  ) {
    return this.projectService.getProject(projectId, tenantId, actor);
  }

  @Patch(":projectId")
  @Permissions("project.update")
  update(@Param("projectId") projectId: string, @Body() dto: UpdateProjectDto, @Actor() actor: RequestUser) {
    return this.projectService.updateProject(projectId, dto, actor);
  }

  @Post(":projectId/phases/transition")
  @Permissions("project.lifecycle.transition")
  transition(
    @Param("projectId") projectId: string,
    @Body() dto: TransitionPhaseDto,
    @Actor() actor: RequestUser,
  ) {
    return this.projectService.transitionPhase(projectId, dto, actor);
  }

  @Post(":projectId/gates/:gateCode/start")
  @Permissions("project.gate.start")
  startGate(
    @Param("projectId") projectId: string,
    @Param("gateCode") gateCode: string,
    @Query("tenantId") tenantId: string,
    @Actor() actor: RequestUser,
  ) {
    return this.projectService.startGate(projectId, tenantId, gateCode, actor);
  }

  @Post(":projectId/gates/:gateId/decision")
  @Permissions("project.gate.decide")
  decideGate(
    @Param("projectId") projectId: string,
    @Param("gateId") gateId: string,
    @Body() dto: GateDecisionDto,
    @Actor() actor: RequestUser,
  ) {
    return this.projectService.decideGate(projectId, gateId, dto.tenantId, dto.decision, actor);
  }

  @Post(":projectId/status/recalculate")
  @Permissions("project.status.recalculate")
  recalculate(
    @Param("projectId") projectId: string,
    @Query("tenantId") tenantId: string,
    @Actor() actor: RequestUser,
  ) {
    return this.projectService.recalculateStatus(projectId, tenantId, actor);
  }

  @Post("excel/import")
  @Permissions("project.excel.import")
  importExcel(@Body() dto: ImportProjectsDto, @Actor() actor: RequestUser) {
    return this.projectService.importProjects(dto, actor);
  }

  @Post("excel/export")
  @Permissions("project.excel.export")
  exportExcel(@Body() dto: ExportProjectsDto, @Actor() actor: RequestUser) {
    return this.projectService.exportProjects(dto, actor);
  }
}
