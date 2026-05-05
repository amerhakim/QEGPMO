import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { usePermission } from "../hooks/usePermission";
import type { RicSeverity, RicStatus, RiskRecord } from "../types";

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

export const RiskDetailPage = () => {
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canUpdate = usePermission("ric.risk.update");
  const [item, setItem] = useState<RiskRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.tenantId || !riskId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<RicExportResponse<RiskRecord>>(endpoints.ricExcelExport, {
        tenantId: user.tenantId,
        entityName: "RISK"
      });
      const found = (data.rows ?? []).find((r) => r.id === riskId) ?? null;
      setItem(found);
    } catch {
      setError("Unable to load risk detail.");
    } finally {
      setLoading(false);
    }
  }, [riskId, user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const escalateFlag = useMemo(() => item?.status === "ESCALATED", [item?.status]);

  const updateStatus = async (status: RicStatus) => {
    if (!item || !user?.tenantId) return;
    setActionError(null);
    try {
      await apiClient.post(endpoints.ricRiskStatus(item.id), {
        tenantId: user.tenantId,
        status
      });
      await load();
    } catch {
      setActionError("Unable to trigger workflow action.");
    }
  };

  if (loading) return <LoadingState message="Loading risk detail..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!item) return <ErrorState message="Risk not found." onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Button variant="text" onClick={() => navigate("/risks")} sx={{ alignSelf: "flex-start" }}>
        Back to Risk Register
      </Button>
      <Typography variant="h4" fontWeight={700}>
        Risk Detail
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
            <Typography>Category: {item.category ?? "-"}</Typography>
            <Typography>Description: {item.description ?? "-"}</Typography>
            <Typography>Created At: {item.createdAt}</Typography>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Indicators</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <Chip size="small" color={severityColor(item.severity)} label={`Severity: ${item.severity}`} />
            <Chip size="small" label={`Aging: ${agingDays(item.createdAt)} days`} />
            <Chip size="small" label={`Escalated: ${escalateFlag ? "Yes" : "No"}`} />
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
            <Button variant="outlined" color="success" disabled={!canUpdate} onClick={() => updateStatus("MITIGATED")}>
              Mark Mitigated
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
