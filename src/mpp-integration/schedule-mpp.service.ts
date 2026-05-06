import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { SchedulingService } from "../scheduling/scheduling.service";
import { AuditService } from "../workflow/audit.service";
import type {
  CanonicalSchedulePayload,
  MppImportMergeMode,
  ScheduleMppSourceFormat,
} from "./canonical-schedule.types";
import type { CommitMppImportDto } from "./dto/commit-mpp-import.dto";
import { MppJavaBridgeService } from "./mpp-java-bridge.service";
import type { MppValidationIssue } from "./mpp-schedule-validation.service";
import { MppScheduleValidationService } from "./mpp-schedule-validation.service";
import { MspdiXmlParserService } from "./mspdi-xml.parser";
import { MspdiXmlSerializerService } from "./mspdi-xml.serializer";

@Injectable()
export class ScheduleMppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly audit: AuditService,
    private readonly mspdiParser: MspdiXmlParserService,
    private readonly mspdiSerializer: MspdiXmlSerializerService,
    private readonly validator: MppScheduleValidationService,
    private readonly javaBridge: MppJavaBridgeService,
  ) {}

  detectFormat(fileName: string, buffer: Buffer): ScheduleMppSourceFormat {
    if (
      buffer.length >= 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0
    ) {
      return "MPP_BINARY";
    }
    const head = buffer
      .subarray(0, Math.min(256, buffer.length))
      .toString("utf8")
      .trimStart();
    if (head.startsWith("<?xml") || head.startsWith("<Project")) {
      return "MSPDI_XML";
    }
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".xml")) return "MSPDI_XML";
    if (lower.endsWith(".mpp")) return "MPP_BINARY";
    throw new BadRequestException(
      "Could not detect interchange format. Upload .mpp (binary) or MSPDI .xml.",
    );
  }

  async validateUpload(args: {
    tenantId: string;
    projectId: string;
    mergeMode: MppImportMergeMode;
    fileName: string;
    buffer: Buffer;
    actor: RequestUser;
  }) {
    const { tenantId, projectId, mergeMode, fileName, buffer, actor } = args;
    this.assertTenant(tenantId, actor);

    const format = this.detectFormat(fileName, buffer);
    let payload: CanonicalSchedulePayload;
    if (format === "MSPDI_XML") {
      try {
        payload = this.mspdiParser.parse(buffer);
      } catch (e) {
        throw new BadRequestException(`MSPDI parse failed: ${(e as Error).message}`);
      }
    } else {
      payload = this.javaBridge.readMppBinary(buffer, fileName);
    }

    const structural = this.validator.validateStructural(payload);
    const mappingReport = {
      unsupportedFields: payload.unsupportedFields,
      warnings: payload.warnings,
      structuralErrors: structural,
      mergeMode,
      taskCount: payload.tasks.length,
      linkCount: payload.links.length,
      milestoneCount: payload.milestones.length,
    };

    const wbsCodesIncoming = new Set(payload.tasks.map((t) => this.taskWbsCode(t)));

    let conflicts: string[] = [];
    if (mergeMode === "STRICT_APPEND") {
      const existing = await this.prisma.task.findMany({
        where: { tenantId, projectId },
        select: { wbsCode: true },
      });
      const existingSet = new Set(existing.map((r) => r.wbsCode));
      conflicts = [...wbsCodesIncoming].filter((w) => existingSet.has(w));
      for (const code of conflicts) {
        structural.push({
          code: "WBS_CONFLICT_STRICT_APPEND",
          message: `WBS "${code}" already exists in project.`,
          ref: code,
        });
      }
    }

    const job = await this.prisma.scheduleMppJob.create({
      data: {
        tenantId,
        projectId,
        operation: "MPP_VALIDATE",
        status: structural.length ? "FAILED" : "VALIDATED",
        sourceFormat: format,
        fileName,
        mergeMode,
        payloadJson: structural.length ? undefined : (payload as unknown as Prisma.InputJsonValue),
        validationReport: mappingReport as unknown as Prisma.InputJsonValue,
        createdBy: actor.userId,
      },
    });

    await this.audit.log({
      tenantId,
      entityType: "ScheduleMppJob",
      entityId: job.id,
      action: "MPP_IMPORT_VALIDATED",
      actorId: actor.userId,
      newValue: {
        ...mappingReport,
        format,
        jobId: job.id,
        conflictsDetected: conflicts.length,
      } as unknown as Prisma.InputJsonValue,
    });

    return {
      jobId: job.id,
      status: job.status,
      format,
      mergeMode,
      validationReport: mappingReport,
      readyForCommit: structural.length === 0,
    };
  }

  async commitImport(jobId: string, dto: CommitMppImportDto, actor: RequestUser) {
    const tenantId = dto.tenantId;
    this.assertTenant(tenantId, actor);
    if (!dto.confirm) {
      throw new BadRequestException(
        "Import refused: explicit confirm=true is required after reviewing validation results.",
      );
    }

    const job = await this.prisma.scheduleMppJob.findFirst({
      where: { id: jobId, tenantId, operation: "MPP_VALIDATE", status: "VALIDATED" },
    });
    if (!job) throw new NotFoundException("Validated MPP import job not found.");
    if (!job.payloadJson) throw new BadRequestException("Validated job has no import payload.");

    const payload = job.payloadJson as unknown as CanonicalSchedulePayload;
    const mergeMode = (job.mergeMode ?? "STRICT_APPEND") as MppImportMergeMode;

    const structural = this.validator.validateStructural(payload);
    if (structural.length) {
      throw new BadRequestException("Stale validation: structural errors present on commit.");
    }

    if (mergeMode === "REPLACE_SCHEDULE") {
      await this.scheduling.deleteAllScheduleArtifactsForProject(job.projectId, tenantId, actor);
    }

    const sortedTasks = [...payload.tasks].sort((a, b) => {
      if (a.outlineLevel !== b.outlineLevel) return a.outlineLevel - b.outlineLevel;
      return a.outlineNumber.localeCompare(b.outlineNumber, undefined, { numeric: true });
    });

    const uidToInternalId = new Map<number, string>();

    const insertErrors: MppValidationIssue[] = [];
    for (const t of sortedTasks) {
      const wbsCode = this.taskWbsCode(t);
      try {
        const parentId =
          t.parentExternalUid !== null ? uidToInternalId.get(t.parentExternalUid) : undefined;
        if (t.parentExternalUid !== null && parentId === undefined) {
          throw new Error(`Parent MSP UID ${t.parentExternalUid} not created yet.`);
        }
        const row = await this.scheduling.createTask(
          {
            tenantId,
            projectId: job.projectId,
            parentTaskId: parentId,
            wbsCode,
            name: t.name,
            plannedStartDate: t.plannedStart,
            plannedEndDate: t.plannedFinish,
            plannedEffortHours: t.plannedEffortHours,
            msProjectTaskUid: t.externalUid,
            msProjectOutlineNumber: t.outlineNumber,
            isMilestone: t.milestone,
            actualStartDate: t.actualStart ?? undefined,
            actualEndDate: t.actualFinish ?? undefined,
            progressPercent: t.percentComplete,
          },
          actor,
        );
        uidToInternalId.set(t.externalUid, row.id);

        if (t.baselineStart && t.baselineFinish) {
          await this.scheduling.createBaseline(
            {
              tenantId,
              projectId: job.projectId,
              taskId: row.id,
              scope: "TASK",
              baselineKind: "ORIGINAL",
              baselineVersion: 1,
              plannedStartDate: t.baselineStart,
              plannedEndDate: t.baselineFinish,
              plannedEffortHours: t.baselineEffortHours ?? undefined,
            },
            actor,
          );
        }
      } catch (e) {
        insertErrors.push({
          code: "TASK_INSERT_FAILED",
          message: (e as Error).message,
          ref: wbsCode,
        });
      }
    }

    for (const l of payload.links) {
      const pred = uidToInternalId.get(l.predecessorUid);
      const succ = uidToInternalId.get(l.successorUid);
      if (!pred || !succ) continue;
      try {
        await this.scheduling.createDependency(
          {
            tenantId,
            projectId: job.projectId,
            predecessorTaskId: pred,
            successorTaskId: succ,
            dependencyType: l.dependencyType,
            lagDays: l.lagDays,
            msProjectLinkUid: l.externalLinkUid,
          },
          actor,
        );
      } catch (e) {
        insertErrors.push({
          code: "DEPENDENCY_INSERT_FAILED",
          message: (e as Error).message,
          ref: `${l.predecessorUid}->${l.successorUid}`,
        });
      }
    }

    const milestoneCodes = new Set<string>();
    for (const m of payload.milestones) {
      if (milestoneCodes.has(m.code)) continue;
      milestoneCodes.add(m.code);
      const taskId = uidToInternalId.get(m.externalUid);
      try {
        await this.scheduling.createMilestone(
          {
            tenantId,
            projectId: job.projectId,
            taskId,
            code: m.code,
            name: m.name,
            plannedDate: m.plannedDate,
            msProjectTaskUid: m.externalUid,
          },
          actor,
        );
      } catch (e) {
        insertErrors.push({
          code: "MILESTONE_INSERT_FAILED",
          message: (e as Error).message,
          ref: m.code,
        });
      }
    }

    const rolledBack = insertErrors.length > 0 && mergeMode === "REPLACE_SCHEDULE";
    if (rolledBack) {
      await this.scheduling.deleteAllScheduleArtifactsForProject(job.projectId, tenantId, actor);
    }

    const insertedReport = rolledBack ? 0 : uidToInternalId.size;

    await this.prisma.scheduleMppJob.update({
      where: { id: job.id },
      data: {
        operation: "MPP_IMPORT",
        status: insertErrors.length ? "FAILED" : "COMPLETED",
        confirmedAt: new Date(),
        confirmedBy: actor.userId,
        resultSummary: {
          insertedTasks: insertedReport,
          rolledBack,
          errors: insertErrors,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      tenantId,
      entityType: "ScheduleMppJob",
      entityId: job.id,
      action: "MPP_IMPORT_COMMITTED",
      actorId: actor.userId,
      newValue: {
        mergeMode,
        insertedTasks: insertedReport,
        rolledBack,
        insertErrors,
      } as unknown as Prisma.InputJsonValue,
    });

    return {
      jobId: job.id,
      mergeMode,
      insertedTasks: insertedReport,
      insertErrors,
      rolledBack,
      success: insertErrors.length === 0,
    };
  }

  async exportProject(projectId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException("Project not found.");

    const tasks = await this.prisma.task.findMany({
      where: { tenantId, projectId },
      orderBy: { wbsCode: "asc" },
    });
    const dependencies = await this.prisma.taskDependency.findMany({
      where: { tenantId, projectId },
    });
    const baselines = await this.prisma.scheduleBaseline.findMany({
      where: { tenantId, projectId, scope: "TASK" },
      orderBy: [{ baselineVersion: "desc" }, { baselineDate: "desc" }],
    });

    const xmlBuffer = this.mspdiSerializer.serialize({
      projectName: project.name,
      tasks,
      dependencies,
      baselines,
    });

    const safeCode = project.code.replace(/[^\w.\-]+/g, "_");
    const exportFileName = `${safeCode}-schedule-mspd.xml`;

    const job = await this.prisma.scheduleMppJob.create({
      data: {
        tenantId,
        projectId,
        operation: "MPP_EXPORT",
        status: "COMPLETED",
        sourceFormat: "MSPDI_XML",
        fileName: exportFileName,
        mergeMode: null,
        resultSummary: {
          interchangeFormat: "MSPDI_XML",
          note:
            "Open-source stacks emit MSPDI XML for Microsoft Project interchange; binary .mpp creation requires a commercial writer.",
          taskCount: tasks.length,
          dependencyCount: dependencies.length,
          baselineRowsExported: baselines.length,
        } as unknown as Prisma.InputJsonValue,
        createdBy: actor.userId,
      },
    });

    await this.audit.log({
      tenantId,
      entityType: "ScheduleMppJob",
      entityId: job.id,
      action: "MPP_EXPORT_GENERATED",
      actorId: actor.userId,
      newValue: {
        taskCount: tasks.length,
        interchangeFormat: "MSPDI_XML",
      } as unknown as Prisma.InputJsonValue,
    });

    return {
      jobId: job.id,
      fileName: exportFileName,
      mimeType: "application/xml",
      buffer: xmlBuffer,
    };
  }

  async getJob(jobId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const job = await this.prisma.scheduleMppJob.findFirst({ where: { id: jobId, tenantId } });
    if (!job) throw new NotFoundException("Job not found.");
    return job;
  }

  private taskWbsCode(t: CanonicalSchedulePayload["tasks"][0]): string {
    return t.outlineNumber.trim().replace(/\s+/g, "_") || `UID_${t.externalUid}`;
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (tenantId !== actor.tenantId) {
      throw new ForbiddenException("Cross-tenant access denied.");
    }
  }
}
