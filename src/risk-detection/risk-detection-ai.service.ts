import { createHash } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { RuleSignal } from "./risk-detection-rules.service";

export interface AiEnrichmentResult {
  mitigationDraft: string;
  aiExplanationJson: Record<string, unknown>;
}

/** Open-source local summarization for mitigation drafts only — metrics remain untouched. */
@Injectable()
export class RiskDetectionAiService {
  private readonly logger = new Logger(RiskDetectionAiService.name);
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

  private templateMitigation(signal: RuleSignal): string {
    return [
      `Governance controls: route ${signal.signalCode} through the PMO risk forum; validate assumptions with owners.`,
      `Establish corrective checkpoints within one steering cycle; tie milestones to dependency recovery where applicable.`,
      `Document variance drivers referenced in evidence JSON before mobilizing budget or schedule contingency.`,
    ].join(" ");
  }

  async enrichMitigation(signal: RuleSignal, metricsFactsDigest: string): Promise<AiEnrichmentResult> {
    const modelId = process.env.RISK_DETECTION_AI_MODEL ?? "Xenova/distilbart-cnn-6-6";
    const inputBullets = [
      `Signal ${signal.signalCode} (${signal.category}) severity ${signal.severity}.`,
      signal.descriptionDraft,
      `Evidence keys: ${JSON.stringify(signal.evidence).slice(0, 1200)}`,
      "Draft mitigation and controls text only; do not invent metrics.",
    ].join("\n");

    const inputHash = createHash("sha256").update(metricsFactsDigest + signal.signalCode).digest("hex");
    let fallbackUsed = false;
    let mitigationDraft = "";

    try {
      const summarizer = await this.getSummarizer(modelId);
      const raw = await summarizer(inputBullets.slice(0, 2600), { max_length: 140, min_length: 36 });
      const row = Array.isArray(raw) ? raw[0] : raw;
      mitigationDraft =
        typeof row === "object" && row !== null && "summary_text" in row ? String((row as { summary_text: string }).summary_text) : "";
      if (!mitigationDraft.trim()) throw new Error("empty summarizer output");
    } catch (e) {
      fallbackUsed = true;
      this.logger.warn(`Mitigation AI fallback: ${(e as Error).message}`);
      mitigationDraft = this.templateMitigation(signal);
    }

    return {
      mitigationDraft,
      aiExplanationJson: {
        modelId,
        fallbackUsed,
        inputFactsDigest: metricsFactsDigest,
        signalCode: signal.signalCode,
        inputHash,
        inputPreview: inputBullets.slice(0, 400),
      },
    };
  }

  aiConfidenceAdjustment(fallbackUsed: boolean): number {
    return fallbackUsed ? 0 : 6;
  }
}
