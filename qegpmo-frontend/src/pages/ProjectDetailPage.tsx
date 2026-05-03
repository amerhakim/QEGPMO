import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { ProjectFormDialog } from "../components/ProjectFormDialog";
import { RagChip } from "../components/RagChip";
import type { ProjectDetail } from "../types";
import { usePermission } from "../hooks/usePermission";

export const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const canUpdate = usePermission("project.update");
  const canSubmitWorkflow = usePermission("project.workflow.submit");
  const canApproveWorkflow = usePermission("project.workflow.approve");
  const canRejectWorkflow = usePermission("project.workflow.reject");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ProjectDetail>(endpoints.projectById(projectId));
      setDetail(data);
    } catch {
      setError("Unable to load project detail.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const history = useMemo(
    () =>
      (detail?.statusHistory ?? []).map((h) => ({
        period: h.period,
        progress: h.progressPercent
      })),
    [detail]
  );

  const executeWorkflowAction = async (action: "submit" | "approve" | "reject") => {
    if (!projectId) return;
    setWorkflowError(null);
    try {
      const endpoint =
        action === "submit"
          ? endpoints.projectWorkflowSubmit(projectId)
          : action === "approve"
            ? endpoints.projectWorkflowApprove(projectId)
            : endpoints.projectWorkflowReject(projectId);
      await apiClient.post(endpoint);
      await load();
    } catch {
      setWorkflowError(`Unable to ${action} workflow action.`);
    }
  };

  if (loading) return <LoadingState message="Loading project detail..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <ErrorState message="Project not found." onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between">
        <Typography variant="h4" fontWeight={700}>
          {detail.project.name}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant={canUpdate ? "contained" : "outlined"} disabled={!canUpdate} onClick={() => setEditOpen(true)}>
            {canUpdate ? "Edit Project" : "Read-only"}
          </Button>
          {canSubmitWorkflow && detail.workflowState?.canSubmit ? (
            <Button variant="outlined" onClick={() => executeWorkflowAction("submit")}>
              Submit
            </Button>
          ) : null}
          {canApproveWorkflow && detail.workflowState?.canApprove ? (
            <Button color="success" variant="outlined" onClick={() => executeWorkflowAction("approve")}>
              Approve
            </Button>
          ) : null}
          {canRejectWorkflow && detail.workflowState?.canReject ? (
            <Button color="error" variant="outlined" onClick={() => executeWorkflowAction("reject")}>
              Reject
            </Button>
          ) : null}
        </Stack>
      </Stack>
      {workflowError ? <Alert severity="error">{workflowError}</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Schedule Summary</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="body2" color="text.secondary">
                Executive read-only schedule snapshot from backend.
              </Typography>
              <Typography>Progress: {detail.project.progressPercent}%</Typography>
              <Typography>Baseline Start: {detail.project.baselineStart ?? "-"}</Typography>
              <Typography>Baseline End: {detail.project.baselineEnd ?? "-"}</Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <RagChip value={detail.project.scheduleStatus} />
                <RagChip value={detail.project.overallHealth} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Financial Summary</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="body2" color="text.secondary">
                Variance values are backend-calculated and rendered without UI recomputation.
              </Typography>
              <Typography>Planned: {detail.project.plannedBudget.toLocaleString()}</Typography>
              <Typography>Forecast: {(detail.project.forecastCost ?? 0).toLocaleString()}</Typography>
              <Typography>Actual: {detail.project.actualCost.toLocaleString()}</Typography>
              <Typography>Variance: {(detail.project.varianceAmount ?? 0).toLocaleString()}</Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <RagChip value={detail.project.costStatus} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Risks & Issues</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography>Risks (Critical): {detail.project.riskBySeverity.CRITICAL ?? 0}</Typography>
              <Typography>Risks (High): {detail.project.riskBySeverity.HIGH ?? 0}</Typography>
              <Typography>Issues (Critical): {detail.project.issueBySeverity.CRITICAL ?? 0}</Typography>
              <Typography>Issues (High): {detail.project.issueBySeverity.HIGH ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6">Workflow Approval State</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <Chip label={`State: ${detail.workflowState?.currentState ?? "N/A"}`} />
            <Chip label={`Can Submit: ${detail.workflowState?.canSubmit ? "Yes" : "No"}`} />
            <Chip label={`Can Approve: ${detail.workflowState?.canApprove ? "Yes" : "No"}`} />
            <Chip label={`Can Reject: ${detail.workflowState?.canReject ? "Yes" : "No"}`} />
          </Stack>
          <Typography sx={{ mt: 1 }}>
            Pending Approvers: {(detail.workflowState?.pendingApprovers ?? []).join(", ") || "None"}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Status History
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <XAxis dataKey="period" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line dataKey="progress" stroke="#0b4f8a" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Phase & Gate Status
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Phase</TableCell>
                <TableCell>Gate</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Decided</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(detail.phaseGates ?? []).map((gate) => (
                <TableRow key={`${gate.gateCode}-${gate.phaseName}`}>
                  <TableCell>{gate.phaseName}</TableCell>
                  <TableCell>{gate.gateName}</TableCell>
                  <TableCell>{gate.status}</TableCell>
                  <TableCell>{gate.dueAt ?? "-"}</TableCell>
                  <TableCell>{gate.decidedAt ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ProjectFormDialog
        open={editOpen}
        mode="edit"
        initialProject={detail.project}
        onClose={() => setEditOpen(false)}
        onSaved={load}
      />
    </Stack>
  );
};
