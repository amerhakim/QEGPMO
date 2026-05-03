export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const endpoints = {
  login: "/auth/login",
  me: "/auth/me",
  dashboard: "/dashboard/consolidated",
  projects: "/projects",
  projectById: (projectId: string) => `/projects/${projectId}`,
  projectWorkflowSubmit: (projectId: string) => `/projects/${projectId}/workflow/submit`,
  projectWorkflowApprove: (projectId: string) => `/projects/${projectId}/workflow/approve`,
  projectWorkflowReject: (projectId: string) => `/projects/${projectId}/workflow/reject`,
  exportDashboard: "/exports/dashboard-summary",
  exportDrilldown: "/exports/dashboard-drilldown"
};
