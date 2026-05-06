import { Module } from "@nestjs/common";
import { FinancialModule } from "../financial/financial.module";
import { RicModule } from "../ric/ric.module";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { RiskDetectionAiService } from "./risk-detection-ai.service";
import { RiskDetectionController } from "./risk-detection.controller";
import { RiskDetectionMetricsCollectorService } from "./risk-detection-metrics-collector.service";
import { RiskDetectionRulesService } from "./risk-detection-rules.service";
import { RiskDetectionService } from "./risk-detection.service";

@Module({
  imports: [WorkflowModule, SchedulingModule, FinancialModule, RicModule],
  controllers: [RiskDetectionController],
  providers: [
    RiskDetectionService,
    RiskDetectionMetricsCollectorService,
    RiskDetectionRulesService,
    RiskDetectionAiService,
  ],
  exports: [RiskDetectionService],
})
export class RiskDetectionModule {}
