import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { usePermission } from "../hooks/usePermission";
import type { IssueRecord, RicSeverity, RicStatus } from "../types";

interface RicExportResponse<T> {
  rows: T[];
}

const severityColor = (severity: RicSeverity): "error" | "warning" | "info" | "success" => {
  if (severity === "CRITICAL") return "error";
  if (severity === "HIGH") return "warning";
  if (severity === "MEDIUM") return "info";
  return "success";
};

const agingDays = (dateText?: string) => {
  if (!dateText) return 0;
  const ms = Date.now() - new Date(dateText).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

export const IssueDetailPage = () => {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canUpdate = usePermission("ric.issue.update");
  const [item, setItem] = useState<IssueRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.tenantId || !issueId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<RicExportResponse<IssueRecord>>(endpoints.ricExcelExport, {
        tenantId: user.tenantId,
        entityName: "ISSUE"
      });
      const found = (data.rows ?? []).find((r) => r.id === issueId) ?? null;
      setItem(found);
    } catch {
      setError("Unable to load issue detail.");
    } finally {
      setLoading(false);
    }
  }, [issueId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (status: RicStatus) => {
    if (!item || !user?.tenantId) return;
    setActionError(null);
    try {
      await apiClient.post(endpoints.ricIssueStatus(item.id), {
        tenantId: user.tenantId,
        status
      });
      await load();
    } catch {
      setActionError("Unable to trigger workflow action.");
    }
  };

  if (loading) return <LoadingState message="Loading issue detail..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!item) return <ErrorState message="Issue not found." onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Button variant="text" onClick={() => navigate("/issues")} sx={{ alignSelf: "flex-start" }}>
        Back to Issue Register
      </Button>
      <Typography variant="h4" fontWeight={700}>
        Issue Detail
      </Typography>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}
      <Card>
        <CardContent>
          <Typography variant="h6">{item.title}</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Typography>ID: {item.id}</Typography>
            <Typography>Object: {item.objectType} / {item.objectId}</Typography>
            <Typography>Owner: {item.ownerId}</Typography>
            <Typography>Description: {item.description ?? "-"}</Typography>
            <Typography>Opened At: {item.openedAt}</Typography>
            <Typography>Target Resolution Date: {item.targetResolutionDate ?? "-"}</Typography>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Indicators</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <Chip size="small" color={severityColor(item.severity)} label={`Severity: ${item.severity}`} />
            <Chip size="small" label={`Aging: ${agingDays(item.openedAt)} days`} />
            <Chip size="small" label={`Escalated: ${item.isEscalated ? "Yes" : "No"}`} />
            <Chip size="small" label={`Status: ${item.status}`} />
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Approval Actions</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" disabled={!canUpdate} onClick={() => updateStatus("IN_PROGRESS")}>
              Mark In Progress
            </Button>
            <Button variant="outlined" color="warning" disabled={!canUpdate} onClick={() => updateStatus("ESCALATED")}>
              Escalate
            </Button>
            <Button variant="outlined" color="error" disabled={!canUpdate} onClick={() => updateStatus("CLOSED")}>
              Close
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};
