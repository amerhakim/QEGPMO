import { IsString } from "class-validator";

export class StartWorkflowDto {
  @IsString()
  tenantId!: string;

  @IsString()
  workflowCode!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;
}
