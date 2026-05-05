import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { usePermission } from "../hooks/usePermission";
import type { ChangeRequestRecord, RicStatus } from "../types";

interface RicExportResponse<T> {
  rows: T[];
}

const statusColor = (status: RicStatus): "default" | "warning" | "success" | "error" => {
  if (status === "OPEN") return "default";
  if (status === "IN_PROGRESS") return "warning";
  if (status === "CLOSED" || status === "MITIGATED") return "success";
  return "error";
};

export const ChangeDetailPage = () => {
  const { changeId } = useParams<{ changeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWorkflowAction = usePermission("workflow.instance.action");
  const [item, setItem] = useState<ChangeRequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.tenantId || !changeId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<RicExportResponse<ChangeRequestRecord>>(endpoints.ricExcelExport, {
        tenantId: user.tenantId,
        entityName: "CHANGE_REQUEST"
      });
      setItem((data.rows ?? []).find((r) => r.id === changeId) ?? null);
    } catch {
      setError("Unable to load change detail.");
    } finally {
      setLoading(false);
    }
  }, [changeId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyWorkflowAction = async (decision: "APPROVE" | "REJECT") => {
    if (!item?.workflowInstanceId || !user?.tenantId) return;
    setActionError(null);
    try {
      await apiClient.post(endpoints.workflowInstanceAction(item.workflowInstanceId), {
        tenantId: user.tenantId,
        decision
      });
      await load();
    } catch {
      setActionError("Unable to apply workflow action.");
    }
  };

  const timeline = useMemo(() => {
    if (!item) return [];
    const points = [
      { at: item.createdAt, label: "Created", detail: `Requested by ${item.requestedBy}` },
      { at: item.updatedAt, label: "Last Update", detail: `Status ${item.status}` },
      ...(item.approvedAt ? [{ at: item.approvedAt, label: "Approved", detail: `Approved by ${item.approvedBy ?? "N/A"}` }] : [])
    ];
    return points
      .filter((p) => Boolean(p.at))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [item]);

  if (loading) return <LoadingState message="Loading change detail..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!item) return <ErrorState message="Change request not found." onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Button variant="text" onClick={() => navigate("/changes")} sx={{ alignSelf: "flex-start" }}>
        Back to Change Requests
      </Button>
      <Typography variant="h4" fontWeight={700}>
        Change Details
      </Typography>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}

      <Card>
        <CardContent>
          <Typography variant="h6">{item.title}</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Typography>ID: {item.id}</Typography>
            <Typography>Description: {item.description ?? "-"}</Typography>
            <Typography>Current Status: <Chip size="small" color={statusColor(item.status)} label={item.status} /></Typography>
            <Typography>Requested By: {item.requestedBy}</Typography>
            <Typography>Linked Entity: {item.objectType} / {item.objectId}</Typography>
            <Typography>Workflow Instance: {item.workflowInstanceId ?? "N/A"}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Impact Analysis</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Typography>Scope Impact: {item.scopeImpact}</Typography>
            <Typography>Schedule Impact (Days): {item.scheduleImpactDays}</Typography>
            <Typography>Cost Impact: {item.costImpact}</Typography>
            <Typography>Resource Impact (Hours): {item.resourceImpactHours}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Workflow Approval Actions</Typography>
          <Divider sx={{ my: 1.5 }} />
          {canWorkflowAction && item.workflowInstanceId ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="success" onClick={() => applyWorkflowAction("APPROVE")}>
                Approve
              </Button>
              <Button variant="outlined" color="error" onClick={() => applyWorkflowAction("REJECT")}>
                Reject
              </Button>
            </Stack>
          ) : (
            <Alert severity="info">No workflow action available for this user or record.</Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Status History</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {timeline.map((entry, idx) => (
              <Stack key={`${entry.label}-${entry.at}-${idx}`} direction={{ xs: "column", md: "row" }} spacing={1}>
                <Chip size="small" label={entry.label} />
                <Typography>{entry.at}</Typography>
                <Typography color="text.secondary">{entry.detail}</Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
