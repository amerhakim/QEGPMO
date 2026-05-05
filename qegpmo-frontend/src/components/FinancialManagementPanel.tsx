import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { RagChip } from "./RagChip";
import type { BudgetCategory, FinancialActualCost, FinancialBudget, FinancialForecast, FinancialSummaryRow } from "../types";

interface ProjectLookupItem {
  projectId: string;
  projectCode: string;
  name: string;
}

interface FinancialManagementPanelProps {
  projects: ProjectLookupItem[];
  canRead: boolean;
  canCreateBudget: boolean;
  canCreateForecast: boolean;
  canCreateActual: boolean;
}

interface FinancialExportResponse<T> {
  jobId: string;
  rows: T[];
}

const toPeriod = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const recentPeriods = (count: number, anchor: string) => {
  const [year, month] = anchor.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const periods: string[] = [];
  for (let i = 0; i < count; i += 1) {
    periods.push(toPeriod(date));
    date.setMonth(date.getMonth() - 1);
  }
  return periods.reverse();
};

const asNumber = (value: unknown) => Number(value ?? 0);

export const FinancialManagementPanel = ({
  projects,
  canRead,
  canCreateBudget,
  canCreateForecast,
  canCreateActual
}: FinancialManagementPanelProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState(toPeriod(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.projectId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<FinancialBudget[]>([]);
  const [forecasts, setForecasts] = useState<FinancialForecast[]>([]);
  const [actuals, setActuals] = useState<FinancialActualCost[]>([]);
  const [history, setHistory] = useState<FinancialSummaryRow[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<FinancialBudget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [newBudget, setNewBudget] = useState({ category: "CAPEX" as BudgetCategory, plannedAmount: "", approvedAmount: "" });
  const [newForecast, setNewForecast] = useState({ budgetId: "", estimateToComplete: "", estimateAtCompletion: "", notes: "" });
  const [newActual, setNewActual] = useState({ budgetId: "", postingDate: "", amount: "", sourceReference: "" });

  const currentProject = useMemo(() => projects.find((p) => p.projectId === selectedProjectId), [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId && projects.length) {
      setSelectedProjectId(projects[0].projectId);
    }
  }, [projects, selectedProjectId]);

  const fetchExport = useCallback(
    async <T,>(entityName: "BUDGET" | "FORECAST" | "ACTUAL_COST" | "SUMMARY", exportPeriod: string) => {
      if (!user?.tenantId) throw new Error("Missing tenant context.");
      const { data } = await apiClient.post<FinancialExportResponse<T>>(endpoints.financialExcelExport, {
        tenantId: user.tenantId,
        entityName,
        period: exportPeriod
      });
      return data.rows;
    },
    [user?.tenantId]
  );

  const load = useCallback(async () => {
    if (!canRead || !selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const [budgetRows, forecastRows, actualRows] = await Promise.all([
        fetchExport<FinancialBudget>("BUDGET", period),
        fetchExport<FinancialForecast>("FORECAST", period),
        fetchExport<FinancialActualCost>("ACTUAL_COST", period)
      ]);
      const projectBudgets = budgetRows.filter((b) => b.objectType === "PROJECT" && b.objectId === selectedProjectId);
      const budgetIds = new Set(projectBudgets.map((b) => b.id));
      setBudgets(projectBudgets);
      setForecasts(forecastRows.filter((f) => budgetIds.has(f.budgetId)));
      setActuals(actualRows.filter((a) => budgetIds.has(a.budgetId)));

      const periods = recentPeriods(6, period);
      const summaryRows = await Promise.all(periods.map((p) => fetchExport<FinancialSummaryRow>("SUMMARY", p)));
      const merged = summaryRows
        .flat()
        .filter((s) => s.objectType === "PROJECT" && s.objectId === selectedProjectId)
        .sort((a, b) => a.period.localeCompare(b.period));
      setHistory(merged);
    } catch {
      setError("Unable to load financial data.");
    } finally {
      setLoading(false);
    }
  }, [canRead, fetchExport, period, selectedProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = history[history.length - 1];
  const chartData = history.map((h) => ({
    period: h.period,
    approved: asNumber(h.totalApprovedBudget),
    forecastEac: asNumber(h.totalForecastEac),
    actual: asNumber(h.totalActualCost)
  }));

  const createBudget = async () => {
    if (!user?.tenantId || !selectedProjectId) return;
    await apiClient.post(endpoints.financialBudgets, {
      tenantId: user.tenantId,
      objectType: "PROJECT",
      objectId: selectedProjectId,
      fiscalPeriod: period,
      category: newBudget.category,
      plannedAmount: Number(newBudget.plannedAmount),
      approvedAmount: Number(newBudget.approvedAmount)
    });
    setNewBudget({ category: "CAPEX", plannedAmount: "", approvedAmount: "" });
    await load();
  };

  const createForecast = async () => {
    if (!user?.tenantId || !newForecast.budgetId) return;
    await apiClient.post(endpoints.financialForecasts(newForecast.budgetId), {
      tenantId: user.tenantId,
      forecastPeriod: period,
      estimateToComplete: Number(newForecast.estimateToComplete),
      estimateAtCompletion: newForecast.estimateAtCompletion ? Number(newForecast.estimateAtCompletion) : undefined,
      notes: newForecast.notes || undefined
    });
    setNewForecast({ budgetId: "", estimateToComplete: "", estimateAtCompletion: "", notes: "" });
    await load();
  };

  const createActual = async () => {
    if (!user?.tenantId || !newActual.budgetId || !newActual.postingDate) return;
    await apiClient.post(endpoints.financialActualCosts(newActual.budgetId), {
      tenantId: user.tenantId,
      postingPeriod: period,
      postingDate: newActual.postingDate,
      amount: Number(newActual.amount),
      sourceReference: newActual.sourceReference || undefined
    });
    setNewActual({ budgetId: "", postingDate: "", amount: "", sourceReference: "" });
    await load();
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view Financial Management.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={700}>
            Financial Management
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField select label="Project" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} sx={{ minWidth: 300 }}>
              {projects.map((project) => (
                <MenuItem key={project.projectId} value={project.projectId}>
                  {project.projectCode} - {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Period (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ maxWidth: 200 }} />
            <Button variant="outlined" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {currentProject ? (
            <Typography color="text.secondary">
              Scope: PROJECT ({currentProject.projectCode}) - values shown are backend-calculated and tenant-scoped.
            </Typography>
          ) : null}
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Approved Budget
                  </Typography>
                  <Typography variant="h6">{asNumber(summary?.totalApprovedBudget).toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Forecast EAC
                  </Typography>
                  <Typography variant="h6">{asNumber(summary?.totalForecastEac).toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Actual Cost
                  </Typography>
                  <Typography variant="h6">{asNumber(summary?.totalActualCost).toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Variance
                  </Typography>
                  <Typography variant="h6">{asNumber(summary?.costVariance).toLocaleString()}</Typography>
                  <Stack direction="row" spacing={1} mt={1}>
                    <RagChip value={(summary?.ragStatus as "GREEN" | "AMBER" | "RED" | undefined) ?? "UNKNOWN"} />
                    <Chip label={`${asNumber(summary?.costVariancePercent)}%`} size="small" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Historical Snapshots
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="approved" stroke="#0b4f8a" strokeWidth={2} />
                  <Line dataKey="forecastEac" stroke="#d97706" strokeWidth={2} />
                  <Line dataKey="actual" stroke="#047857" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="Budgets" />
            <Tab label="Forecasts" />
            <Tab label="Actual Costs" />
          </Tabs>
          <Divider />

          {tab === 0 ? (
            <Stack spacing={2}>
              {canCreateBudget ? (
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <TextField
                    select
                    label="Category"
                    value={newBudget.category}
                    onChange={(e) => setNewBudget((prev) => ({ ...prev, category: e.target.value as BudgetCategory }))}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="CAPEX">CAPEX</MenuItem>
                    <MenuItem value="OPEX">OPEX</MenuItem>
                  </TextField>
                  <TextField label="Planned Amount" type="number" value={newBudget.plannedAmount} onChange={(e) => setNewBudget((prev) => ({ ...prev, plannedAmount: e.target.value }))} />
                  <TextField label="Approved Amount" type="number" value={newBudget.approvedAmount} onChange={(e) => setNewBudget((prev) => ({ ...prev, approvedAmount: e.target.value }))} />
                  <Button
                    variant="contained"
                    onClick={createBudget}
                    disabled={!newBudget.plannedAmount || !newBudget.approvedAmount}
                  >
                    Create Budget
                  </Button>
                </Stack>
              ) : (
                <Alert severity="info">Read-only by RBAC. Budget creation is hidden.</Alert>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Planned</TableCell>
                    <TableCell>Approved Baseline</TableCell>
                    <TableCell>Committed</TableCell>
                    <TableCell>Fiscal Period</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {budgets.map((budget) => (
                    <TableRow key={budget.id} hover sx={{ cursor: "pointer" }} onClick={() => { setSelectedBudget(budget); setDetailOpen(true); }}>
                      <TableCell>{budget.category}</TableCell>
                      <TableCell>{asNumber(budget.plannedAmount).toLocaleString()}</TableCell>
                      <TableCell>{asNumber(budget.approvedAmount).toLocaleString()}</TableCell>
                      <TableCell>{asNumber(budget.committedAmount).toLocaleString()}</TableCell>
                      <TableCell>{budget.fiscalPeriod}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ) : null}

          {tab === 1 ? (
            <Stack spacing={2}>
              {canCreateForecast ? (
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <TextField
                    select
                    label="Budget"
                    value={newForecast.budgetId}
                    onChange={(e) => setNewForecast((prev) => ({ ...prev, budgetId: e.target.value }))}
                    sx={{ minWidth: 220 }}
                  >
                    {budgets.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.category} - {asNumber(b.approvedAmount).toLocaleString()}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField label="ETC" type="number" value={newForecast.estimateToComplete} onChange={(e) => setNewForecast((prev) => ({ ...prev, estimateToComplete: e.target.value }))} />
                  <TextField label="EAC (optional)" type="number" value={newForecast.estimateAtCompletion} onChange={(e) => setNewForecast((prev) => ({ ...prev, estimateAtCompletion: e.target.value }))} />
                  <TextField label="Notes" value={newForecast.notes} onChange={(e) => setNewForecast((prev) => ({ ...prev, notes: e.target.value }))} />
                  <Button variant="contained" onClick={createForecast} disabled={!newForecast.budgetId || !newForecast.estimateToComplete}>
                    Create Forecast
                  </Button>
                </Stack>
              ) : (
                <Alert severity="info">Read-only by RBAC. Forecast creation is hidden.</Alert>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Budget</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>ETC</TableCell>
                    <TableCell>EAC</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecasts.map((forecast) => (
                    <TableRow key={forecast.id}>
                      <TableCell>{forecast.budgetId}</TableCell>
                      <TableCell>{forecast.forecastPeriod}</TableCell>
                      <TableCell>{asNumber(forecast.estimateToComplete).toLocaleString()}</TableCell>
                      <TableCell>{asNumber(forecast.estimateAtCompletion).toLocaleString()}</TableCell>
                      <TableCell>{forecast.notes ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ) : null}

          {tab === 2 ? (
            <Stack spacing={2}>
              {canCreateActual ? (
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <TextField
                    select
                    label="Budget"
                    value={newActual.budgetId}
                    onChange={(e) => setNewActual((prev) => ({ ...prev, budgetId: e.target.value }))}
                    sx={{ minWidth: 220 }}
                  >
                    {budgets.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.category} - {asNumber(b.approvedAmount).toLocaleString()}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Posting Date"
                    type="date"
                    value={newActual.postingDate}
                    onChange={(e) => setNewActual((prev) => ({ ...prev, postingDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField label="Amount" type="number" value={newActual.amount} onChange={(e) => setNewActual((prev) => ({ ...prev, amount: e.target.value }))} />
                  <TextField label="Source Ref" value={newActual.sourceReference} onChange={(e) => setNewActual((prev) => ({ ...prev, sourceReference: e.target.value }))} />
                  <Button variant="contained" onClick={createActual} disabled={!newActual.budgetId || !newActual.amount || !newActual.postingDate}>
                    Create Actual
                  </Button>
                </Stack>
              ) : (
                <Alert severity="info">Read-only by RBAC. Actual cost creation is hidden.</Alert>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Budget</TableCell>
                    <TableCell>Posting Period</TableCell>
                    <TableCell>Posting Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {actuals.map((actual) => (
                    <TableRow key={actual.id}>
                      <TableCell>{actual.budgetId}</TableCell>
                      <TableCell>{actual.postingPeriod}</TableCell>
                      <TableCell>{actual.postingDate?.slice(0, 10)}</TableCell>
                      <TableCell>{asNumber(actual.amount).toLocaleString()}</TableCell>
                      <TableCell>{actual.sourceReference ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Budget Detail</DialogTitle>
        <DialogContent>
          {selectedBudget ? (
            <Stack spacing={1.5}>
              <Typography>Category: {selectedBudget.category}</Typography>
              <Typography>Fiscal Period: {selectedBudget.fiscalPeriod}</Typography>
              <Typography>Planned Amount: {asNumber(selectedBudget.plannedAmount).toLocaleString()}</Typography>
              <Typography>Approved Baseline Amount: {asNumber(selectedBudget.approvedAmount).toLocaleString()}</Typography>
              <Divider />
              <Typography variant="subtitle2">Forecast History</Typography>
              {forecasts.filter((f) => f.budgetId === selectedBudget.id).map((f) => (
                <Typography key={f.id}>
                  {f.forecastPeriod}: EAC {asNumber(f.estimateAtCompletion).toLocaleString()} / ETC {asNumber(f.estimateToComplete).toLocaleString()}
                </Typography>
              ))}
              <Divider />
              <Typography variant="subtitle2">Actual Cost History</Typography>
              {actuals.filter((a) => a.budgetId === selectedBudget.id).map((a) => (
                <Typography key={a.id}>
                  {a.postingDate?.slice(0, 10)}: {asNumber(a.amount).toLocaleString()} ({a.sourceReference ?? "N/A"})
                </Typography>
              ))}
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
