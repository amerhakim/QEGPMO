-- Restore PPTX alongside XLSX and PDF (transaction-safe vs ALTER TYPE ADD VALUE)
ALTER TABLE "WeeklyStatusReportExportJob" ALTER COLUMN "format" DROP DEFAULT;

CREATE TYPE "WeeklyStatusExportFormat_new" AS ENUM ('XLSX', 'PDF', 'PPTX');

ALTER TABLE "WeeklyStatusReportExportJob"
  ALTER COLUMN "format" TYPE "WeeklyStatusExportFormat_new"
  USING ("format"::text::"WeeklyStatusExportFormat_new");

DROP TYPE "WeeklyStatusExportFormat";
ALTER TYPE "WeeklyStatusExportFormat_new" RENAME TO "WeeklyStatusExportFormat";
