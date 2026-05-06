-- CreateEnum
CREATE TYPE "WeeklyStatusReportStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WeeklyStatusExportFormat" AS ENUM ('XLSX', 'PDF', 'PPTX');

-- CreateTable
CREATE TABLE "WeeklyStatusReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeType" "FinancialObjectType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "reportingWeek" TEXT NOT NULL,
    "fiscalPeriod" TEXT NOT NULL,
    "status" "WeeklyStatusReportStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishedRevisionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyStatusReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStatusReportRevision" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "metricsSnapshot" JSONB NOT NULL,
    "aiProposal" JSONB NOT NULL,
    "editorContent" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyStatusReportRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStatusReportExportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "format" "WeeklyStatusExportFormat" NOT NULL,
    "status" "ExcelJobStatus" NOT NULL DEFAULT 'COMPLETED',
    "fileName" TEXT NOT NULL,
    "resultSummary" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyStatusReportExportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyStatusReport_publishedRevisionId_key" ON "WeeklyStatusReport"("publishedRevisionId");

CREATE UNIQUE INDEX "WeeklyStatusReport_tenantId_scopeType_scopeId_reportingWeek_key" ON "WeeklyStatusReport"("tenantId", "scopeType", "scopeId", "reportingWeek");

CREATE UNIQUE INDEX "WeeklyStatusReportRevision_reportId_revisionNumber_key" ON "WeeklyStatusReportRevision"("reportId", "revisionNumber");

CREATE INDEX "WeeklyStatusReport_tenantId_status_reportingWeek_idx" ON "WeeklyStatusReport"("tenantId", "status", "reportingWeek");

CREATE INDEX "WeeklyStatusReportRevision_reportId_revisionNumber_idx" ON "WeeklyStatusReportRevision"("reportId", "revisionNumber");

CREATE INDEX "WeeklyStatusReportExportJob_tenantId_reportId_createdAt_idx" ON "WeeklyStatusReportExportJob"("tenantId", "reportId", "createdAt");

ALTER TABLE "WeeklyStatusReportRevision" ADD CONSTRAINT "WeeklyStatusReportRevision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyStatusReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyStatusReport" ADD CONSTRAINT "WeeklyStatusReport_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "WeeklyStatusReportRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyStatusReportExportJob" ADD CONSTRAINT "WeeklyStatusReportExportJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyStatusReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyStatusReportExportJob" ADD CONSTRAINT "WeeklyStatusReportExportJob_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WeeklyStatusReportRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
