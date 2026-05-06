-- Workflow integration fields for approval-gated publishing
ALTER TABLE "WeeklyStatusReport" ADD COLUMN "workflowInstanceId" TEXT;
ALTER TABLE "WeeklyStatusReport" ADD COLUMN "pendingPublishRevisionId" TEXT;

CREATE INDEX "WeeklyStatusReport_tenantId_workflowInstanceId_idx" ON "WeeklyStatusReport"("tenantId", "workflowInstanceId");

-- Restrict exports to Excel + PDF only (map legacy PPTX rows to PDF)
ALTER TABLE "WeeklyStatusReportExportJob" ALTER COLUMN "format" DROP DEFAULT;

CREATE TYPE "WeeklyStatusExportFormat_new" AS ENUM ('XLSX', 'PDF');

ALTER TABLE "WeeklyStatusReportExportJob"
  ALTER COLUMN "format" TYPE "WeeklyStatusExportFormat_new"
  USING (
    CASE
      WHEN "format"::text = 'PPTX' THEN 'PDF'::"WeeklyStatusExportFormat_new"
      ELSE "format"::text::"WeeklyStatusExportFormat_new"
    END
  );

DROP TYPE "WeeklyStatusExportFormat";
ALTER TYPE "WeeklyStatusExportFormat_new" RENAME TO "WeeklyStatusExportFormat";
