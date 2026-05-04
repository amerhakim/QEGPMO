export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const endpoints = {
  login: "/auth/login",
  me: "/auth/me",
  dashboard: "/dashboard/consolidated",
  projects: "/projects",
  projectById: (projectId: string) => `/projects/${projectId}`,
  projectTasks: (projectId: string) => `/projects/${projectId}/tasks`,
  projectTaskById: (projectId: string, taskId: string) => `/projects/${projectId}/tasks/${taskId}`,
  projectMilestones: (projectId: string) => `/projects/${projectId}/milestones`,
  projectMilestoneById: (projectId: string, milestoneId: string) => `/projects/${projectId}/milestones/${milestoneId}`,
  projectDependencies: (projectId: string) => `/projects/${projectId}/dependencies`,
  resources: "/resources",
  resourceById: (resourceId: string) => `/resources/${resourceId}`,
  resourceWorkflowSubmit: (resourceId: string) => `/resources/${resourceId}/workflow/submit`,
  resourceWorkflowApprove: (resourceId: string) => `/resources/${resourceId}/workflow/approve`,
  resourceWorkflowReject: (resourceId: string) => `/resources/${resourceId}/workflow/reject`,
  projectWorkflowSubmit: (projectId: string) => `/projects/${projectId}/workflow/submit`,
  projectWorkflowApprove: (projectId: string) => `/projects/${projectId}/workflow/approve`,
  projectWorkflowReject: (projectId: string) => `/projects/${projectId}/workflow/reject`,
  exportDashboard: "/exports/dashboard-summary",
  exportDrilldown: "/exports/dashboard-drilldown"
};
