import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AllocationStatus, Prisma } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../workflow/audit.service";
import { WorkflowIntegrationFacade } from "../workflow/workflow.integration";
import { ApproveAllocationDto, CreateAllocationDto, CreateCapacityPlanDto } from "./dto/capacity-allocation.dto";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { AssignResourceSkillDto, CreateResourceRoleDto, CreateSkillDto } from "./dto/create-role-skill.dto";
import { ResourceExportDto, ResourceImportCommitDto, ResourceImportPreviewDto } from "./dto/resource-excel.dto";

@Injectable()
export class ResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowIntegration: WorkflowIntegrationFacade,
  ) {}

  async createResourceRole(dto: CreateResourceRoleDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const role = await this.prisma.resourceRole.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        defaultRate: dto.defaultRate !== undefined ? this.decimal(dto.defaultRate) : undefined,
      },
    });
    await this.audit(dto.tenantId, "ResourceRole", role.id, "RESOURCE_ROLE_CREATED", actor.userId, undefined, role);
    return role;
  }

  async createSkill(dto: CreateSkillDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const skill = await this.prisma.skill.create({
      data: { tenantId: dto.tenantId, code: dto.code, name: dto.name, category: dto.category },
    });
    await this.audit(dto.tenantId, "Skill", skill.id, "SKILL_CREATED", actor.userId, undefined, skill);
    return skill;
  }

  async createResource(dto: CreateResourceDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    if (dto.roleId) await this.ensureRole(dto.roleId, dto.tenantId);
    const resource = await this.prisma.resource.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        status: dto.status ?? "ACTIVE",
        roleId: dto.roleId,
        managerId: dto.managerId,
        email: dto.email,
        location: dto.location,
        standardCapacityHoursPerDay: this.decimal(dto.standardCapacityHoursPerDay ?? 8),
        overAllocationThresholdPercent: this.decimal(dto.overAllocationThresholdPercent ?? 100),
      },
    });
    await this.audit(dto.tenantId, "Resource", resource.id, "RESOURCE_CREATED", actor.userId, undefined, resource);
    return resource;
  }

  async assignResourceSkill(dto: AssignResourceSkillDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureResource(dto.resourceId, dto.tenantId);
    await this.ensureSkill(dto.skillId, dto.tenantId);
    const assigned = await this.prisma.resourceSkill.upsert({
      where: {
        tenantId_resourceId_skillId: {
          tenantId: dto.tenantId,
          resourceId: dto.resourceId,
          skillId: dto.skillId,
        },
      },
      create: {
        tenantId: dto.tenantId,
        resourceId: dto.resourceId,
        skillId: dto.skillId,
        proficiencyLevel: dto.proficiencyLevel,
      },
      update: {
        proficiencyLevel: dto.proficiencyLevel,
      },
    });
    await this.audit(dto.tenantId, "ResourceSkill", assigned.id, "RESOURCE_SKILL_ASSIGNED", actor.userId, undefined, assigned);
    return assigned;
  }

  async createCapacityPlan(dto: CreateCapacityPlanDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    this.validateDates(dto.periodStart, dto.periodEnd);
    if (!dto.resourceId && !dto.roleId) {
      throw new BadRequestException("Either resourceId or roleId is required.");
    }
    if (dto.resourceId) await this.ensureResource(dto.resourceId, dto.tenantId);
    if (dto.roleId) await this.ensureRole(dto.roleId, dto.tenantId);
    const plan = await this.prisma.capacityPlan.create({
      data: {
        tenantId: dto.tenantId,
        resourceId: dto.resourceId,
        roleId: dto.roleId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        availableHours: this.decimal(dto.availableHours),
        thresholdPercent: this.decimal(dto.thresholdPercent ?? 100),
      },
    });
    await this.audit(dto.tenantId, "CapacityPlan", plan.id, "CAPACITY_PLAN_CREATED", actor.userId, undefined, plan);
    return plan;
  }

  async createAllocation(dto: CreateAllocationDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    this.validateDates(dto.startDate, dto.endDate);
    if (!dto.resourceId && !dto.roleId) {
      throw new BadRequestException("Either resourceId or roleId is required.");
    }
    if (dto.resourceId) await this.ensureResource(dto.resourceId, dto.tenantId);
    if (dto.roleId) await this.ensureRole(dto.roleId, dto.tenantId);

    const allocation = await this.prisma.resourceAllocation.create({
      data: {
        tenantId: dto.tenantId,
        resourceId: dto.resourceId,
        roleId: dto.roleId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        allocationPercent: this.decimal(dto.allocationPercent),
        plannedHours: this.decimal(dto.plannedHours),
        status: AllocationStatus.PENDING_APPROVAL,
        requestedBy: actor.userId,
      },
    });

    const wf = await this.workflowIntegration
      .forResources()
      .startAllocationApproval(dto.tenantId, allocation.id, actor);
    const updated = await this.prisma.resourceAllocation.update({
      where: { id: allocation.id },
      data: { workflowInstanceId: wf.id },
    });

    await this.audit(dto.tenantId, "ResourceAllocation", updated.id, "RESOURCE_ALLOCATION_CREATED", actor.userId, undefined, updated);
    return updated;
  }

  async approveAllocation(allocationId: string, dto: ApproveAllocationDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const allocation = await this.ensureAllocation(allocationId, dto.tenantId);
    if (allocation.status !== AllocationStatus.PENDING_APPROVAL) {
      throw new BadRequestException("Allocation is not pending approval.");
    }
    const approved = await this.prisma.resourceAllocation.update({
      where: { id: allocationId },
      data: {
        status: AllocationStatus.APPROVED,
        approvedBy: actor.userId,
        approvedAt: new Date(),
        approvedHours: dto.approvedHours !== undefined ? this.decimal(dto.approvedHours) : allocation.plannedHours,
      },
    });
    await this.audit(dto.tenantId, "ResourceAllocation", allocationId, "RESOURCE_ALLOCATION_APPROVED", actor.userId, allocation, approved);
    return approved;
  }

  async detectOverAllocations(tenantId: string, periodStart: string, periodEnd: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    this.validateDates(periodStart, periodEnd);
    const resources = await this.prisma.resource.findMany({ where: { tenantId, status: "ACTIVE" } });
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const results: Array<Record<string, unknown>> = [];

    for (const resource of resources) {
      const allocations = await this.prisma.resourceAllocation.findMany({
        where: {
          tenantId,
          resourceId: resource.id,
          status: { in: [AllocationStatus.PENDING_APPROVAL, AllocationStatus.APPROVED] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      const totalPercent = allocations.reduce((sum, a) => sum + Number(a.allocationPercent), 0);
      const threshold = Number(resource.overAllocationThresholdPercent);
      if (totalPercent > threshold) {
        results.push({
          resourceId: resource.id,
          resourceCode: resource.code,
          totalAllocationPercent: Number(totalPercent.toFixed(2)),
          thresholdPercent: threshold,
          overByPercent: Number((totalPercent - threshold).toFixed(2)),
        });
      }
    }
    return results;
  }

  async importPreview(dto: ResourceImportPreviewDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const payload = this.resolveImportPayload(dto);
    const errors: Array<{ index: number; reason: string }> = [];

    payload.forEach((row, index) => {
      if (!row || typeof row !== "object") {
        errors.push({ index, reason: "Invalid row payload." });
      }
    });

    const job = await this.prisma.resourceExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        operation: "IMPORT",
        entityName: dto.entityName,
        status: "VALIDATED",
        fileName: dto.fileName,
        rowCount: payload.length,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        resultSummary: {
          totalRows: payload.length,
          validRows: payload.length - errors.length,
          rejectedRows: errors.length,
          errors,
        },
        createdBy: actor.userId,
      },
    });
    await this.audit(dto.tenantId, "ResourceExcelJob", job.id, "RESOURCE_IMPORT_PREVIEWED", actor.userId, undefined, job);
    return job;
  }

  async importCommit(jobId: string, dto: ResourceImportCommitDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const job = await this.prisma.resourceExcelJob.findFirst({
      where: { id: jobId, tenantId: dto.tenantId, operation: "IMPORT", status: "VALIDATED" },
    });
    if (!job) throw new NotFoundException("Validated import job not found.");
    const payload = (job.payloadJson ?? []) as unknown as Record<string, unknown>[];
    let inserted = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < payload.length; i += 1) {
      try {
        const row = payload[i] as Record<string, unknown>;
        if (job.entityName === "RESOURCE") {
          await this.createResource(row as unknown as CreateResourceDto, actor);
        } else if (job.entityName === "SKILL") {
          await this.createSkill(row as unknown as CreateSkillDto, actor);
        } else if (job.entityName === "ALLOCATION") {
          await this.createAllocation(row as unknown as CreateAllocationDto, actor);
        } else if (job.entityName === "CAPACITY") {
          await this.createCapacityPlan(row as unknown as CreateCapacityPlanDto, actor);
        } else {
          throw new BadRequestException("Unsupported entityName.");
        }
        inserted += 1;
      } catch (error) {
        errors.push({ index: i, reason: (error as Error).message });
      }
    }

    const status = errors.length ? "FAILED" : "COMPLETED";
    const updated = await this.prisma.resourceExcelJob.update({
      where: { id: jobId },
      data: {
        status,
        resultSummary: {
          totalRows: payload.length,
          insertedRows: inserted,
          rejectedRows: errors.length,
          errors,
        },
      },
    });
    await this.audit(dto.tenantId, "ResourceExcelJob", jobId, "RESOURCE_IMPORT_COMMITTED", actor.userId, job, updated);
    return updated;
  }

  async exportData(dto: ResourceExportDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    let rows: unknown[] = [];
    if (dto.entityName === "RESOURCE") {
      rows = await this.prisma.resource.findMany({ where: { tenantId: dto.tenantId } });
    } else if (dto.entityName === "SKILL") {
      rows = await this.prisma.skill.findMany({ where: { tenantId: dto.tenantId } });
    } else if (dto.entityName === "ALLOCATION") {
      rows = await this.prisma.resourceAllocation.findMany({ where: { tenantId: dto.tenantId } });
    } else if (dto.entityName === "CAPACITY") {
      rows = await this.prisma.capacityPlan.findMany({ where: { tenantId: dto.tenantId } });
    }

    const job = await this.prisma.resourceExcelJob.create({
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
    await this.audit(dto.tenantId, "ResourceExcelJob", job.id, "RESOURCE_EXPORT_COMPLETED", actor.userId, undefined, {
      rowCount: rows.length,
    });
    return { jobId: job.id, rows };
  }

  private resolveImportPayload(dto: ResourceImportPreviewDto): unknown[] {
    if (dto.entityName === "RESOURCE") return dto.resources ?? [];
    if (dto.entityName === "SKILL") return [...(dto.skills ?? []), ...(dto.resourceSkills ?? [])];
    if (dto.entityName === "ALLOCATION") return dto.allocations ?? [];
    if (dto.entityName === "CAPACITY") return dto.capacityPlans ?? [];
    return [];
  }

  private async ensureResource(resourceId: string, tenantId: string) {
    const resource = await this.prisma.resource.findFirst({ where: { id: resourceId, tenantId } });
    if (!resource) throw new NotFoundException("Resource not found.");
    return resource;
  }

  private async ensureRole(roleId: string, tenantId: string) {
    const role = await this.prisma.resourceRole.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException("Resource role not found.");
    return role;
  }

  private async ensureSkill(skillId: string, tenantId: string) {
    const skill = await this.prisma.skill.findFirst({ where: { id: skillId, tenantId } });
    if (!skill) throw new NotFoundException("Skill not found.");
    return skill;
  }

  private async ensureAllocation(id: string, tenantId: string) {
    const allocation = await this.prisma.resourceAllocation.findFirst({ where: { id, tenantId } });
    if (!allocation) throw new NotFoundException("Allocation not found.");
    return allocation;
  }

  private validateDates(start: string, end: string) {
    if (new Date(start).getTime() > new Date(end).getTime()) {
      throw new BadRequestException("Start date must be before end date.");
    }
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (tenantId !== actor.tenantId) throw new ForbiddenException("Cross-tenant access denied.");
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
