import { Injectable } from "@nestjs/common";
import { DependencyType } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import type {
  CanonicalLink,
  CanonicalMilestone,
  CanonicalSchedulePayload,
  CanonicalTask,
} from "./canonical-schedule.types";
import { MSPDI_REPORTABLE_UNSUPPORTED_TASK_ELEMENTS } from "./mpp-field-mapping";

const MSP_NS = "http://schemas.microsoft.com/project";

function arr<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node !== null && "#text" in (node as Record<string, unknown>)) {
    return String((node as { "#text": unknown })["#text"]);
  }
  return String(node);
}

function parseLinkType(code: string | number | undefined): DependencyType {
  const n = Number(code);
  switch (n) {
    case 0:
      return "FF";
    case 1:
      return "FS";
    case 2:
      return "SF";
    case 3:
      return "SS";
    default:
      return "FS";
  }
}

/** MSPDI LinkLag is commonly expressed in tenths of a minute (see MS Project XML docs). */
function linkLagToLagDays(linkLagRaw: string | number | undefined): number {
  const raw = Number(linkLagRaw ?? 0);
  if (!Number.isFinite(raw) || raw === 0) return 0;
  const minutes = raw / 10;
  const minutesPerDay = 8 * 60;
  return Math.round(minutes / minutesPerDay);
}

function parseIsoOrEmpty(v: string): string | null {
  const s = v?.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parsePercent(v: string | number | undefined): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseBool01(v: string | number | undefined): boolean {
  const s = String(v ?? "").trim();
  return s === "1" || s.toLowerCase() === "true";
}

/** Parses PT{n}H... duration into hours (approximate for MSPDI interchange). */
function parseDurationToHours(durationRaw: string | undefined): number {
  if (!durationRaw) return 0;
  const m = durationRaw.match(/PT([\d.]+)H/i);
  if (m) return Number(m[1]) || 0;
  const md = durationRaw.match(/PT([\d.]+)M/i);
  if (md) return Number(md[1]) / 60;
  const n = Number(durationRaw);
  return Number.isFinite(n) ? n : 0;
}

function parseWorkToHours(workRaw: string | undefined): number {
  if (!workRaw) return 0;
  const m = workRaw.match(/PT([\d.]+)H/i);
  if (m) return Number(m[1]) || 0;
  const md = workRaw.match(/PT([\d.]+)M/i);
  if (md) return Number(md[1]) / 60;
  return 0;
}

@Injectable()
export class MspdiXmlParserService {
  parse(buffer: Buffer): CanonicalSchedulePayload {
    const xml = buffer.toString("utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: false,
      /** tolerate default ns */
      processEntities: false,
    });
    const doc = parser.parse(xml);
    const project =
      doc.Project ??
      doc[`project`] ??
      doc[`${MSP_NS}:Project`] ??
      Object.values(doc).find((v: unknown) => typeof v === "object" && v !== null && "Tasks" in (v as object));

    if (!project || typeof project !== "object") {
      throw new Error("MSPDI root <Project> not found.");
    }

    const tasksRaw = arr((project as { Tasks?: { Task?: unknown } }).Tasks?.Task);
    const linksRaw = arr((project as { TaskLinks?: { TaskLink?: unknown } }).TaskLinks?.TaskLink);

    const unsupported = new Set<string>();
    const warnings: string[] = [];

    const tasks: CanonicalTask[] = [];

    for (const tr of tasksRaw) {
      const t = tr as Record<string, unknown>;
      const uid = Number(text(t.UID));
      if (!Number.isFinite(uid)) continue;

      const outlineNumber = text(t.OutlineNumber).trim() || `${uid}`;
      const outlineLevel = Number(text(t.OutlineLevel)) || 1;

      for (const el of MSPDI_REPORTABLE_UNSUPPORTED_TASK_ELEMENTS) {
        if (t[el] !== undefined) unsupported.add(`Task.${el}`);
      }

      const start = parseIsoOrEmpty(text(t.Start)) ?? new Date().toISOString();
      const finish = parseIsoOrEmpty(text(t.Finish)) ?? start;

      const milestone = parseBool01(text(t.Milestone));
      const durationH = parseDurationToHours(text(t.Duration));
      const workH = parseWorkToHours(text(t.Work));

      const plannedEffortHours = workH > 0 ? workH : durationH > 0 ? durationH : 8;

      let baselineStart = parseIsoOrEmpty(text(t.BaselineStart));
      let baselineFinish = parseIsoOrEmpty(text(t.BaselineFinish));

      const baselinesNode = t.Baseline;
      const baselineRows = arr(baselinesNode);
      if (baselineRows.length && (!baselineStart || !baselineFinish)) {
        const b0 = baselineRows[0] as Record<string, unknown>;
        baselineStart = baselineStart ?? parseIsoOrEmpty(text(b0.Start));
        baselineFinish = baselineFinish ?? parseIsoOrEmpty(text(b0.Finish));
      }

      const task: CanonicalTask = {
        externalUid: uid,
        outlineNumber,
        outlineLevel,
        parentExternalUid: null,
        name: text(t.Name).trim() || `Task ${uid}`,
        plannedStart: start,
        plannedFinish: finish,
        plannedEffortHours,
        percentComplete: parsePercent(text(t.PercentComplete)),
        milestone,
        actualStart: parseIsoOrEmpty(text(t.ActualStart)),
        actualFinish: parseIsoOrEmpty(text(t.ActualFinish)),
        baselineStart,
        baselineFinish,
        baselineEffortHours: workH > 0 ? workH : null,
      };

      tasks.push(task);
    }

    const outlineToUid = new Map<string, number>();
    for (const t of tasks) {
      outlineToUid.set(t.outlineNumber, t.externalUid);
    }
    for (const t of tasks) {
      const on = t.outlineNumber;
      const parentOutline = on.includes(".") ? on.replace(/\.[^.]+$/, "") : "";
      if (parentOutline && outlineToUid.has(parentOutline)) {
        t.parentExternalUid = outlineToUid.get(parentOutline)!;
      } else {
        t.parentExternalUid = null;
      }
    }

    const milestones: CanonicalMilestone[] = [];
    for (const t of tasks) {
      if (t.milestone) {
        milestones.push({
          externalUid: t.externalUid,
          code: `MSP-M-${t.externalUid}`,
          name: t.name,
          plannedDate: t.plannedFinish,
        });
      }
    }

    const links: CanonicalLink[] = [];
    for (const lr of linksRaw) {
      const l = lr as Record<string, unknown>;
      const pred = Number(text(l.PredecessorUID));
      const succ = Number(text(l.SuccessorUID));
      if (!Number.isFinite(pred) || !Number.isFinite(succ)) continue;
      const lagDays = linkLagToLagDays(text(l.LinkLag));
      const type = parseLinkType(text(l.Type));
      const linkUidRaw = l["@_UID"] ?? l.UID;
      const externalLinkUid = linkUidRaw !== undefined ? Number(text(linkUidRaw)) : undefined;
      links.push({
        predecessorUid: pred,
        successorUid: succ,
        dependencyType: type,
        lagDays,
        externalLinkUid: Number.isFinite(externalLinkUid) ? externalLinkUid : undefined,
      });
    }

    return {
      tasks,
      links,
      milestones,
      unsupportedFields: [...unsupported].sort(),
      warnings,
    };
  }
}
