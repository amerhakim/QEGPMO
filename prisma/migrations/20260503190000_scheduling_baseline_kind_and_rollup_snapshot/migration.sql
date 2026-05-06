-- CreateEnum
CREATE TYPE "BaselineKind" AS ENUM ('ORIGINAL', 'UPDATED');

-- AlterTable
ALTER TABLE "ScheduleBaseline" ADD COLUMN "baselineKind" "BaselineKind" NOT NULL DEFAULT 'UPDATED';

-- CreateIndex
CREATE INDEX "ScheduleBaseline_tenantId_projectId_baselineKind_scope_idx" ON "ScheduleBaseline"("tenantId", "projectId", "baselineKind", "scope");

-- CreateTable
CREATE TABLE "ScheduleRollupSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectType" "FinancialObjectType" NOT NULL,
    "objectId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualProgressPercent" DECIMAL(5,2) NOT NULL,
    "expectedProgressPercent" DECIMAL(5,2) NOT NULL,
    "scheduleVariancePercent" DECIMAL(5,2) NOT NULL,
    "scheduleRag" "ProjectHealthRag" NOT NULL,
    "includedProjectCount" INTEGER NOT NULL DEFAULT 0,
    "leafTaskCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleRollupSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleRollupSnapshot_tenantId_objectType_objectId_reportingPeriod_computedAt_idx" ON "ScheduleRollupSnapshot"("tenantId", "objectType", "objectId", "reportingPeriod", "computedAt");
