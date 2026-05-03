export type RollupLevel = "PORTFOLIO" | "PROGRAM" | "PROJECT";

export interface DashboardScope {
  tenantId: string;
  level: RollupLevel;
  id: string;
}

export interface ProjectKpiColumn {
  projectId: string;
  projectCode: string;
  projectName: string;
  progressPercent: number;
  scheduleVariancePercent: number;
  costVariancePercent: number;
  riskCritical: number;
  riskHigh: number;
  issueCritical: number;
  issueHigh: number;
  overallRag: "GREEN" | "AMBER" | "RED";
}

export interface ComparisonMatrixDataset {
  scope: DashboardScope;
  columns: ProjectKpiColumn[];
  computedAt: string;
}

export interface RiskIssueSeverityPoint {
  name: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ExecutiveSummary {
  progressPercent: number;
  scheduleRag: "GREEN" | "AMBER" | "RED";
  costRag: "GREEN" | "AMBER" | "RED";
  overallRag: "GREEN" | "AMBER" | "RED";
}

export interface DrilldownNode {
  level: RollupLevel;
  id: string;
  name: string;
}

export interface DashboardData {
  summary: ExecutiveSummary;
  matrix: ComparisonMatrixDataset;
  severityDistribution: RiskIssueSeverityPoint[];
  drilldownPath: DrilldownNode[];
}

export interface UserContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}
