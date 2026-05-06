import React from "react";
import { ExecutiveConsolidatedDashboard } from "./components/ExecutiveConsolidatedDashboard";
import { DashboardScope, UserContext } from "./types";

const demoUser: UserContext = {
  userId: "exec-001",
  tenantId: "tenant-demo",
  roles: ["EXECUTIVE"],
  permissions: [
    "dashboard.read",
    "financial.summary.compute",
    "project.read",
    "ric.rollup.compute",
    "scheduling.progress.read",
    "scheduling.rollup.compute",
    "status_report.generate",
    "status_report.read",
    "status_report.edit",
    "status_report.submit",
    "status_report.export",
  ],
};

const initialScope: DashboardScope = {
  tenantId: demoUser.tenantId,
  level: "PORTFOLIO",
  id: "portfolio-root",
};

export default function App() {
  return <ExecutiveConsolidatedDashboard user={demoUser} initialScope={initialScope} />;
}
