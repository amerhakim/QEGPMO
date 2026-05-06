import { Injectable } from "@nestjs/common";
import type { CanonicalSchedulePayload } from "./canonical-schedule.types";

export interface MppValidationIssue {
  code: string;
  message: string;
  ref?: string;
}

@Injectable()
export class MppScheduleValidationService {
  validateStructural(payload: CanonicalSchedulePayload): MppValidationIssue[] {
    const issues: MppValidationIssue[] = [];
    const uids = new Set<number>();
    for (const t of payload.tasks) {
      if (uids.has(t.externalUid)) {
        issues.push({
          code: "DUPLICATE_EXTERNAL_UID",
          message: `Duplicate task UID ${t.externalUid}.`,
          ref: String(t.externalUid),
        });
      } else {
        uids.add(t.externalUid);
      }
      const s = new Date(t.plannedStart).getTime();
      const f = new Date(t.plannedFinish).getTime();
      if (Number.isNaN(s) || Number.isNaN(f)) {
        issues.push({
          code: "INVALID_TASK_DATES",
          message: `Task UID ${t.externalUid} has invalid start/finish.`,
          ref: String(t.externalUid),
        });
      } else if (s > f) {
        issues.push({
          code: "TASK_START_AFTER_FINISH",
          message: `Task UID ${t.externalUid}: start is after finish.`,
          ref: String(t.externalUid),
        });
      }
      if (t.parentExternalUid !== null && !uids.has(t.parentExternalUid)) {
        /** parents may appear later — second pass */
      }
    }

    for (const t of payload.tasks) {
      if (t.parentExternalUid !== null && !uids.has(t.parentExternalUid)) {
        issues.push({
          code: "MISSING_PARENT_UID",
          message: `Task UID ${t.externalUid} references missing parent UID ${t.parentExternalUid}.`,
          ref: String(t.externalUid),
        });
      }
    }

    for (const l of payload.links) {
      if (!uids.has(l.predecessorUid)) {
        issues.push({
          code: "LINK_MISSING_PREDECESSOR",
          message: `Link references missing predecessor UID ${l.predecessorUid}.`,
          ref: `${l.predecessorUid}->${l.successorUid}`,
        });
      }
      if (!uids.has(l.successorUid)) {
        issues.push({
          code: "LINK_MISSING_SUCCESSOR",
          message: `Link references missing successor UID ${l.successorUid}.`,
          ref: `${l.predecessorUid}->${l.successorUid}`,
        });
      }
      if (l.predecessorUid === l.successorUid) {
        issues.push({
          code: "SELF_DEPENDENCY",
          message: `Self-dependency on UID ${l.predecessorUid}.`,
          ref: String(l.predecessorUid),
        });
      }
    }

    if (this.dependencyGraphHasCycle(payload)) {
      issues.push({
        code: "DEPENDENCY_CYCLE",
        message: "Task dependency graph contains at least one cycle.",
      });
    }

    return issues;
  }

  private dependencyGraphHasCycle(payload: CanonicalSchedulePayload): boolean {
    const adj = new Map<number, number[]>();
    for (const l of payload.links) {
      if (!adj.has(l.predecessorUid)) adj.set(l.predecessorUid, []);
      adj.get(l.predecessorUid)!.push(l.successorUid);
    }
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const color = new Map<number, number>();
    const nodes = new Set<number>();
    for (const t of payload.tasks) nodes.add(t.externalUid);
    for (const l of payload.links) {
      nodes.add(l.predecessorUid);
      nodes.add(l.successorUid);
    }
    for (const n of nodes) color.set(n, WHITE);

    const dfs = (n: number): boolean => {
      color.set(n, GREY);
      for (const succ of adj.get(n) ?? []) {
        const c = color.get(succ) ?? WHITE;
        if (c === GREY) return true;
        if (c === WHITE && dfs(succ)) return true;
      }
      color.set(n, BLACK);
      return false;
    };

    for (const n of nodes) {
      if ((color.get(n) ?? WHITE) === WHITE && dfs(n)) return true;
    }
    return false;
  }
}
