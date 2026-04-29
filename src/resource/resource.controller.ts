import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Actor } from "../common/auth/actor.decorator";
import { AuthGuard } from "../common/auth/auth.guard";
import { RequestUser } from "../common/auth/request-user.interface";
import { Permissions } from "../common/rbac/permissions.decorator";
import { RbacGuard } from "../common/rbac/rbac.guard";
import { ApproveAllocationDto, CreateAllocationDto, CreateCapacityPlanDto } from "./dto/capacity-allocation.dto";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { AssignResourceSkillDto, CreateResourceRoleDto, CreateSkillDto } from "./dto/create-role-skill.dto";
import { ResourceExportDto, ResourceImportCommitDto, ResourceImportPreviewDto } from "./dto/resource-excel.dto";
import { ResourceService } from "./resource.service";

@Controller("resources")
@UseGuards(AuthGuard, RbacGuard)
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post("roles")
  @Permissions("resource.role.create")
  createRole(@Body() dto: CreateResourceRoleDto, @Actor() actor: RequestUser) {
    return this.resourceService.createResourceRole(dto, actor);
  }

  @Post("skills")
  @Permissions("resource.skill.create")
  createSkill(@Body() dto: CreateSkillDto, @Actor() actor: RequestUser) {
    return this.resourceService.createSkill(dto, actor);
  }

  @Post()
  @Permissions("resource.create")
  createResource(@Body() dto: CreateResourceDto, @Actor() actor: RequestUser) {
    return this.resourceService.createResource(dto, actor);
  }

  @Post("skills/assign")
  @Permissions("resource.skill.assign")
  assignSkill(@Body() dto: AssignResourceSkillDto, @Actor() actor: RequestUser) {
    return this.resourceService.assignResourceSkill(dto, actor);
  }

  @Post("capacity-plans")
  @Permissions("resource.capacity.create")
  createCapacity(@Body() dto: CreateCapacityPlanDto, @Actor() actor: RequestUser) {
    return this.resourceService.createCapacityPlan(dto, actor);
  }

  @Post("allocations")
  @Permissions("resource.allocation.create")
  createAllocation(@Body() dto: CreateAllocationDto, @Actor() actor: RequestUser) {
    return this.resourceService.createAllocation(dto, actor);
  }

  @Post("allocations/:allocationId/approve")
  @Permissions("resource.allocation.approve")
  approveAllocation(
    @Param("allocationId") allocationId: string,
    @Body() dto: ApproveAllocationDto,
    @Actor() actor: RequestUser,
  ) {
    return this.resourceService.approveAllocation(allocationId, dto, actor);
  }

  @Get("over-allocation")
  @Permissions("resource.allocation.read")
  overAllocation(
    @Query("tenantId") tenantId: string,
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
    @Actor() actor: RequestUser,
  ) {
    return this.resourceService.detectOverAllocations(tenantId, periodStart, periodEnd, actor);
  }

  @Post("excel/import/preview")
  @Permissions("resource.excel.import")
  importPreview(@Body() dto: ResourceImportPreviewDto, @Actor() actor: RequestUser) {
    return this.resourceService.importPreview(dto, actor);
  }

  @Post("excel/import/commit/:jobId")
  @Permissions("resource.excel.import")
  importCommit(
    @Param("jobId") jobId: string,
    @Body() dto: ResourceImportCommitDto,
    @Actor() actor: RequestUser,
  ) {
    return this.resourceService.importCommit(jobId, dto, actor);
  }

  @Post("excel/export")
  @Permissions("resource.excel.export")
  export(@Body() dto: ResourceExportDto, @Actor() actor: RequestUser) {
    return this.resourceService.exportData(dto, actor);
  }
}
