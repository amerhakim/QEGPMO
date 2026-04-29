import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../workflow/audit.service";
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
    const baseline = await this.prisma.scheduleBaseline.create({
      data: {
        tenantId: dto.tenantId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        scope: dto.scope,
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

  async calculateProjectProgress(projectId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    await this.ensureProject(projectId, tenantId);
    const tasks = await this.prisma.task.findMany({ where: { tenantId, projectId } });
    if (!tasks.length) return { actualProgressPercent: 0, expectedProgressPercent: 0 };

    const weighted = tasks.reduce(
      (acc, t) => {
        const weight = Number(t.weight);
        acc.totalWeight += weight;
        acc.actual += Number(t.progressPercent) * weight;
        acc.expected += Number(t.expectedProgressPercent) * weight;
        return acc;
      },
      { totalWeight: 0, actual: 0, expected: 0 },
    );
    const actual = weighted.totalWeight ? Number((weighted.actual / weighted.totalWeight).toFixed(2)) : 0;
    const expected = weighted.totalWeight ? Number((weighted.expected / weighted.totalWeight).toFixed(2)) : 0;
    const variance = Number((actual - expected).toFixed(2));
    const scheduleStatus =
      variance >= -5 ? "GREEN" : variance >= -10 ? "AMBER" : "RED";
    return {
      actualProgressPercent: actual,
      expectedProgressPercent: expected,
      scheduleVariancePercent: variance,
      scheduleStatus,
    };
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
    return { jobId: job.id, tasks: rows, milestones, dependencies };
  }

  private calculateExpectedProgress(start: string, end: string): number {
    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();
    const today = new Date().getTime();
    if (endDate <= startDate) return 0;
    if (today <= startDate) return 0;
    if (today >= endDate) return 100;
    return Number((((today - startDate) / (endDate - startDate)) * 100).toFixed(2));
  }

  private async computeExpectedProgressFromBaseline(
    tenantId: string,
    projectId: string,
    taskId: string | undefined,
    fallbackStart: string,
    fallbackEnd: string,
  ): Promise<number> {
    const baseline = await this.prisma.scheduleBaseline.findFirst({
      where: taskId
        ? { tenantId, projectId, taskId, scope: "TASK" }
        : { tenantId, projectId, scope: "PROJECT" },
      orderBy: [{ baselineVersion: "desc" }, { baselineDate: "desc" }],
    });

    const start = baseline?.plannedStartDate.toISOString() ?? fallbackStart;
    const end = baseline?.plannedEndDate.toISOString() ?? fallbackEnd;
    return this.calculateExpectedProgress(start, end);
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
