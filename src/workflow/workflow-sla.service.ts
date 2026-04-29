import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WorkflowService } from "./workflow.service";

@Injectable()
export class WorkflowSlaService {
  private readonly logger = new Logger(WorkflowSlaService.name);

  constructor(private readonly workflowService: WorkflowService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorSla(): Promise<void> {
    const result = await this.workflowService.runSlaEscalation();
    this.logger.log(`SLA monitor checked=${result.checked} escalated=${result.escalated}`);
  }
}
