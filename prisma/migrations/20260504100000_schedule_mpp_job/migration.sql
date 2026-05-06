-- CreateTable
CREATE TABLE "ScheduleMppJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "ExcelJobStatus" NOT NULL DEFAULT 'CREATED',
    "sourceFormat" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mergeMode" TEXT,
    "payloadJson" JSONB,
    "validationReport" JSONB,
    "resultSummary" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleMppJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleMppJob_tenantId_projectId_operation_status_createdAt_idx" ON "ScheduleMppJob"("tenantId", "projectId", "operation", "status", "createdAt");
