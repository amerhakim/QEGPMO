export type UserRole = "EXECUTIVE" | "PMO" | "PROJECT_MANAGER";

export type RagStatus = "GREEN" | "AMBER" | "RED" | "UNKNOWN";

export interface User {
  userId: string;
  name: string;
  username: string;
  role: UserRole;
  tenantId: string;
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface KpiMatrixRow {
  kpiLabel: string;
  valuesByProject: Record<string, string | number>;
}

export interface ProjectSummary {
  projectId: string;
  projectCode: string;
  name: string;
  description?: string;
  projectType?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lifecyclePhase?: string;
  sponsorId?: string;
  managerId?: string;
  baselineStart?: string;
  baselineEnd?: string;
  portfolioName?: string;
  portfolioId?: string;
  programName?: string;
  programId?: string;
  managerName?: string;
  progressPercent: number;
  scheduleStatus: RagStatus;
  costStatus: RagStatus;
  plannedBudget: number;
  forecastCost?: number;
  varianceAmount?: number;
  actualCost: number;
  overallHealth: RagStatus;
  riskBySeverity: Record<string, number>;
  issueBySeverity: Record<string, number>;
}

export interface ProjectFormPayload {
  projectCode: string;
  name: string;
  description?: string;
  projectType: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lifecyclePhase: string;
  programId?: string;
  portfolioId?: string;
  sponsorId?: string;
  managerId: string;
  baselineStart: string;
  baselineEnd: string;
  plannedBudget: number;
}

export interface ApiValidationError {
  field: string;
  message: string;
}

export interface DashboardRollup {
  level: "ENTERPRISE" | "PORTFOLIO" | "PROGRAM";
  levelEntityId: string;
  levelEntityName: string;
  progressPercent: number;
  scheduleStatus: RagStatus;
  costStatus: RagStatus;
  overallHealth: RagStatus;
  riskExposure: number;
  issueBacklog: number;
}

export interface DashboardResponse {
  projects: ProjectSummary[];
  rollups: DashboardRollup[];
  kpiRows: KpiMatrixRow[];
}

export interface ProjectDetail {
  project: ProjectSummary;
  workflowState?: {
    currentState: string;
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
    pendingApprovers?: string[];
  };
  phaseGates?: Array<{
    gateCode: string;
    gateName: string;
    phaseName: string;
    status: "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED";
    dueAt?: string;
    decidedAt?: string;
  }>;
  statusHistory: Array<{
    period: string;
    progressPercent: number;
    scheduleStatus: RagStatus;
    costStatus: RagStatus;
    overallHealth: RagStatus;
  }>;
}
