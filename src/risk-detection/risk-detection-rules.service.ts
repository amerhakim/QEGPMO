import { Injectable } from "@nestjs/common";
import { SeverityLevel } from "@prisma/client";
import { DetectionMetricsPack } from "./risk-detection-metrics-collector.service";

export interface RuleSignal {
  signalCode: string;
  title: string;
  category: string;
  severity: SeverityLevel;
  probability: number;
  impact: number;
  evidence: Record<string, unknown>;
  ruleConfidence: number;
  descriptionDraft: string;
}

/** Deterministic signals only — no ML; aligns scoring bands with dashboard RAG thresholds. */
@Injectable()
export class RiskDetectionRulesService {
  evaluate(pack: DetectionMetricsPack): RuleSignal[] {
    const out: RuleSignal[] = [];
    const seen = new Set<string>();
    const push = (s: RuleSignal) => {
      if (seen.has(s.signalCode)) return;
      seen.add(s.signalCode);
      out.push(s);
    };

    if (pack.schedule) {
      if (pack.schedule.scheduleStatus === "RED") {
        push({
          signalCode: "SCHEDULE_VARIANCE_CRITICAL",
          title: "Schedule materially behind the baseline curve",
          category: "SCHEDULE",
          severity: "HIGH",
          probability: 0.62,
          impact: 0.74,
          evidence: {
            scheduleVariancePercent: pack.schedule.scheduleVariancePercent,
            scheduleStatus: pack.schedule.scheduleStatus,
            actualProgressPercent: pack.schedule.actualProgressPercent,
            expectedProgressPercent: pack.schedule.expectedProgressPercent,
          },
          ruleConfidence: 82,
          descriptionDraft: `Backend schedule variance is ${pack.schedule.scheduleVariancePercent}% (actual ${pack.schedule.actualProgressPercent}% vs expected ${pack.schedule.expectedProgressPercent}%) with status ${pack.schedule.scheduleStatus}.`,
        });
      } else if (pack.schedule.scheduleStatus === "AMBER") {
        push({
          signalCode: "SCHEDULE_VARIANCE_PRESSURE",
          title: "Schedule trending behind planned execution",
          category: "SCHEDULE",
          severity: "MEDIUM",
          probability: 0.48,
          impact: 0.58,
          evidence: {
            scheduleVariancePercent: pack.schedule.scheduleVariancePercent,
            scheduleStatus: pack.schedule.scheduleStatus,
          },
          ruleConfidence: 66,
          descriptionDraft: `Schedule variance ${pack.schedule.scheduleVariancePercent}% sits in the amber control band.`,
        });
      }
    }

    if (pack.financial && "ragStatus" in pack.financial && pack.financial.ragStatus) {
      const rag = pack.financial.ragStatus;
      if (rag === "RED") {
        push({
          signalCode: "COST_PERFORMANCE_CRITICAL",
          title: "Forecast cost performance in critical band versus approved budget",
          category: "COST",
          severity: "HIGH",
          probability: 0.58,
          impact: 0.72,
          evidence: {
            costVariancePercent: pack.financial.costVariancePercent,
            ragStatus: rag,
          },
          ruleConfidence: 80,
          descriptionDraft: `FinancialSummary CV% ${pack.financial.costVariancePercent ?? "n/a"} with cost RAG ${rag}.`,
        });
      } else if (rag === "AMBER") {
        push({
          signalCode: "COST_VARIANCE_WARNING",
          title: "Emerging budget pressure versus approved baseline",
          category: "COST",
          severity: "MEDIUM",
          probability: 0.42,
          impact: 0.52,
          evidence: { costVariancePercent: pack.financial.costVariancePercent, ragStatus: rag },
          ruleConfidence: 62,
          descriptionDraft: `CV% ${pack.financial.costVariancePercent ?? "n/a"} flagged amber by backend thresholds.`,
        });
      }
    }

    const stressed = pack.resourceStress.filter((r) => r.overAllocated);
    if (stressed.length) {
      const severe = stressed.some((r) => r.sumAllocationPercent >= r.thresholdPercent * 1.2);
      push({
        signalCode: "RESOURCE_CAPACITY_OVER_THRESHOLD",
        title: "Approved allocations exceed capacity governance thresholds",
        category: "RESOURCE",
        severity: severe ? "HIGH" : "MEDIUM",
        probability: severe ? 0.55 : 0.44,
        impact: severe ? 0.68 : 0.52,
        evidence: {
          resources: stressed.map((r) => ({
            resourceCode: r.resourceCode,
            sumAllocationPercent: r.sumAllocationPercent,
            thresholdPercent: r.thresholdPercent,
          })),
        },
        ruleConfidence: severe ? 76 : 63,
        descriptionDraft: `${stressed.length} resource(s) carry APPROVED allocations above configured thresholds.`,
      });
    }

    if (pack.dependencyLagCount >= 3) {
      push({
        signalCode: "DEPENDENCY_CHAIN_SLIPPAGE",
        title: "Multiple successor tasks remain incomplete beyond planned finish",
        category: "DEPENDENCY",
        severity: "MEDIUM",
        probability: 0.46,
        impact: 0.54,
        evidence: { dependencyLagCount: pack.dependencyLagCount },
        ruleConfidence: 64,
        descriptionDraft: `${pack.dependencyLagCount} successor tasks are behind planned completion while incomplete.`,
      });
    }

    if (pack.openRiskSeverityCounts.critical >= 2) {
      push({
        signalCode: "CRITICAL_RISK_BACKLOG",
        title: "Elevated open CRITICAL risks on the same scope",
        category: "RIC_HISTORY",
        severity: "HIGH",
        probability: 0.52,
        impact: 0.7,
        evidence: { openCriticalRisks: pack.openRiskSeverityCounts.critical },
        ruleConfidence: 74,
        descriptionDraft: `${pack.openRiskSeverityCounts.critical} CRITICAL risks remain open for this scope.`,
      });
    }

    if (pack.escalatedOpenIssues >= 2) {
      push({
        signalCode: "ISSUE_ESCALATION_LOAD",
        title: "Multiple escalated issues remain open",
        category: "RIC_HISTORY",
        severity: "MEDIUM",
        probability: 0.44,
        impact: 0.5,
        evidence: { escalatedOpenIssues: pack.escalatedOpenIssues },
        ruleConfidence: 61,
        descriptionDraft: `${pack.escalatedOpenIssues} issues are escalated and still open.`,
      });
    }

    if (pack.programProjectScheduleBands) {
      const reds = pack.programProjectScheduleBands.filter((p) => p.scheduleStatus === "RED");
      if (reds.length >= 2) {
        push({
          signalCode: "PROGRAM_SCHEDULE_DIVERGENCE",
          title: "Program showing coordinated schedule stress across member projects",
          category: "PROGRAM",
          severity: "HIGH",
          probability: 0.54,
          impact: 0.66,
          evidence: {
            redProjectCodes: reds.map((r) => r.code),
          },
          ruleConfidence: 72,
          descriptionDraft: `${reds.length} projects under the program report RED schedule bands concurrently.`,
        });
      }
    }

    return out;
  }
}
