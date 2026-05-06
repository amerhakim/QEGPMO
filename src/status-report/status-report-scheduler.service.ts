import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { FinancialObjectType, ProjectLifecycleStatus } from "@prisma/client";
import { RequestUser } from "../common/auth/request-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { StatusReportService } from "./status-report.service";
import { formatIsoWeekUtcForDate } from "./status-report.types";

function systemActor(tenantId: string): RequestUser {
  return {
    userId: "SYSTEM",
    tenantId,
    roles: [],
    permissions: ["status_report.generate"],
  };
}

/**
 * Automatic weekly draft generation for ACTIVE projects (tenant-safe).
 * Uses prior ISO week relative to job run (Monday cron → previous week label).
 * Disable with STATUS_REPORT_AUTO_GENERATE=false.
 */
@Injectable()
export class StatusReportSchedulerService {
  private readonly logger = new Logger(StatusReportSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusReports: StatusReportService,
  ) {}

  @Cron(process.env.STATUS_REPORT_CRON ?? "0 0 6 * * 1")
  async weeklyAutoGenerate(): Promise<void> {
    if (process.env.STATUS_REPORT_AUTO_GENERATE === "false") {
      return;
    }

    const anchor = new Date();
    anchor.setUTCDate(anchor.getUTCDate() - 7);
    const reportingWeek = formatIsoWeekUtcForDate(anchor);

    const max = Number(process.env.STATUS_REPORT_AUTO_GENERATE_MAX_PROJECTS ?? 500);
    const projects = await this.prisma.project.findMany({
      where: { lifecycleStatus: ProjectLifecycleStatus.ACTIVE },
      select: { id: true, tenantId: true },
      take: max,
    });

    let generated = 0;
    let skipped = 0;
    for (const p of projects) {
      try {
        await this.statusReports.generate(
          {
            tenantId: p.tenantId,
            scopeType: FinancialObjectType.PROJECT,
            scopeId: p.id,
            reportingWeek,
            refreshMetrics: false,
          },
          systemActor(p.tenantId),
        );
        generated += 1;
      } catch (e) {
        skipped += 1;
        this.logger.debug(`Auto-generate skipped for project ${p.id}: ${(e as Error).message}`);
      }
    }

    this.logger.log(`Weekly status auto-generate (${reportingWeek}): ${generated} drafts created or revised, ${skipped} skipped.`);
  }
}
