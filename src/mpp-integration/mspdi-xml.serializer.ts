import { Injectable } from "@nestjs/common";
import type { ScheduleBaseline, Task, TaskDependency } from "@prisma/client";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(date: Date): string {
  const iso = date.toISOString();
  return iso.replace(/\.\d{3}Z$/, "Z");
}

function durationHours(hours: number): string {
  const h = Math.max(0, Math.round(hours * 100) / 100);
  return `PT${h}H0M0S`;
}

function dependencyTypeToMsdi(type: TaskDependency["dependencyType"]): number {
  switch (type) {
    case "FF":
      return 0;
    case "FS":
      return 1;
    case "SF":
      return 2;
    case "SS":
      return 3;
    default:
      return 1;
  }
}

function lagDaysToLinkLag(lagDays: number): number {
  const minutes = lagDays * 8 * 60;
  return Math.round(minutes * 10);
}

@Injectable()
export class MspdiXmlSerializerService {
  /**
   * MSPDI XML interchange (opens in Microsoft Project). Binary .mpp generation is not supported by MPXJ-class OSS stacks.
   */
  serialize(opts: {
    projectName: string;
    tasks: Task[];
    dependencies: TaskDependency[];
    baselines?: ScheduleBaseline[];
  }): Buffer {
    const baselineByTask = new Map<string, ScheduleBaseline>();
    for (const b of opts.baselines ?? []) {
      if (b.scope === "TASK" && b.taskId && !baselineByTask.has(b.taskId)) {
        baselineByTask.set(b.taskId, b);
      }
    }

    const sorted = [...opts.tasks].sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }));
    const internalToUid = new Map<string, number>();
    let nextUid = 1;
    for (const t of sorted) {
      const uid = t.msProjectTaskUid ?? nextUid++;
      internalToUid.set(t.id, uid);
    }

    const taskBlocks = sorted
      .map((t, idx) => {
        const uid = internalToUid.get(t.id)!;
        const milestone = t.isMilestone ? 1 : 0;
        const pct = Number(t.progressPercent);
        const workH = Number(t.plannedEffortHours);
        const outlineNum = t.msProjectOutlineNumber ?? t.wbsCode;
        const b = baselineByTask.get(t.id);
        const baselineXml =
          b !== undefined
            ? `
        <Baseline>
          <Number>0</Number>
          <Start>${fmt(b.plannedStartDate)}</Start>
          <Finish>${fmt(b.plannedEndDate)}</Finish>
          ${b.plannedEffortHours != null ? `<Work>${durationHours(Number(b.plannedEffortHours))}</Work>` : ""}
        </Baseline>`
            : "";

        return `
      <Task>
        <UID>${uid}</UID>
        <ID>${idx + 1}</ID>
        <Name>${esc(t.name)}</Name>
        <OutlineNumber>${esc(outlineNum)}</OutlineNumber>
        <OutlineLevel>${outlineNum.split(".").length}</OutlineLevel>
        <Start>${fmt(t.plannedStartDate)}</Start>
        <Finish>${fmt(t.plannedEndDate)}</Finish>
        <Duration>${durationHours(workH > 0 ? workH : 8)}</Duration>
        <Work>${durationHours(workH > 0 ? workH : 8)}</Work>
        <PercentComplete>${Math.round(pct)}</PercentComplete>
        <Milestone>${milestone}</Milestone>
        ${t.actualStartDate ? `<ActualStart>${fmt(t.actualStartDate)}</ActualStart>` : ""}
        ${t.actualEndDate ? `<ActualFinish>${fmt(t.actualEndDate)}</ActualFinish>` : ""}
        ${baselineXml}
      </Task>`;
      })
      .join("");

    let linkId = 1;
    const linkBlocks = opts.dependencies
      .map((d) => {
        const pred = internalToUid.get(d.predecessorTaskId);
        const succ = internalToUid.get(d.successorTaskId);
        if (pred === undefined || succ === undefined) return "";
        const lag = lagDaysToLinkLag(d.lagDays);
        const type = dependencyTypeToMsdi(d.dependencyType);
        return `
      <TaskLink>
        <UID>${linkId++}</UID>
        <PredecessorUID>${pred}</PredecessorUID>
        <SuccessorUID>${succ}</SuccessorUID>
        <Type>${type}</Type>
        <LinkLag>${lag}</LinkLag>
        <LagFormat>7</LagFormat>
      </TaskLink>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${esc(opts.projectName)}</Name>
  <Tasks>${taskBlocks}
  </Tasks>
  <TaskLinks>${linkBlocks}
  </TaskLinks>
</Project>
`;
    return Buffer.from(xml, "utf8");
  }
}
