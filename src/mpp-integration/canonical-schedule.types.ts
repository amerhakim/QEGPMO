import type { DependencyType } from "@prisma/client";

/** Neutral interchange model — MSP field names avoided except where stored for traceability. */
export interface CanonicalTask {
  externalUid: number;
  outlineNumber: string;
  outlineLevel: number;
  parentExternalUid: number | null;
  name: string;
  plannedStart: string;
  plannedFinish: string;
  plannedEffortHours: number;
  percentComplete: number;
  milestone: boolean;
  actualStart?: string | null;
  actualFinish?: string | null;
  baselineStart?: string | null;
  baselineFinish?: string | null;
  baselineEffortHours?: number | null;
}

export interface CanonicalLink {
  predecessorUid: number;
  successorUid: number;
  dependencyType: DependencyType;
  lagDays: number;
  externalLinkUid?: number;
}

export interface CanonicalMilestone {
  externalUid: number;
  code: string;
  name: string;
  plannedDate: string;
}

export interface CanonicalSchedulePayload {
  tasks: CanonicalTask[];
  links: CanonicalLink[];
  milestones: CanonicalMilestone[];
  /** Human-readable mapping / loss reports (deterministic). */
  unsupportedFields: string[];
  warnings: string[];
}

export type ScheduleMppSourceFormat = "MPP_BINARY" | "MSPDI_XML";

export type MppImportMergeMode = "STRICT_APPEND" | "REPLACE_SCHEDULE";
