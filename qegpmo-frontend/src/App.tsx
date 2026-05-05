import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AiRiskDetectionPage } from "./pages/AiRiskDetectionPage";
import { AiWeeklyReportsPage } from "./pages/AiWeeklyReportsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ApprovalDetailPage } from "./pages/ApprovalDetailPage";
import { ChangeDetailPage } from "./pages/ChangeDetailPage";
import { ChangeRequestListPage } from "./pages/ChangeRequestListPage";
import { ExecutiveDashboardPage } from "./pages/ExecutiveDashboardPage";
import { IssueDetailPage } from "./pages/IssueDetailPage";
import { IssueRegisterPage } from "./pages/IssueRegisterPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportingExportPage } from "./pages/ReportingExportPage";
import { RiskDetailPage } from "./pages/RiskDetailPage";
import { RiskRegisterPage } from "./pages/RiskRegisterPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { WorkflowInboxPage } from "./pages/WorkflowInboxPage";

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredPermission="dashboard.read">
            <AppShell>
              <ExecutiveDashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute requiredPermission="project.read">
            <AppShell>
              <ProjectsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute requiredPermission="project.read">
            <AppShell>
              <ProjectDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/risks"
        element={
          <ProtectedRoute requiredPermission="ric.excel.export">
            <AppShell>
              <RiskRegisterPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/risks/:riskId"
        element={
          <ProtectedRoute requiredPermission="ric.excel.export">
            <AppShell>
              <RiskDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/issues"
        element={
          <ProtectedRoute requiredPermission="ric.excel.export">
            <AppShell>
              <IssueRegisterPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/issues/:issueId"
        element={
          <ProtectedRoute requiredPermission="ric.excel.export">
            <AppShell>
              <IssueDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/changes"
        element={
          <ProtectedRoute requiredPermission="ric.excel.export">
            <AppShell>
              <ChangeRequestListPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/changes/:changeId"
        element={
          <ProtectedRoute requiredPermission="ric.excel.export">
            <AppShell>
              <ChangeDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute requiredPermission="workflow.instance.read">
            <AppShell>
              <WorkflowInboxPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals/:instanceId"
        element={
          <ProtectedRoute requiredPermission="workflow.instance.read">
            <AppShell>
              <ApprovalDetailPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-weekly-reports"
        element={
          <ProtectedRoute requiredPermission="dashboard.read">
            <AppShell>
              <AiWeeklyReportsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-risk-detection"
        element={
          <ProtectedRoute requiredPermission="dashboard.read">
            <AppShell>
              <AiRiskDetectionPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reporting"
        element={
          <ProtectedRoute requiredPermission="dashboard.read">
            <AppShell>
              <ReportingExportPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/unauthorized"
        element={
          <AppShell>
            <UnauthorizedPage />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
