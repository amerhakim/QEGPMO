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

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface TaskSummary {
  taskId: string;
  projectId: string;
  parentTaskId?: string | null;
  wbsCode: string;
  name: string;
  taskType: "TASK" | "MILESTONE";
  status: string;
  plannedStart?: string;
  plannedFinish?: string;
  actualStart?: string;
  actualFinish?: string;
  plannedProgressPercent?: number;
  actualProgressPercent?: number;
  baselineStart?: string;
  baselineFinish?: string;
  updatedBaselineStart?: string;
  updatedBaselineFinish?: string;
  scheduleIndicator?: RagStatus;
  costIndicator?: RagStatus;
  children?: TaskSummary[];
}

export interface TaskDetail extends TaskSummary {
  description?: string;
  assigneeName?: string;
  predecessorCount?: number;
  successorCount?: number;
  progressTrend?: Array<{
    period: string;
    plannedProgressPercent: number;
    actualProgressPercent: number;
  }>;
}

export interface MilestoneSummary {
  milestoneId: string;
  projectId: string;
  code: string;
  name: string;
  status: string;
  baselineDate?: string;
  forecastDate?: string;
  actualDate?: string;
  criticalFlag?: boolean;
}

export interface DependencyLink {
  dependencyId: string;
  predecessorTaskId: string;
  predecessorTaskName: string;
  successorTaskId: string;
  successorTaskName: string;
  dependencyType: DependencyType;
  lagDays?: number;
}

export interface ResourceSummary {
  resourceId: string;
  resourceType: "NAMED" | "GENERIC";
  fullName: string;
  roleName?: string;
  skillTags: string[];
  availabilityStatus?: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  capacityHours?: number;
  allocatedHours?: number;
  utilizationPercent?: number;
  overAllocated?: boolean;
}

export interface ResourceAllocationPoint {
  period: string;
  capacityHours: number;
  allocatedHours: number;
  utilizationPercent: number;
}

export interface ResourceAllocationItem {
  allocationId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  period: string;
  allocationPercent?: number;
  plannedHours?: number;
  actualHours?: number;
  status?: string;
}

export interface ResourceDetail extends ResourceSummary {
  employeeCode?: string;
  orgUnit?: string;
  managerName?: string;
  standardRate?: number;
  skills: Array<{
    skillId: string;
    skillName: string;
    proficiency?: string;
  }>;
  allocationTimeline: ResourceAllocationPoint[];
  historicalAllocations: ResourceAllocationItem[];
  workflowState?: {
    currentState: string;
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
  };
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
  scheduleSummary?: {
    baselineStart?: string;
    baselineEnd?: string;
    updatedBaselineStart?: string;
    updatedBaselineEnd?: string;
  };
  tasks?: TaskSummary[];
  milestones?: MilestoneSummary[];
  dependencies?: DependencyLink[];
}
