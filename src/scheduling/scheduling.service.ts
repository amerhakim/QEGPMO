import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../workflow/audit.service";
import { ComputeScheduleRollupDto } from "./dto/compute-schedule-rollup.dto";
import { CreateBaselineDto } from "./dto/create-baseline.dto";
import { CreateDependencyDto } from "./dto/create-dependency.dto";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { ExportScheduleDto, ImportScheduleDto } from "./dto/schedule-excel.dto";
import { UpdateTaskProgressDto } from "./dto/update-task-progress.dto";

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createTask(dto: CreateTaskDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureProject(dto.projectId, dto.tenantId);
    this.validateDates(dto.plannedStartDate, dto.plannedEndDate);
    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, tenantId: dto.tenantId, projectId: dto.projectId },
      });
      if (!parent) throw new NotFoundException("Parent task not found in project.");
    }

    const expectedProgress = await this.computeExpectedProgressFromBaseline(
      dto.tenantId,
      dto.projectId,
      undefined,
      dto.plannedStartDate,
      dto.plannedEndDate,
    );

    const progressPct = dto.progressPercent ?? 0;
    let status = dto.status ?? "NOT_STARTED";
    if (dto.status === undefined) {
      if (progressPct >= 100) status = "DONE";
      else if (progressPct > 0) status = "IN_PROGRESS";
    }

    const task = await this.prisma.task.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        parentTaskId: dto.parentTaskId,
        wbsCode: dto.wbsCode,
        name: dto.name,
        description: dto.description,
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        plannedEffortHours: this.decimal(dto.plannedEffortHours),
        weight: this.decimal(dto.weight ?? 1),
        msProjectTaskUid: dto.msProjectTaskUid,
        msProjectOutlineNumber: dto.msProjectOutlineNumber,
        isMilestone: dto.isMilestone ?? false,
        actualStartDate: dto.actualStartDate ? new Date(dto.actualStartDate) : undefined,
        actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
        actualEffortHours:
          dto.actualEffortHours !== undefined ? this.decimal(dto.actualEffortHours) : undefined,
        progressPercent: this.decimal(progressPct),
        status,
        expectedProgressPercent: this.decimal(expectedProgress),
      },
    });
    await this.audit(dto.tenantId, "Task", task.id, "TASK_CREATED", actor.userId, undefined, task);
    return task;
  }

  async listWbs(projectId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    await this.ensureProject(projectId, tenantId);
    return this.prisma.task.findMany({
      where: { projectId, tenantId },
      include: { children: true },
      orderBy: [{ wbsCode: "asc" }],
    });
  }

  async createMilestone(dto: CreateMilestoneDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureProject(dto.projectId, dto.tenantId);
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({ where: { id: dto.taskId, tenantId: dto.tenantId, projectId: dto.projectId } });
      if (!task) throw new NotFoundException("Task for milestone not found.");
    }

    const milestone = await this.prisma.milestone.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        code: dto.code,
        name: dto.name,
        plannedDate: new Date(dto.plannedDate),
        msProjectTaskUid: dto.msProjectTaskUid,
      },
    });
    await this.audit(dto.tenantId, "Milestone", milestone.id, "MILESTONE_CREATED", actor.userId, undefined, milestone);
    return milestone;
  }

  async createDependency(dto: CreateDependencyDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    if (dto.predecessorTaskId === dto.successorTaskId) {
      throw new BadRequestException("Task cannot depend on itself.");
    }
    const predecessor = await this.prisma.task.findFirst({
      where: { id: dto.predecessorTaskId, tenantId: dto.tenantId, projectId: dto.projectId },
    });
    const successor = await this.prisma.task.findFirst({
      where: { id: dto.successorTaskId, tenantId: dto.tenantId, projectId: dto.projectId },
    });
    if (!predecessor || !successor) {
      throw new NotFoundException("Predecessor or successor task not found.");
    }
    const dependency = await this.prisma.taskDependency.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        predecessorTaskId: dto.predecessorTaskId,
        successorTaskId: dto.successorTaskId,
        dependencyType: dto.dependencyType ?? "FS",
        lagDays: dto.lagDays ?? 0,
        msProjectLinkUid: dto.msProjectLinkUid,
      },
    });
    await this.audit(dto.tenantId, "TaskDependency", dependency.id, "DEPENDENCY_CREATED", actor.userId, undefined, dependency);
    return dependency;
  }

  async updateTaskProgress(taskId: string, dto: UpdateTaskProgressDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const task = await this.prisma.task.findFirst({ where: { id: taskId, tenantId: dto.tenantId } });
    if (!task) throw new NotFoundException("Task not found.");

    const entry = await this.prisma.taskProgressEntry.create({
      data: {
        tenantId: dto.tenantId,
        taskId,
        progressDate: dto.progressDate ? new Date(dto.progressDate) : new Date(),
        progressPercent: this.decimal(dto.progressPercent),
        actualEffortHours: dto.actualEffortHours !== undefined ? this.decimal(dto.actualEffortHours) : undefined,
        notes: dto.notes,
        createdBy: actor.userId,
      },
    });

    const expectedProgress = await this.computeExpectedProgressFromBaseline(
      dto.tenantId,
      task.projectId,
      task.id,
      task.plannedStartDate.toISOString(),
      task.plannedEndDate.toISOString(),
    );
    const updateData: Prisma.TaskUpdateInput = {
      progressPercent: this.decimal(dto.progressPercent),
      expectedProgressPercent: this.decimal(expectedProgress),
    };
    if (dto.actualEffortHours !== undefined) {
      updateData.actualEffortHours = this.decimal(dto.actualEffortHours);
    }
    if (dto.progressPercent >= 100 && !task.actualEndDate) {
      updateData.actualEndDate = new Date();
      updateData.status = "DONE";
    } else if (dto.progressPercent > 0 && task.status === "NOT_STARTED") {
      updateData.status = "IN_PROGRESS";
      if (!task.actualStartDate) updateData.actualStartDate = new Date();
    }

    const updated = await this.prisma.task.update({ where: { id: taskId }, data: updateData });
    await this.audit(dto.tenantId, "Task", taskId, "TASK_PROGRESS_UPDATED", actor.userId, task, {
      task: updated,
      entry,
    });
    return { task: updated, progressEntry: entry };
  }

  async createBaseline(dto: CreateBaselineDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureProject(dto.projectId, dto.tenantId);
    this.validateDates(dto.plannedStartDate, dto.plannedEndDate);
    if (dto.scope === "TASK" && !dto.taskId) {
      throw new BadRequestException("taskId is required for TASK baseline scope.");
    }
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({ where: { id: dto.taskId, tenantId: dto.tenantId, projectId: dto.projectId } });
      if (!task) throw new NotFoundException("Task not found for baseline.");
    }
    const baselineKind =
      dto.baselineKind ?? (dto.baselineVersion === 1 ? ("ORIGINAL" as const) : ("UPDATED" as const));

    const baseline = await this.prisma.scheduleBaseline.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        scope: dto.scope,
        baselineKind,
        baselineVersion: dto.baselineVersion,
        plannedStartDate: new Date(dto.plannedStartDate),
        plannedEndDate: new Date(dto.plannedEndDate),
        plannedEffortHours: dto.plannedEffortHours !== undefined ? this.decimal(dto.plannedEffortHours) : undefined,
        plannedCost: dto.plannedCost !== undefined ? this.decimal(dto.plannedCost) : undefined,
        createdBy: actor.userId,
      },
    });
    await this.recomputeExpectedProgressForScope(dto.tenantId, dto.projectId, dto.taskId);
    await this.audit(dto.tenantId, "ScheduleBaseline", baseline.id, "BASELINE_CREATED", actor.userId, undefined, baseline);
    return baseline;
  }

  async calculateProjectProgress(projectId: string, tenantId: string, actor: RequestUser, asOfDate?: string) {
    this.assertTenant(tenantId, actor);
    await this.ensureProject(projectId, tenantId);
    const asOf = asOfDate ? new Date(asOfDate) : undefined;
    if (asOfDate && (!asOf || Number.isNaN(asOf.getTime()))) {
      throw new BadRequestException("Invalid asOfDate.");
    }

    const { actual, expected, leafTaskCount } = await this.computeLeafWeightedMetricsForProject(
      projectId,
      tenantId,
      asOf,
    );

    if (!leafTaskCount) {
      return {
        actualProgressPercent: 0,
        expectedProgressPercent: 0,
        scheduleVariancePercent: 0,
        scheduleStatus: "GREEN",
        leafTaskCount: 0,
        ...(asOf ? { asOfDate: asOf.toISOString() } : {}),
      };
    }

    const variance = Number((actual - expected).toFixed(2));
    const scheduleStatus = variance >= -5 ? "GREEN" : variance >= -10 ? "AMBER" : "RED";
    return {
      actualProgressPercent: actual,
      expectedProgressPercent: expected,
      scheduleVariancePercent: variance,
      scheduleStatus,
      leafTaskCount,
      ...(asOf ? { asOfDate: asOf.toISOString() } : {}),
    };
  }

  async computeScheduleRollupSnapshot(dto: ComputeScheduleRollupDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const asOf = dto.asOfDate ? new Date(dto.asOfDate) : undefined;
    if (dto.asOfDate && (!asOf || Number.isNaN(asOf.getTime()))) {
      throw new BadRequestException("Invalid asOfDate.");
    }
    if (dto.objectType === "ENTERPRISE" && dto.objectId !== dto.tenantId) {
      throw new BadRequestException("ENTERPRISE schedule rollup requires objectId equal to tenantId.");
    }

    const projects = await this.resolveProjectsForRollup(dto);
    if (!projects.length) {
      throw new BadRequestException("No projects found for roll-up scope.");
    }

    let sumWeights = 0;
    let actualW = 0;
    let expectedW = 0;
    let leafTotal = 0;

    for (const p of projects) {
      const budget = Math.max(Number(p.plannedBudget), 0);
      const w = budget > 0 ? budget : 1;
      sumWeights += w;

      const m = await this.computeLeafWeightedMetricsForProject(p.id, dto.tenantId, asOf);
      leafTotal += m.leafTaskCount;
      actualW += m.actual * w;
      expectedW += m.expected * w;
    }

    const actual = sumWeights ? Number((actualW / sumWeights).toFixed(2)) : 0;
    const expected = sumWeights ? Number((expectedW / sumWeights).toFixed(2)) : 0;
    const variance = Number((actual - expected).toFixed(2));
    const scheduleRag = this.varianceToScheduleRag(variance);

    const snapshot = await this.prisma.scheduleRollupSnapshot.create({
      data: {
        tenantId: dto.tenantId,
        objectType: dto.objectType,
        objectId: dto.objectId,
        reportingPeriod: dto.reportingPeriod,
        asOfDate: asOf ?? new Date(),
        actualProgressPercent: this.decimal(actual),
        expectedProgressPercent: this.decimal(expected),
        scheduleVariancePercent: this.decimal(variance),
        scheduleRag,
        includedProjectCount: projects.length,
        leafTaskCount: leafTotal,
      },
    });

    await this.audit(
      dto.tenantId,
      "ScheduleRollupSnapshot",
      snapshot.id,
      "SCHEDULE_ROLLUP_SNAPSHOT_COMPUTED",
      actor.userId,
      undefined,
      snapshot,
    );
    return snapshot;
  }

  async importSchedulePreview(dto: ImportScheduleDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureProject(dto.projectId, dto.tenantId);
    const job = await this.prisma.scheduleExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        operation: "IMPORT",
        status: "CREATED",
        fileName: dto.fileName,
        rowCount: dto.tasks.length,
        createdBy: actor.userId,
      },
    });

    let validRows = 0;
    const errors: Array<{ wbsCode: string; reason: string }> = [];
    for (const task of dto.tasks) {
      try {
        this.validateDates(task.plannedStartDate, task.plannedEndDate);
        validRows += 1;
      } catch (e) {
        errors.push({ wbsCode: task.wbsCode, reason: (e as Error).message });
      }
    }

    await this.prisma.scheduleExcelJob.update({
      where: { id: job.id },
      data: {
        status: "VALIDATED",
        payloadJson: dto.tasks as unknown as Prisma.InputJsonValue,
        resultSummary: { totalRows: dto.tasks.length, validRows, rejectedRows: errors.length, errors },
      },
    });
    await this.audit(dto.tenantId, "ScheduleExcelJob", job.id, "SCHEDULE_IMPORT_PREVIEWED", actor.userId, undefined, {
      totalRows: dto.tasks.length,
      validRows,
      rejectedRows: errors.length,
    });
    return { jobId: job.id, totalRows: dto.tasks.length, validRows, rejectedRows: errors.length, errors };
  }

  async commitScheduleImport(jobId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const job = await this.prisma.scheduleExcelJob.findFirst({
      where: { id: jobId, tenantId, operation: "IMPORT", status: "VALIDATED" },
    });
    if (!job) throw new NotFoundException("Validated import job not found.");

    const rows = (job.payloadJson ?? []) as unknown as CreateTaskDto[];
    if (!Array.isArray(rows)) throw new BadRequestException("Import payload is invalid.");

    let inserted = 0;
    const errors: Array<{ wbsCode: string; reason: string }> = [];
    for (const task of rows) {
      try {
        await this.createTask(
          {
            ...task,
            tenantId,
            projectId: job.projectId,
          },
          actor,
        );
        inserted += 1;
      } catch (e) {
        errors.push({ wbsCode: task.wbsCode, reason: (e as Error).message });
      }
    }

    await this.prisma.scheduleExcelJob.update({
      where: { id: job.id },
      data: {
        status: errors.length ? "FAILED" : "COMPLETED",
        resultSummary: {
          totalRows: rows.length,
          insertedRows: inserted,
          rejectedRows: errors.length,
          errors,
        },
      },
    });
    await this.audit(tenantId, "ScheduleExcelJob", job.id, "SCHEDULE_IMPORT_COMMITTED", actor.userId, undefined, {
      totalRows: rows.length,
      insertedRows: inserted,
      rejectedRows: errors.length,
    });
    return { jobId: job.id, totalRows: rows.length, insertedRows: inserted, rejectedRows: errors.length, errors };
  }

  async exportSchedule(dto: ExportScheduleDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    await this.ensureProject(dto.projectId, dto.tenantId);
    const tasks = await this.prisma.task.findMany({
      where: { tenantId: dto.tenantId, projectId: dto.projectId },
      orderBy: { wbsCode: "asc" },
    });
    const milestones = await this.prisma.milestone.findMany({
      where: { tenantId: dto.tenantId, projectId: dto.projectId },
      orderBy: { code: "asc" },
    });
    const dependencies = await this.prisma.taskDependency.findMany({
      where: { tenantId: dto.tenantId, projectId: dto.projectId },
    });
    const rows = tasks.map((t) => ({
      msProjectTaskUid: t.msProjectTaskUid,
      msProjectOutlineNumber: t.msProjectOutlineNumber,
      wbsCode: t.wbsCode,
      name: t.name,
      plannedStartDate: t.plannedStartDate.toISOString(),
      plannedEndDate: t.plannedEndDate.toISOString(),
      actualStartDate: t.actualStartDate?.toISOString() ?? "",
      actualEndDate: t.actualEndDate?.toISOString() ?? "",
      plannedEffortHours: t.plannedEffortHours.toString(),
      actualEffortHours: t.actualEffortHours.toString(),
      progressPercent: t.progressPercent.toString(),
      expectedProgressPercent: t.expectedProgressPercent.toString(),
    }));
    const job = await this.prisma.scheduleExcelJob.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        operation: "EXPORT",
        status: "COMPLETED",
        fileName: `schedule-export-${Date.now()}.xlsx`,
        rowCount: rows.length,
        createdBy: actor.userId,
        resultSummary: {
          formatHint: dto.formatHint ?? "MSP_COMPATIBLE",
          milestones: milestones.length,
          dependencies: dependencies.length,
        },
      },
    });
    await this.audit(dto.tenantId, "ScheduleExcelJob", job.id, "SCHEDULE_EXPORTED", actor.userId, undefined, {
      rowCount: rows.length,
      milestones: milestones.length,
      dependencies: dependencies.length,
      formatHint: dto.formatHint ?? "MSP_COMPATIBLE",
    });
    return { jobId: job.id, tasks: rows, milestones, dependencies };
  }

  /**
   * Deletes all scheduling artifacts for a project (dependencies, progress entries, baselines, milestones, tasks).
   * Used only by controlled interchange imports (e.g. MSPDI / Project) — not routed via HTTP directly.
   */
  async deleteAllScheduleArtifactsForProject(projectId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    await this.ensureProject(projectId, tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.taskDependency.deleteMany({ where: { tenantId, projectId } });
      const taskIds = (
        await tx.task.findMany({
          where: { tenantId, projectId },
          select: { id: true },
        })
      ).map((t) => t.id);
      if (taskIds.length) {
        await tx.taskProgressEntry.deleteMany({ where: { tenantId, taskId: { in: taskIds } } });
      }
      await tx.scheduleBaseline.deleteMany({ where: { tenantId, projectId } });
      await tx.milestone.deleteMany({ where: { tenantId, projectId } });

      while ((await tx.task.count({ where: { tenantId, projectId } })) > 0) {
        const leaves = await tx.task.findMany({
          where: { tenantId, projectId, children: { none: {} } },
          select: { id: true },
          take: 500,
        });
        if (!leaves.length) {
          throw new BadRequestException("Unable to clear task hierarchy (unexpected cycle).");
        }
        await tx.task.deleteMany({
          where: { id: { in: leaves.map((l) => l.id) } },
        });
      }
    });

    await this.audit(tenantId, "Project", projectId, "SCHEDULE_ARTIFACTS_BULK_DELETED", actor.userId, undefined, {
      reason: "PROJECT_SCHEDULE_REPLACE_IMPORT",
    });
  }

  /** Time-elapsed % on baseline/planned interval (MSP-friendly); optional as-of for deterministic reporting. */
  private calculateExpectedProgress(start: string, end: string, asOf?: Date): number {
    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();
    const anchor = (asOf ?? new Date()).getTime();
    if (endDate <= startDate) return 0;
    if (anchor <= startDate) return 0;
    if (anchor >= endDate) return 100;
    return Number((((anchor - startDate) / (endDate - startDate)) * 100).toFixed(2));
  }

  /** Prefer UPDATED baselines for active schedule; fall back to ORIGINAL (first approved baseline). */
  private async resolveActiveBaseline(
    tenantId: string,
    projectId: string,
    taskId: string | undefined,
  ) {
    const baseWhere = taskId
      ? { tenantId, projectId, taskId, scope: "TASK" as const }
      : { tenantId, projectId, scope: "PROJECT" as const };

    const updated = await this.prisma.scheduleBaseline.findFirst({
      where: { ...baseWhere, baselineKind: "UPDATED" },
      orderBy: [{ baselineVersion: "desc" }, { baselineDate: "desc" }],
    });
    if (updated) return updated;

    return this.prisma.scheduleBaseline.findFirst({
      where: { ...baseWhere, baselineKind: "ORIGINAL" },
      orderBy: [{ baselineVersion: "desc" }, { baselineDate: "desc" }],
    });
  }

  private async computeExpectedProgressFromBaseline(
    tenantId: string,
    projectId: string,
    taskId: string | undefined,
    fallbackStart: string,
    fallbackEnd: string,
    asOf?: Date,
  ): Promise<number> {
    const baseline = await this.resolveActiveBaseline(tenantId, projectId, taskId);

    const start = baseline?.plannedStartDate.toISOString() ?? fallbackStart;
    const end = baseline?.plannedEndDate.toISOString() ?? fallbackEnd;
    return this.calculateExpectedProgress(start, end, asOf);
  }

  /**
   * WBS-safe roll-up: weight leaf tasks only so parent summaries are not double-counted.
   * Falls back to all tasks when there are no leaf rows (degenerate tree).
   */
  private async computeLeafWeightedMetricsForProject(
    projectId: string,
    tenantId: string,
    asOf?: Date,
  ): Promise<{ actual: number; expected: number; leafTaskCount: number }> {
    const tasks = await this.prisma.task.findMany({
      where: { tenantId, projectId },
      include: { _count: { select: { children: true } } },
    });
    if (!tasks.length) {
      return { actual: 0, expected: 0, leafTaskCount: 0 };
    }

    const leaves = tasks.filter((t) => t._count.children === 0);
    const rollupTasks = leaves.length ? leaves : tasks;

    let totalWeight = 0;
    let actualW = 0;
    let expectedW = 0;

    for (const t of rollupTasks) {
      const weight = Number(t.weight);
      totalWeight += weight;
      actualW += Number(t.progressPercent) * weight;
      const expected = await this.computeExpectedProgressFromBaseline(
        tenantId,
        projectId,
        t.id,
        t.plannedStartDate.toISOString(),
        t.plannedEndDate.toISOString(),
        asOf,
      );
      expectedW += expected * weight;
    }

    const actual = totalWeight ? Number((actualW / totalWeight).toFixed(2)) : 0;
    const expected = totalWeight ? Number((expectedW / totalWeight).toFixed(2)) : 0;
    return { actual, expected, leafTaskCount: rollupTasks.length };
  }

  private async resolveProjectsForRollup(dto: ComputeScheduleRollupDto) {
    const { tenantId, objectType, objectId } = dto;
    switch (objectType) {
      case "PROJECT": {
        await this.ensureProject(objectId, tenantId);
        return this.prisma.project.findMany({
          where: { id: objectId, tenantId },
          select: { id: true, plannedBudget: true },
        });
      }
      case "PROGRAM": {
        const program = await this.prisma.program.findFirst({ where: { id: objectId, tenantId } });
        if (!program) throw new NotFoundException("Program not found.");
        return this.prisma.project.findMany({
          where: { tenantId, programId: objectId },
          select: { id: true, plannedBudget: true },
        });
      }
      case "PORTFOLIO": {
        const portfolio = await this.prisma.portfolio.findFirst({ where: { id: objectId, tenantId } });
        if (!portfolio) throw new NotFoundException("Portfolio not found.");
        return this.prisma.project.findMany({
          where: { tenantId, portfolioId: objectId },
          select: { id: true, plannedBudget: true },
        });
      }
      case "ENTERPRISE":
        return this.prisma.project.findMany({
          where: { tenantId },
          select: { id: true, plannedBudget: true },
        });
      default:
        throw new BadRequestException("Unsupported rollup object type.");
    }
  }

  private varianceToScheduleRag(variance: number): "GREEN" | "AMBER" | "RED" {
    if (variance >= -5) return "GREEN";
    if (variance >= -10) return "AMBER";
    return "RED";
  }

  private async recomputeExpectedProgressForScope(
    tenantId: string,
    projectId: string,
    taskId?: string,
  ): Promise<void> {
    if (taskId) {
      const task = await this.prisma.task.findFirst({ where: { id: taskId, tenantId, projectId } });
      if (!task) return;
      const expected = await this.computeExpectedProgressFromBaseline(
        tenantId,
        projectId,
        taskId,
        task.plannedStartDate.toISOString(),
        task.plannedEndDate.toISOString(),
      );
      await this.prisma.task.update({
        where: { id: task.id },
        data: { expectedProgressPercent: this.decimal(expected) },
      });
      return;
    }

    const tasks = await this.prisma.task.findMany({ where: { tenantId, projectId } });
    for (const task of tasks) {
      const expected = await this.computeExpectedProgressFromBaseline(
        tenantId,
        projectId,
        task.id,
        task.plannedStartDate.toISOString(),
        task.plannedEndDate.toISOString(),
      );
      await this.prisma.task.update({
        where: { id: task.id },
        data: { expectedProgressPercent: this.decimal(expected) },
      });
    }
  }

  private validateDates(start: string, end: string) {
    if (new Date(start).getTime() > new Date(end).getTime()) {
      throw new BadRequestException("Start date must be before end date.");
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
