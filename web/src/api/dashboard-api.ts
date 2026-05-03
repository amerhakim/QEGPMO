import { DashboardData, DashboardScope, UserContext } from "../types";

const API_BASE_URL = "/api";

async function request<T>(
  path: string,
  method: "GET" | "POST",
  user: UserContext,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.userId,
      "x-tenant-id": user.tenantId,
      "x-roles": user.roles.join(","),
      "x-permissions": user.permissions.join(","),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Dashboard API failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getExecutiveDashboard(
  scope: DashboardScope,
  user: UserContext,
): Promise<DashboardData> {
  return request<DashboardData>("/dashboard/executive", "POST", user, scope);
}

export async function exportDashboard(scope: DashboardScope, user: UserContext): Promise<void> {
  await request("/dashboard/executive/export", "POST", user, {
    scope,
    exportType: "FULL_DATASET",
  });
}

export async function exportDrilldown(scope: DashboardScope, user: UserContext): Promise<void> {
  await request("/dashboard/executive/export", "POST", user, {
    scope,
    exportType: "DRILLDOWN",
  });
}
