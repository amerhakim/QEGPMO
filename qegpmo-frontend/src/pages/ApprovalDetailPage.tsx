import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { usePermission } from "../hooks/usePermission";
import type { WorkflowInstanceDetail } from "../types";

const slaChip = (startedAt: string, slaMinutes?: number) => {
  if (!slaMinutes) return <Chip size="small" label="SLA N/A" />;
  const elapsedMinutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (elapsedMinutes >= slaMinutes) return <Chip size="small" color="error" label={`Overdue ${elapsedMinutes - slaMinutes}m`} />;
  const remaining = slaMinutes - elapsedMinutes;
  return <Chip size="small" color={remaining <= 60 ? "warning" : "success"} label={`Due in ${remaining}m`} />;
};

export const ApprovalDetailPage = () => {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAct = usePermission("workflow.instance.action");
  const [detail, setDetail] = useState<WorkflowInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!instanceId || !user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<WorkflowInstanceDetail>(endpoints.workflowInstanceByTenant(instanceId, user.tenantId));
      setDetail(data);
    } catch {
      setError("Unable to load approval detail.");
    } finally {
      setLoading(false);
    }
  }, [instanceId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentStep = useMemo(
    () => detail?.workflowDefinition.steps.find((s) => s.sequence === detail.currentStepSequence),
    [detail]
  );

  const triggerAction = async (decision: "APPROVE" | "REJECT") => {
    if (!detail || !user?.tenantId) return;
    setActionError(null);
    try {
      await apiClient.post(endpoints.workflowInstanceAction(detail.id), {
        tenantId: user.tenantId,
        decision
      });
      await load();
    } catch {
      setActionError("Unable to apply approval action.");
    }
  };

  if (loading) return <LoadingState message="Loading approval detail..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <ErrorState message="Approval not found." onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Button variant="text" onClick={() => navigate("/approvals")} sx={{ alignSelf: "flex-start" }}>
        Back to Inbox
      </Button>
      <Typography variant="h4" fontWeight={700}>
        Approval Details
      </Typography>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}

      <Card>
        <CardContent>
          <Typography variant="h6">{detail.workflowDefinition.name}</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Typography>Instance ID: {detail.id}</Typography>
            <Typography>Entity: {detail.entityType} / {detail.entityId}</Typography>
            <Typography>Status: {detail.status}</Typography>
            <Typography>Current Step: {currentStep?.name ?? "-"}</Typography>
            <Typography>Started By: {detail.startedBy}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">SLA Indicator</Typography>
          <Divider sx={{ my: 1.5 }} />
          {slaChip(detail.stepStartedAt, currentStep?.slaMinutes)}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Workflow Actions</Typography>
          <Divider sx={{ my: 1.5 }} />
          {canAct && detail.status === "IN_PROGRESS" ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="success" onClick={() => triggerAction("APPROVE")}>
                Approve
              </Button>
              <Button variant="outlined" color="error" onClick={() => triggerAction("REJECT")}>
                Reject
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">No actions available for this record.</Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Historical Approvals</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {detail.approvalActions.map((action) => (
              <Stack key={action.id} direction={{ xs: "column", md: "row" }} spacing={1}>
                <Chip size="small" label={action.decision} />
                <Typography>{action.createdAt}</Typography>
                <Typography color="text.secondary">{action.actorId} ({action.actorRole})</Typography>
                {action.comments ? <Typography color="text.secondary">{action.comments}</Typography> : null}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
