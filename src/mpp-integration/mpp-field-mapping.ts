/**
 * Deterministic MSPDI → canonical field mapping registry.
 * Anything not listed here is intentionally ignored unless explicitly copied in the parser (with a warning).
 */
export const MSPDI_TASK_FIELD_MAP = {
  UID: "externalUid",
  OutlineNumber: "outlineNumber",
  OutlineLevel: "outlineLevel",
  Name: "name",
  Start: "plannedStart",
  Finish: "plannedFinish",
  Duration: "plannedDurationRaw",
  PercentComplete: "percentComplete",
  Milestone: "milestone",
  ActualStart: "actualStart",
  ActualFinish: "actualFinish",
  BaselineStart: "baselineStart",
  BaselineFinish: "baselineFinish",
  Notes: "notes",
  Contact: "contact",
  Priority: "priority",
  Work: "workRaw",
} as const;

/** MSPDI elements commonly present but not persisted by QEGPMO scheduling core — logged, not silently dropped. */
export const MSPDI_REPORTABLE_UNSUPPORTED_TASK_ELEMENTS = [
  "ExtendedAttribute",
  "OutlineCode",
  "CalendarUID",
  "ConstraintType",
  "ConstraintDate",
  "Deadline",
  "FixedCost",
  "Cost",
  "WBS",
  "EarlyStart",
  "EarlyFinish",
  "LateStart",
  "LateFinish",
  "FreeSlack",
  "TotalSlack",
  "Estimated",
  "Manual",
  "Active",
] as const;
