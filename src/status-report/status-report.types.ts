import { FinancialObjectType } from "@prisma/client";

export interface StatusReportEditorContent {
  executiveSummary: string;
  scheduleSummary: string;
  costSummary: string;
  accomplishments: string[];
  upcomingMilestones: string[];
  topRisks: Array<{ title: string; severity: string; mitigationSummary: string }>;
}

export interface StatusReportAiProposal {
  modelId: string;
  fallbackUsed: boolean;
  factsDigest: string;
  generatedAt: string;
  inputFactsPreview: string;
  executiveSummaryRaw?: string;
}

export interface CollectedMetrics {
  collectedAt: string;
  reportingWeek: string;
  fiscalPeriod: string;
  scopeType: FinancialObjectType;
  scopeId: string;
  scopeLabel: string;
  includedProjects: Array<{ id: string; code: string; name: string }>;
  weekRange: { weekStart: string; weekEnd: string };
  schedule: {
    source: string;
    actualProgressPercent: number;
    expectedProgressPercent: number;
    scheduleVariancePercent: number;
    scheduleStatus: string;
    leafTaskCount?: number;
    includedProjectCount?: number;
  };
  financial: {
    source: string;
    summaryId?: string;
    totalApprovedBudget?: number;
    totalForecastEac?: number;
    totalActualCost?: number;
    costVariancePercent?: number;
    ragStatus?: string;
    unavailableReason?: string;
  };
  ric: {
    source: string;
    rollupId?: string;
    riskExposureTotal?: number;
    issueWeightedTotal?: number;
    criticalCount?: number;
    highCount?: number;
    mediumCount?: number;
    lowCount?: number;
    unavailableReason?: string;
  };
  upcomingMilestones: Array<{ code: string; name: string; plannedDate: string; projectCode: string }>;
  topRisks: Array<{ title: string; severity: string; exposureScore: number; mitigationActions: string[] }>;
  issuesClosedInWeek: Array<{ title: string; resolvedAt: string }>;
  overallRag: "GREEN" | "AMBER" | "RED";
  factsDigest: string;
  provenance: string[];
}

/** ISO week label (UTC), e.g. 2026-W18 — used by the weekly scheduler. */
export function formatIsoWeekUtcForDate(date: Date): string {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function isoWeekRangeUtc(reportingWeek: string): { weekStart: Date; weekEnd: Date } {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(reportingWeek.trim());
  if (!m) {
    throw new Error("reportingWeek must match YYYY-Www (ISO week).");
  }
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) {
    throw new Error("Invalid ISO week.");
  }
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dow + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  monday.setUTCHours(0, 0, 0, 0);
  sunday.setUTCHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: sunday };
}
