import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DetectedRiskSuggestionStatus, Prisma, SeverityLevel } from "@prisma/client";
import { createHash } from "crypto";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { WorkflowIntegrationFacade } from "../workflow/workflow.integration";
import { AuditService } from "../workflow/audit.service";
import { DismissDetectedRiskSuggestionDto } from "./dto/dismiss-detected-risk.dto";
import { RunRiskDetectionDto } from "./dto/run-risk-detection.dto";
import { SubmitDetectedRiskSuggestionDto } from "./dto/submit-detected-risk.dto";
import { RiskDetectionAiService } from "./risk-detection-ai.service";
import { RiskDetectionMetricsCollectorService } from "./risk-detection-metrics-collector.service";
import { RiskDetectionRulesService } from "./risk-detection-rules.service";

@Injectable()
export class RiskDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly workflowIntegration: WorkflowIntegrationFacade,
    private readonly collector: RiskDetectionMetricsCollectorService,
    private readonly rules: RiskDetectionRulesService,
    private readonly ai: RiskDetectionAiService,
  ) {}

  async runAnalysis(dto: RunRiskDetectionDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const refreshMetrics = dto.refreshMetrics ?? false;
    const proposedOwnerId = dto.proposedOwnerId ?? actor.userId;

    const metrics = await this.collector.collect(
      dto.tenantId,
      dto.scopeType,
      dto.scopeId,
      dto.periodLabel,
      actor,
      refreshMetrics,
    );

    const metricsFactsDigest = createHash("sha256").update(JSON.stringify(metrics)).digest("hex");

    const signals = this.rules.evaluate(metrics);
    const run = await this.prisma.riskDetectionRun.create({
      data: {
        tenantId: dto.tenantId,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        periodLabel: dto.periodLabel,
        metricsSnapshot: this.json(metrics),
        factsDigest: metricsFactsDigest,
        createdBy: actor.userId,
      },
    });

    const suggestions: unknown[] = [];
    for (const signal of signals) {
      const { mitigationDraft, aiExplanationJson } = await this.ai.enrichMitigation(signal, metricsFactsDigest);
      const fallbackUsed = Boolean(aiExplanationJson.fallbackUsed);
      const aiAdj = this.ai.aiConfidenceAdjustment(fallbackUsed);
      const confidenceScore = Math.min(100, signal.ruleConfidence + aiAdj);

      const severityWeight = this.ricSeverityWeight(signal.severity);
      const exposureScore = Number((signal.probability * signal.impact * severityWeight).toFixed(4));

      const row = await this.prisma.detectedRiskSuggestion.create({
        data: {
          runId: run.id,
          tenantId: dto.tenantId,
          objectType: dto.scopeType,
          objectId: dto.scopeId,
          signalCode: signal.signalCode,
          title: signal.title,
          descriptionDraft: signal.descriptionDraft,
          category: signal.category,
          probability: new Prisma.Decimal(signal.probability),
          impact: new Prisma.Decimal(signal.impact),
          severity: signal.severity,
          severityWeight: new Prisma.Decimal(severityWeight),
          exposureScore: new Prisma.Decimal(exposureScore),
          confidenceScore: new Prisma.Decimal(confidenceScore),
          mitigationDraft,
          evidenceJson: this.json(signal.evidence),
          aiExplanationJson: this.json(aiExplanationJson),
          proposedOwnerId,
          status: DetectedRiskSuggestionStatus.PROPOSED,
        },
      });
      suggestions.push(row);
    }

    await this.auditService.log({
      tenantId: dto.tenantId,
      entityType: "RiskDetectionRun",
      entityId: run.id,
      action: "RISK_DETECTION_RUN_CREATED",
      actorId: actor.userId,
      newValue: {
        factsDigest: metricsFactsDigest,
        suggestionCount: signals.length,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
      },
    });

    return { run, suggestions };
  }

  async listRuns(tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    return this.prisma.riskDetectionRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { suggestions: { select: { id: true, signalCode: true, status: true, title: true } } },
    });
  }

  async getRun(runId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const run = await this.prisma.riskDetectionRun.findFirst({
      where: { id: runId, tenantId },
      include: { suggestions: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) throw new NotFoundException("Risk detection run not found.");
    return run;
  }

  async listSuggestions(
    tenantId: string,
    actor: RequestUser,
    status?: DetectedRiskSuggestionStatus,
    runId?: string,
  ) {
    this.assertTenant(tenantId, actor);
    return this.prisma.detectedRiskSuggestion.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(runId ? { runId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { run: { select: { id: true, periodLabel: true, scopeType: true, scopeId: true, factsDigest: true } } },
    });
  }

  async getSuggestion(suggestionId: string, tenantId: string, actor: RequestUser) {
    this.assertTenant(tenantId, actor);
    const s = await this.prisma.detectedRiskSuggestion.findFirst({
      where: { id: suggestionId, tenantId },
      include: { run: true },
    });
    if (!s) throw new NotFoundException("Suggestion not found.");
    return s;
  }

  async submitForApproval(suggestionId: string, dto: SubmitDetectedRiskSuggestionDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const suggestion = await this.prisma.detectedRiskSuggestion.findFirst({
      where: { id: suggestionId, tenantId: dto.tenantId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found.");
    if (suggestion.status !== DetectedRiskSuggestionStatus.PROPOSED) {
      throw new ConflictException("Only PROPOSED suggestions can enter workflow approval.");
    }
    if (suggestion.workflowInstanceId) {
      throw new ConflictException("Workflow already linked.");
    }

    const wf = await this.workflowIntegration.forRiskDetection().startDetectedRiskSuggestionApproval(dto.tenantId, suggestionId, actor);

    const updated = await this.prisma.detectedRiskSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: DetectedRiskSuggestionStatus.UNDER_REVIEW,
        workflowInstanceId: wf.id,
      },
    });

    await this.auditService.log({
      tenantId: dto.tenantId,
      entityType: "DetectedRiskSuggestion",
      entityId: suggestionId,
      action: "DETECTED_RISK_SUBMITTED_FOR_APPROVAL",
      actorId: actor.userId,
      newValue: { workflowInstanceId: wf.id, signalCode: suggestion.signalCode },
    });

    return { suggestion: updated, workflowInstance: wf };
  }

  async dismiss(suggestionId: string, dto: DismissDetectedRiskSuggestionDto, actor: RequestUser) {
    this.assertTenant(dto.tenantId, actor);
    const suggestion = await this.prisma.detectedRiskSuggestion.findFirst({
      where: { id: suggestionId, tenantId: dto.tenantId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found.");
    if (suggestion.status !== DetectedRiskSuggestionStatus.PROPOSED) {
      throw new ConflictException("Only PROPOSED suggestions can be dismissed without workflow.");
    }

    const updated = await this.prisma.detectedRiskSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: DetectedRiskSuggestionStatus.DISMISSED,
        reviewerNotes: dto.reason ?? null,
      },
    });

    await this.auditService.log({
      tenantId: dto.tenantId,
      entityType: "DetectedRiskSuggestion",
      entityId: suggestionId,
      action: "DETECTED_RISK_DISMISSED",
      actorId: actor.userId,
      oldValue: { status: suggestion.status, signalCode: suggestion.signalCode },
      newValue: { status: updated.status, reason: dto.reason ?? null },
    });

    return updated;
  }

  private ricSeverityWeight(severity: SeverityLevel): number {
    if (severity === "CRITICAL") return 10;
    if (severity === "HIGH") return 6;
    if (severity === "MEDIUM") return 3;
    return 1;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private assertTenant(tenantId: string, actor: RequestUser) {
    if (tenantId !== actor.tenantId) throw new ForbiddenException("Cross-tenant access denied.");
  }
}
