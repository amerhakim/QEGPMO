import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import type { DashboardResponse, FinancialObjectType, FinancialSummaryRow, ProjectSummary, RicRollupRow } from "../types";
import { usePermission } from "../hooks/usePermission";

const toPeriod = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const downloadBlob = (data: BlobPart, fileName: string, mime: string) => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export const ReportingExportPage = () => {
  const { user } = useAuth();
  const canDashboardExport = usePermission("export.dashboard");
  const canProjectExport = usePermission("project.excel.export");
  const [tab, setTab] = useState(0);
  const [scopeId, setScopeId] = useState("");
  const [period, setPeriod] = useState(toPeriod(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [financialRollup, setFinancialRollup] = useState<FinancialSummaryRow | null>(null);
  const [ricRollup, setRicRollup] = useState<RicRollupRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const scope = useMemo<"PORTFOLIO" | "PROGRAM" | "PROJECT">(
    () => (tab === 0 ? "PORTFOLIO" : tab === 1 ? "PROGRAM" : "PROJECT"),
    [tab]
  );

  const rollupObjectType = useMemo<FinancialObjectType>(
    () => (scope === "PROJECT" ? "PROJECT" : scope === "PROGRAM" ? "PROGRAM" : "PORTFOLIO"),
    [scope]
  );

  const targetObjectId = scope === "PROJECT" ? selectedProjectId : scopeId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectsRes = await apiClient.get<ProjectSummary[]>(endpoints.projects);
      const projectRows = projectsRes.data ?? [];
      setProjects(projectRows);
      const projectId = selectedProjectId || projectRows[0]?.projectId || "";
      if (!selectedProjectId && projectId) {
        setSelectedProjectId(projectId);
      }

      const dashboardRes = await apiClient.get<DashboardResponse>(endpoints.dashboard, {
        params: { scope: scope === "PROJECT" ? "ENTERPRISE" : scope, scopeId: scopeId || undefined }
      });
      setDashboard(dashboardRes.data);

      if (user?.tenantId && (scope !== "PROJECT" ? scopeId : projectId)) {
        const objectId = scope === "PROJECT" ? projectId : scopeId;
        const [financialRes, ricRes] = await Promise.all([
          apiClient.post<{ rollup?: FinancialSummaryRow; summary?: FinancialSummaryRow }>(
            endpoints.financialRollup,
            undefined,
            {
              params: {
                tenantId: user.tenantId,
                objectType: rollupObjectType,
                objectId,
                period
              }
            }
          ),
          apiClient.post<RicRollupRow>(
            endpoints.ricRollup,
            undefined,
            {
              params: {
                tenantId: user.tenantId,
                objectType: rollupObjectType,
                objectId,
                period
              }
            }
          )
        ]);
        setFinancialRollup(financialRes.data.rollup ?? financialRes.data.summary ?? null);
        setRicRollup(ricRes.data ?? null);
      } else {
        setFinancialRollup(null);
        setRicRollup(null);
      }
    } catch {
      setError("Unable to load reporting data.");
    } finally {
      setLoading(false);
    }
  }, [period, rollupObjectType, scope, scopeId, selectedProjectId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportDashboard = async () => {
    setActionError(null);
    try {
      const { data } = await apiClient.post(
        endpoints.exportDashboard,
        {
          scope: scope === "PROJECT" ? "ENTERPRISE" : scope,
          scopeId: scopeId || null
        },
        { responseType: "arraybuffer" }
      );
      downloadBlob(data, `${scope.toLowerCase()}-report.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch {
      setActionError("Unable to export dashboard report.");
    }
  };

  const exportProjects = async () => {
    if (!user?.tenantId) return;
    setActionError(null);
    try {
      const { data } = await apiClient.post(
        endpoints.projectExcelExport,
        { tenantId: user.tenantId },
        { responseType: "arraybuffer" }
      );
      downloadBlob(data, "projects-report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch {
      setActionError("Unable to export project report.");
    }
  };

  if (loading) return <LoadingState message="Loading reporting views..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Reporting & Export
      </Typography>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Portfolio Reports" />
        <Tab label="Program Reports" />
        <Tab label="Project Reports" />
      </Tabs>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            {scope === "PROJECT" ? (
              <TextField
                select
                label="Project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                sx={{ minWidth: 280 }}
              >
                {projects.map((project) => (
                  <MenuItem key={project.projectId} value={project.projectId}>
                    {project.projectCode} - {project.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label={`${scope} ID`}
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                sx={{ minWidth: 240 }}
              />
            )}
            <TextField label="Period (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ maxWidth: 180 }} />
            <Button variant="outlined" onClick={load}>
              Apply Filters
            </Button>
            {canDashboardExport ? (
              <Button variant="contained" onClick={exportDashboard}>
                Export View Excel
              </Button>
            ) : null}
            {scope === "PROJECT" && canProjectExport ? (
              <Button variant="contained" color="secondary" onClick={exportProjects}>
                Export Project Excel
              </Button>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Backend Roll-up Data</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Entity</TableCell>
                <TableCell>Progress %</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Cost</TableCell>
                <TableCell>Overall</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(dashboard?.rollups ?? []).map((row) => (
                <TableRow key={`${row.level}-${row.levelEntityId}`}>
                  <TableCell>{row.levelEntityName}</TableCell>
                  <TableCell>{row.progressPercent}</TableCell>
                  <TableCell>{row.scheduleStatus}</TableCell>
                  <TableCell>{row.costStatus}</TableCell>
                  <TableCell>{row.overallHealth}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Financial Roll-up (Backend)</Typography>
          <Divider sx={{ my: 1.5 }} />
          {financialRollup ? (
            <Stack spacing={1}>
              <Typography>Total Approved Budget: {Number(financialRollup.totalApprovedBudget ?? 0).toLocaleString()}</Typography>
              <Typography>Total Forecast EAC: {Number(financialRollup.totalForecastEac ?? 0).toLocaleString()}</Typography>
              <Typography>Total Actual Cost: {Number(financialRollup.totalActualCost ?? 0).toLocaleString()}</Typography>
              <Typography>Cost Variance: {Number(financialRollup.costVariance ?? 0).toLocaleString()}</Typography>
              <Typography>RAG Status: {financialRollup.ragStatus ?? "-"}</Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">No financial roll-up returned for current filters.</Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Risk & Issue Roll-up (Backend)</Typography>
          <Divider sx={{ my: 1.5 }} />
          {ricRollup ? (
            <Stack spacing={1}>
              <Typography>Risk Exposure Total: {Number(ricRollup.riskExposureTotal ?? 0).toLocaleString()}</Typography>
              <Typography>Issue Weighted Total: {Number(ricRollup.issueWeightedTotal ?? 0).toLocaleString()}</Typography>
              <Typography>Critical / High / Medium / Low: {ricRollup.criticalCount} / {ricRollup.highCount} / {ricRollup.mediumCount} / {ricRollup.lowCount}</Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">No risk roll-up returned for current filters.</Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};
