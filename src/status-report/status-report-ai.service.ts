import { createHash } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { CollectedMetrics, StatusReportAiProposal } from "./status-report.types";

/**
 * Local open-source summarization (Transformers.js ONNX).
 * Does not compute PMO metrics — consumes structured facts only for narrative text.
 */
@Injectable()
export class StatusReportAiService {
  private readonly logger = new Logger(StatusReportAiService.name);
  private summarizer: ((text: string, opts?: Record<string, unknown>) => Promise<unknown>) | null = null;

  private async getSummarizer(modelId: string) {
    if (this.summarizer) return this.summarizer;
    const { pipeline } = await import("@xenova/transformers");
    this.summarizer = (await pipeline("summarization", modelId)) as (
      text: string,
      opts?: Record<string, unknown>,
    ) => Promise<unknown>;
    return this.summarizer;
  }

  private buildFactsBullets(metrics: CollectedMetrics): string {
    const lines: string[] = [
      `Reporting scope: ${metrics.scopeLabel} (${metrics.scopeType}).`,
      `Week ${metrics.reportingWeek}: ${metrics.weekRange.weekStart} → ${metrics.weekRange.weekEnd}.`,
      `Overall health RAG (deterministic): ${metrics.overallRag}.`,
      `Schedule (backend): actual ${metrics.schedule.actualProgressPercent}% vs expected ${metrics.schedule.expectedProgressPercent}%, variance ${metrics.schedule.scheduleVariancePercent}%, band ${metrics.schedule.scheduleStatus}.`,
    ];
    if (metrics.financial.unavailableReason) {
      lines.push(`Financial summary unavailable: ${metrics.financial.unavailableReason}.`);
    } else {
      lines.push(
        `Financial (backend): approved budget ${metrics.financial.totalApprovedBudget ?? "n/a"}, forecast EAC ${metrics.financial.totalForecastEac ?? "n/a"}, actual ${metrics.financial.totalActualCost ?? "n/a"}, CV% ${metrics.financial.costVariancePercent ?? "n/a"}, RAG ${metrics.financial.ragStatus ?? "n/a"}.`,
      );
    }
    if (metrics.ric.unavailableReason) {
      lines.push(`RIC rollup unavailable: ${metrics.ric.unavailableReason}.`);
    } else {
      lines.push(
        `Risks/issues roll-up (backend): exposure ${metrics.ric.riskExposureTotal ?? "n/a"}, weighted issues ${metrics.ric.issueWeightedTotal ?? "n/a"}, severity buckets CRITICAL/HIGH/MED/LOW = ${metrics.ric.criticalCount}/${metrics.ric.highCount}/${metrics.ric.mediumCount}/${metrics.ric.lowCount}.`,
      );
    }
    if (metrics.upcomingMilestones.length) {
      lines.push(
        `Upcoming milestones: ${metrics.upcomingMilestones.map((m) => `${m.projectCode} ${m.code} on ${m.plannedDate}`).join("; ")}.`,
      );
    }
    if (metrics.topRisks.length) {
      lines.push(
        `Top risks: ${metrics.topRisks.map((r) => `${r.title} (${r.severity}, exposure ${r.exposureScore})`).join("; ")}.`,
      );
    }
    if (metrics.issuesClosedInWeek.length) {
      lines.push(
        `Issues closed this week: ${metrics.issuesClosedInWeek.map((i) => i.title).join("; ")}.`,
      );
    }
    lines.push("Write an executive weekly status overview suitable for leadership. Do not invent metrics.");
    return lines.join("\n");
  }

  private templateExecutiveSummary(metrics: CollectedMetrics): string {
    return [
      `Overall health is ${metrics.overallRag}, driven by backend schedule (${metrics.schedule.scheduleStatus}), financial ${metrics.financial.ragStatus ?? "n/a"}, and open risk/issue profile.`,
      `Schedule progress is ${metrics.schedule.actualProgressPercent}% actual versus ${metrics.schedule.expectedProgressPercent}% expected.`,
      metrics.financial.unavailableReason
        ? `Financial narrative deferred: ${metrics.financial.unavailableReason}`
        : `Cost performance CV% is ${metrics.financial.costVariancePercent ?? "n/a"} versus approved baseline.`,
      metrics.topRisks.length
        ? `Focus remains on ${metrics.topRisks[0].title} (${metrics.topRisks[0].severity}).`
        : "Top risks are within tolerance based on current exposure ranking.",
    ].join(" ");
  }

  private templateAccomplishments(metrics: CollectedMetrics): string[] {
    const items: string[] = [];
    if (metrics.issuesClosedInWeek.length) {
      items.push(`Closed ${metrics.issuesClosedInWeek.length} issue(s): ${metrics.issuesClosedInWeek.map((i) => i.title).join(", ")}.`);
    }
    items.push(
      `Maintained schedule execution at ${metrics.schedule.actualProgressPercent}% actual progress versus ${metrics.schedule.expectedProgressPercent}% expected.`,
    );
    if (!items.length) {
      items.push("No automated accomplishment signals were detected for this ISO week window.");
    }
    return items;
  }

  async proposeNarrative(metrics: CollectedMetrics): Promise<{ proposal: StatusReportAiProposal; accomplishmentsHint: string[] }> {
    const bullets = this.buildFactsBullets(metrics);
    const digest = createHash("sha256").update(bullets).digest("hex");
    const modelId = process.env.STATUS_REPORT_AI_MODEL ?? "Xenova/distilbart-cnn-6-6";
    let fallbackUsed = false;
    let executiveSummary = "";

    try {
      const summarizer = await this.getSummarizer(modelId);
      const raw = await summarizer(bullets.slice(0, 2800), {
        max_length: 160,
        min_length: 48,
      });
      const row = Array.isArray(raw) ? raw[0] : raw;
      executiveSummary =
        typeof row === "object" && row !== null && "summary_text" in row ? String((row as { summary_text: string }).summary_text) : "";
      if (!executiveSummary.trim()) {
        throw new Error("Empty summarizer output");
      }
    } catch (e) {
      fallbackUsed = true;
      this.logger.warn(`AI summarizer fallback engaged: ${(e as Error).message}`);
      executiveSummary = this.templateExecutiveSummary(metrics);
    }

    let accomplishmentsHint = this.templateAccomplishments(metrics);
    try {
      const focusText = [
        metrics.issuesClosedInWeek.map((i) => i.title).join(". ") || "No issues closed this week.",
        metrics.upcomingMilestones.map((m) => `${m.name} (${m.plannedDate})`).join(". ") || "No milestones in window.",
      ].join("\n");
      if (focusText.length > 40 && !fallbackUsed) {
        const summarizer = await this.getSummarizer(modelId);
        const raw = await summarizer(focusText.slice(0, 1800), { max_length: 120, min_length: 24 });
        const row = Array.isArray(raw) ? raw[0] : raw;
        const text =
          typeof row === "object" && row !== null && "summary_text" in row ? String((row as { summary_text: string }).summary_text) : "";
        if (text.trim()) {
          accomplishmentsHint = text
            .split(/(?:\.|;)\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6);
        }
      }
    } catch {
      accomplishmentsHint = this.templateAccomplishments(metrics);
    }

    const proposal: StatusReportAiProposal = {
      modelId,
      fallbackUsed,
      factsDigest: digest,
      generatedAt: new Date().toISOString(),
      inputFactsPreview: bullets.slice(0, 900),
      executiveSummaryRaw: executiveSummary,
    };

    return { proposal, accomplishmentsHint };
  }
}
