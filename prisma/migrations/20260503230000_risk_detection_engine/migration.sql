-- CreateEnum
CREATE TYPE "DetectedRiskSuggestionStatus" AS ENUM ('PROPOSED', 'UNDER_REVIEW', 'PUBLISHED', 'DISMISSED');

-- CreateTable
CREATE TABLE "RiskDetectionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeType" "FinancialObjectType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "metricsSnapshot" JSONB NOT NULL,
    "factsDigest" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskDetectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedRiskSuggestion" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectType" "FinancialObjectType" NOT NULL,
    "objectId" TEXT NOT NULL,
    "signalCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "descriptionDraft" TEXT,
    "category" TEXT,
    "probability" DECIMAL(5,2) NOT NULL,
    "impact" DECIMAL(5,2) NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "severityWeight" DECIMAL(5,2) NOT NULL,
    "exposureScore" DECIMAL(10,2) NOT NULL,
    "confidenceScore" DECIMAL(5,2) NOT NULL,
    "mitigationDraft" TEXT,
    "evidenceJson" JSONB NOT NULL,
    "aiExplanationJson" JSONB NOT NULL,
    "proposedOwnerId" TEXT NOT NULL,
    "status" "DetectedRiskSuggestionStatus" NOT NULL DEFAULT 'PROPOSED',
    "workflowInstanceId" TEXT,
    "publishedRiskId" TEXT,
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectedRiskSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskDetectionRun_tenantId_scopeType_scopeId_createdAt_idx" ON "RiskDetectionRun"("tenantId", "scopeType", "scopeId", "createdAt");

CREATE INDEX "RiskDetectionRun_tenantId_periodLabel_idx" ON "RiskDetectionRun"("tenantId", "periodLabel");

CREATE INDEX "DetectedRiskSuggestion_tenantId_status_idx" ON "DetectedRiskSuggestion"("tenantId", "status");

CREATE INDEX "DetectedRiskSuggestion_tenantId_objectType_objectId_idx" ON "DetectedRiskSuggestion"("tenantId", "objectType", "objectId");

CREATE INDEX "DetectedRiskSuggestion_tenantId_signalCode_idx" ON "DetectedRiskSuggestion"("tenantId", "signalCode");

ALTER TABLE "DetectedRiskSuggestion" ADD CONSTRAINT "DetectedRiskSuggestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RiskDetectionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
