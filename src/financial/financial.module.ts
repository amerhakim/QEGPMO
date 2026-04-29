import { Module } from "@nestjs/common";
import { WorkflowModule } from "../workflow/workflow.module";
import { FinancialController } from "./financial.controller";
import { FinancialService } from "./financial.service";

@Module({
  imports: [WorkflowModule],
  controllers: [FinancialController],
  providers: [FinancialService],
  exports: [FinancialService],
})
export class FinancialModule {}
