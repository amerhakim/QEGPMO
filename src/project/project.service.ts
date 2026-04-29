import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GateDecision, Prisma, ProjectHealthRag, ProjectLifecycleStatus } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../workflow/audit.service";
import { WorkflowIntegrationFacade } from "../workflow/workflow.integration";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ExportProjectsDto, ImportProjectsDto } from "./dto/project-excel.dto";
import { TransitionPhaseDto } from "./dto/transition-phase.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowIntegration: WorkflowIntegrationFacade,
  ) {}

  async createProject(dto: CreateProjectDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.validatePortfolioProgramLink(dto.tenantId, dto.portfolioId, dto.programId);
    const phase = await this.prisma.projectPhaseDefinition.findUnique({
      where: { tenantId_code: { tenantId: dto.tenantId, code: dto.initialPhaseCode } },
    });
    if (!phase) throw new NotFoundException("Initial phase not found.");
    this.validateProjectDates(dto.plannedStartDate, dto.plannedEndDate);

    const created = await this.prisma.project.create({
      data: {
        tenantId: dto.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        projectManagerId: dto.projectManagerId,
        sponsorId: dto.sponsorId,
        programId: dto.programId,
        portfolioId: dto.portfolioId,
        currentPhaseCode: dto.initialPhaseCode,
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        plannedBudget: this.decimal(dto.plannedBudget),
        lifecycleStatus: ProjectLifecycleStatus.DRAFT,
        phaseInstances: {
          create: {
            tenantId: dto.tenantId,
            phaseDefinitionId: phase.id,
            status: ProjectLifecycleStatus.ACTIVE,
          },
        },
      },
    });

    await this.audit(actor, dto.tenantId, "Project", created.id, "PROJECT_CREATED", undefined, created);
    return created;
  }

  async listProjects(tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    return this.prisma.project.findMany({
      where: { tenantId },
      include: {
        program: true,
        portfolio: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getProject(projectId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      include: {
        phaseInstances: { include: { phaseDefinition: true }, orderBy: { enteredAt: "desc" } },
        gateInstances: { include: { gateDefinition: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!project) throw new NotFoundException("Project not found.");
    return project;
  }

  async updateProject(projectId: string, dto: UpdateProjectDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const project = await this.ensureProject(projectId, dto.tenantId);

    if (dto.plannedStartDate && dto.plannedEndDate) {
      this.validateProjectDates(dto.plannedStartDate, dto.plannedEndDate);
    }
    await this.validatePortfolioProgramLink(dto.tenantId, dto.portfolioId ?? project.portfolioId, dto.programId ?? project.programId ?? undefined);
    this.validateStatusEditPolicy(project.lifecycleStatus, dto.lifecycleStatus);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        projectManagerId: dto.projectManagerId,
        sponsorId: dto.sponsorId,
        programId: dto.programId,
        portfolioId: dto.portfolioId,
        plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : undefined,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
        plannedBudget: dto.plannedBudget !== undefined ? this.decimal(dto.plannedBudget) : undefined,
        forecastCost: dto.forecastCost !== undefined ? this.decimal(dto.forecastCost) : undefined,
        actualCost: dto.actualCost !== undefined ? this.decimal(dto.actualCost) : undefined,
        lifecycleStatus: dto.lifecycleStatus,
      },
    });

    await this.audit(actor, dto.tenantId, "Project", projectId, "PROJECT_UPDATED", project, updated);
    return updated;
  }

  async transitionPhase(projectId: string, dto: TransitionPhaseDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const project = await this.ensureProject(projectId, dto.tenantId);
    const currentPhase = await this.prisma.projectPhaseDefinition.findUnique({
      where: { tenantId_code: { tenantId: dto.tenantId, code: project.currentPhaseCode } },
    });
    const targetPhase = await this.prisma.projectPhaseDefinition.findUnique({
      where: { tenantId_code: { tenantId: dto.tenantId, code: dto.targetPhaseCode } },
    });
    if (!currentPhase || !targetPhase) throw new NotFoundException("Phase definition not found.");
    if (targetPhase.sequence !== currentPhase.sequence + 1) {
      throw new BadRequestException("Phase transition must move to immediate next sequence.");
    }

    const pendingGates = await this.prisma.projectGateInstance.count({
      where: { tenantId: dto.tenantId, projectId, decision: GateDecision.PENDING },
    });
    if (pendingGates > 0) {
      throw new BadRequestException("Cannot transition while gate decisions are pending.");
    }

    const previous = { currentPhaseCode: project.currentPhaseCode };
    await this.prisma.projectPhaseInstance.updateMany({
      where: { tenantId: dto.tenantId, projectId, exitedAt: null },
      data: { exitedAt: new Date(), status: ProjectLifecycleStatus.COMPLETED },
    });
    await this.prisma.projectPhaseInstance.create({
      data: {
        tenantId: dto.tenantId,
        projectId,
        phaseDefinitionId: targetPhase.id,
        status: ProjectLifecycleStatus.ACTIVE,
      },
    });
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { currentPhaseCode: dto.targetPhaseCode, lifecycleStatus: ProjectLifecycleStatus.ACTIVE },
    });
    await this.audit(actor, dto.tenantId, "Project", projectId, "PROJECT_PHASE_TRANSITIONED", previous, updated);
    return updated;
  }

  async startGate(projectId: string, tenantId: string, gateCode: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    await this.ensureProject(projectId, tenantId);
    const gateDefinition = await this.prisma.projectGateDefinition.findUnique({
      where: { tenantId_code: { tenantId, code: gateCode } },
    });
    if (!gateDefinition) throw new NotFoundException("Gate definition not found.");

    const gate = await this.prisma.projectGateInstance.create({
      data: {
        tenantId,
        projectId,
        gateDefinitionId: gateDefinition.id,
        decision: GateDecision.PENDING,
      },
    });

    if (gateDefinition.workflowCode) {
      const wf = await this.workflowIntegration
        .forProjects()
        .startPhaseGateApproval(tenantId, gate.id, actor);
      await this.prisma.projectGateInstance.update({
        where: { id: gate.id },
        data: { workflowInstanceId: wf.id },
      });
    }

    await this.audit(actor, tenantId, "ProjectGateInstance", gate.id, "PROJECT_GATE_STARTED", undefined, gate);
    return gate;
  }

  async decideGate(projectId: string, gateId: string, tenantId: string, decision: GateDecision, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    await this.ensureProject(projectId, tenantId);
    const gate = await this.prisma.projectGateInstance.findFirst({
      where: { id: gateId, tenantId, projectId },
    });
    if (!gate) throw new NotFoundException("Gate instance not found.");
    if (gate.decision !== GateDecision.PENDING) {
      throw new BadRequestException("Gate decision already finalized.");
    }

    const updated = await this.prisma.projectGateInstance.update({
      where: { id: gateId },
      data: { decision, decidedBy: actor.userId, decidedAt: new Date() },
    });
    await this.audit(actor, tenantId, "ProjectGateInstance", gateId, "PROJECT_GATE_DECIDED", gate, updated);
    return updated;
  }

  async recalculateStatus(projectId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const project = await this.ensureProject(projectId, tenantId);
    const progress = this.calculateProgress(project);
    const scheduleVariance = this.calculateScheduleVariance(project);
    const costVariance = this.calculateCostVariance(project);
    const scheduleRag = this.toRag(scheduleVariance);
    const costRag = this.toRag(costVariance);
    const overall = this.worstRag(scheduleRag, costRag);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        progressPercent: this.decimal(progress),
        scheduleRag,
        costRag,
        overallHealthRag: overall,
      },
    });

    const snapshot = await this.prisma.projectStatusSnapshot.create({
      data: {
        tenantId,
        projectId,
        reportingDate: new Date(),
        progressPercent: this.decimal(progress),
        scheduleVariancePercent: this.decimal(scheduleVariance),
        costVariancePercent: this.decimal(costVariance),
        scheduleRag,
        costRag,
        overallHealthRag: overall,
      },
    });

    await this.audit(actor, tenantId, "Project", projectId, "PROJECT_STATUS_RECALCULATED", project, {
      project: updated,
      snapshot,
    });
    return { project: updated, snapshot };
  }

  async importProjects(dto: ImportProjectsDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const job = await this.prisma.projectExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        operation: "IMPORT",
        status: "CREATED",
        fileName: dto.fileName,
        createdBy: actor.userId,
      },
    });

    const inserted: string[] = [];
    const rejected: Array<{ code: string; reason: string }> = [];
    for (const row of dto.rows) {
      try {
        const portfolio = await this.prisma.portfolio.findUnique({
          where: { tenantId_code: { tenantId: dto.tenantId, code: row.portfolioCode } },
        });
        if (!portfolio) throw new BadRequestException("Portfolio code not found.");

        let programId: string | undefined;
        if (row.programCode) {
          const program = await this.prisma.program.findUnique({
            where: { tenantId_code: { tenantId: dto.tenantId, code: row.programCode } },
          });
          if (!program) throw new BadRequestException("Program code not found.");
          if (program.portfolioId !== portfolio.id) {
            throw new BadRequestException("Program is not linked to portfolio.");
          }
          programId = program.id;
        }

        const existing = await this.prisma.project.findUnique({
          where: { tenantId_code: { tenantId: dto.tenantId, code: row.code } },
        });
        if (existing) throw new BadRequestException("Project code already exists.");

        const created = await this.createProject(
          {
            tenantId: dto.tenantId,
            code: row.code,
            name: row.name,
            projectManagerId: row.projectManagerId,
            portfolioId: portfolio.id,
            programId,
            initialPhaseCode: row.initialPhaseCode,
            plannedStartDate: row.plannedStartDate,
            plannedEndDate: row.plannedEndDate,
            plannedBudget: Number(row.plannedBudget),
          },
          actor,
        );
        inserted.push(created.id);
      } catch (error) {
        rejected.push({ code: row.code, reason: (error as Error).message });
      }
    }

    const summary = { total: dto.rows.length, inserted: inserted.length, rejected };
    const status = rejected.length ? "VALIDATED" : "COMPLETED";
    await this.prisma.projectExcelJob.update({
      where: { id: job.id },
      data: { status, resultSummary: summary },
    });
    await this.audit(actor, dto.tenantId, "ProjectExcelJob", job.id, "PROJECT_IMPORT_EXECUTED", undefined, summary as Prisma.InputJsonValue);
    return { jobId: job.id, ...summary };
  }

  async exportProjects(dto: ExportProjectsDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const rows = await this.prisma.project.findMany({
      where: { tenantId: dto.tenantId },
      include: { program: true, portfolio: true },
      orderBy: { code: "asc" },
    });

    const mapped = rows.map((p) => ({
      code: p.code,
      name: p.name,
      portfolioCode: p.portfolio.code,
      programCode: p.program?.code ?? "",
      lifecycleStatus: p.lifecycleStatus,
      currentPhaseCode: p.currentPhaseCode,
      plannedStartDate: p.plannedStartDate.toISOString(),
      plannedEndDate: p.plannedEndDate.toISOString(),
      plannedBudget: p.plannedBudget.toString(),
      progressPercent: p.progressPercent.toString(),
      scheduleRag: p.scheduleRag,
      costRag: p.costRag,
      overallHealthRag: p.overallHealthRag,
    }));

    const job = await this.prisma.projectExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        operation: "EXPORT",
        status: "COMPLETED",
        fileName: `projects-export-${Date.now()}.xlsx`,
        createdBy: actor.userId,
        resultSummary: { rowCount: mapped.length },
      },
    });
    await this.audit(actor, dto.tenantId, "ProjectExcelJob", job.id, "PROJECT_EXPORT_EXECUTED", undefined, {
      rowCount: mapped.length,
    });
    return { jobId: job.id, rows: mapped };
  }

  private calculateProgress(project: {
    plannedStartDate: Date;
    plannedEndDate: Date;
    actualStartDate: Date | null;
    actualEndDate: Date | null;
  }): number {
    const now = new Date();
    const start = (project.actualStartDate ?? project.plannedStartDate).getTime();
    const end = (project.actualEndDate ?? project.plannedEndDate).getTime();
    if (end <= start) return 0;
    const value = ((now.getTime() - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }

  private calculateScheduleVariance(project: {
    plannedStartDate: Date;
    plannedEndDate: Date;
    actualStartDate: Date | null;
    actualEndDate: Date | null;
  }): number {
    const plannedDuration = project.plannedEndDate.getTime() - project.plannedStartDate.getTime();
    if (plannedDuration <= 0) return 0;
    const effectiveEnd = project.actualEndDate ?? new Date();
    const effectiveStart = project.actualStartDate ?? project.plannedStartDate;
    const actualDuration = effectiveEnd.getTime() - effectiveStart.getTime();
    return Number((((actualDuration - plannedDuration) / plannedDuration) * 100).toFixed(2));
  }

  private calculateCostVariance(project: { plannedBudget: Prisma.Decimal; forecastCost: Prisma.Decimal | null; actualCost: Prisma.Decimal | null }): number {
    const baseline = Number(project.plannedBudget);
    if (baseline <= 0) return 0;
    const cost = Number(project.forecastCost ?? project.actualCost ?? project.plannedBudget);
    return Number((((cost - baseline) / baseline) * 100).toFixed(2));
  }

  private toRag(variance: number): ProjectHealthRag {
    if (variance > 10) return ProjectHealthRag.RED;
    if (variance > 5) return ProjectHealthRag.AMBER;
    return ProjectHealthRag.GREEN;
  }

  private worstRag(...values: ProjectHealthRag[]): ProjectHealthRag {
    if (values.includes(ProjectHealthRag.RED)) return ProjectHealthRag.RED;
    if (values.includes(ProjectHealthRag.AMBER)) return ProjectHealthRag.AMBER;
    return ProjectHealthRag.GREEN;
  }

  private validateProjectDates(start: string, end: string) {
    if (new Date(start).getTime() > new Date(end).getTime()) {
      throw new BadRequestException("plannedStartDate must be before plannedEndDate.");
    }
  }

  private validateStatusEditPolicy(current: ProjectLifecycleStatus, requested?: ProjectLifecycleStatus) {
    if (!requested) return;
    if (current === ProjectLifecycleStatus.ARCHIVED && requested !== ProjectLifecycleStatus.ARCHIVED) {
      throw new BadRequestException("Archived project cannot return to active status.");
    }
  }

  private async validatePortfolioProgramLink(tenantId: string, portfolioId: string, programId?: string) {
    const portfolio = await this.prisma.portfolio.findFirst({ where: { id: portfolioId, tenantId } });
    if (!portfolio) throw new NotFoundException("Portfolio not found.");
    if (!programId) return;
    const program = await this.prisma.program.findFirst({ where: { id: programId, tenantId } });
    if (!program) throw new NotFoundException("Program not found.");
    if (program.portfolioId !== portfolioId) {
      throw new BadRequestException("Program must belong to selected portfolio.");
    }
  }

  private async ensureProject(projectId: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException("Project not found.");
    return project;
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
    actor: RequestUser,
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.auditService.log({
      tenantId,
      entityType,
      entityId,
      action,
      actorId: actor.userId,
      oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
    });
  }
}
