import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ExecutiveDashboardPage } from "./pages/ExecutiveDashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";

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
