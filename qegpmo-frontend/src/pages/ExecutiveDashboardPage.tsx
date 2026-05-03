import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { KpiComparisonTable } from "../components/KpiComparisonTable";
import { LoadingState } from "../components/LoadingState";
import { RagChip } from "../components/RagChip";
import { ragColors } from "../theme";
import type { DashboardResponse, RagStatus } from "../types";
import { usePermission } from "../hooks/usePermission";

const ragToScore = (value: RagStatus) => (value === "GREEN" ? 3 : value === "AMBER" ? 2 : value === "RED" ? 1 : 0);

const downloadBlob = (data: BlobPart, fileName: string, mime: string) => {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export const ExecutiveDashboardPage = () => {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [scope, setScope] = useState<"ENTERPRISE" | "PORTFOLIO" | "PROGRAM">("ENTERPRISE");
  const [scopeId, setScopeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canExport = usePermission("export.dashboard");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await apiClient.get<DashboardResponse>(endpoints.dashboard, {
        params: { scope, scopeId: scopeId || undefined }
      });
      setDashboard(data);
    } catch {
      setError("Unable to load consolidated dashboard from backend.");
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const projectNames = useMemo(() => (dashboard?.projects ?? []).map((p) => p.name), [dashboard]);
  const ragBars = useMemo(
    () =>
      (dashboard?.projects ?? []).map((p) => ({
        name: p.projectCode,
        value: ragToScore(p.overallHealth),
        color: ragColors[p.overallHealth]
      })),
    [dashboard]
  );

  const onExportDashboard = async () => {
    const { data } = await apiClient.post(
      endpoints.exportDashboard,
      { scope, scopeId: scopeId || null },
      { responseType: "arraybuffer" }
    );
    downloadBlob(data, "dashboard-summary.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  const onExportDrilldown = async () => {
    const { data } = await apiClient.post(
      endpoints.exportDrilldown,
      { scope, scopeId: scopeId || null },
      { responseType: "arraybuffer" }
    );
    downloadBlob(data, "dashboard-drilldown.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  if (loading) return <LoadingState message="Loading enterprise roll-up and project KPIs..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!dashboard) return <ErrorState message="No dashboard data returned by backend." onRetry={load} />;

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" fontWeight={700}>
        Executive Consolidated Dashboard
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField select label="Drill-down Scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <MenuItem value="ENTERPRISE">Enterprise</MenuItem>
          <MenuItem value="PORTFOLIO">Portfolio</MenuItem>
          <MenuItem value="PROGRAM">Program</MenuItem>
        </TextField>
        <TextField label="Scope ID (optional)" value={scopeId} onChange={(e) => setScopeId(e.target.value)} />
        <Button variant="outlined" onClick={load}>
          Refresh
        </Button>
        {canExport ? (
          <>
            <Button variant="contained" onClick={onExportDashboard}>
              Export Dashboard Excel
            </Button>
            <Button variant="contained" color="secondary" onClick={onExportDrilldown}>
              Export Drill-down Excel
            </Button>
          </>
        ) : null}
      </Stack>

      <Grid container spacing={2}>
        {(dashboard.rollups ?? []).map((r) => (
          <Grid item xs={12} md={4} key={`${r.level}-${r.levelEntityId}`}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {r.level}
                  </Typography>
                  <Typography variant="h6">{r.levelEntityName}</Typography>
                  <Typography>Progress: {r.progressPercent}%</Typography>
                  <Stack direction="row" spacing={1}>
                    <RagChip value={r.scheduleStatus} />
                    <RagChip value={r.costStatus} />
                    <RagChip value={r.overallHealth} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Project KPI Comparison (Columns = Projects)
          </Typography>
          <KpiComparisonTable projectNames={projectNames} rows={dashboard.kpiRows} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Overall Health by Project
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ragBars}>
              <XAxis dataKey="name" />
              <YAxis domain={[0, 3]} tickFormatter={(v) => ["Unknown", "Red", "Amber", "Green"][v] ?? ""} />
              <Tooltip />
              <Bar dataKey="value">
                {ragBars.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Stack>
  );
};
