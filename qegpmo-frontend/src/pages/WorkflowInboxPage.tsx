import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chip,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Typography
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import type { WorkflowApprovalItem } from "../types";

const slaChip = (startedAt: string, slaMinutes?: number) => {
  if (!slaMinutes) return <Chip size="small" label="SLA N/A" />;
  const elapsedMinutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (elapsedMinutes >= slaMinutes) return <Chip size="small" color="error" label={`Overdue ${elapsedMinutes - slaMinutes}m`} />;
  const remaining = slaMinutes - elapsedMinutes;
  return <Chip size="small" color={remaining <= 60 ? "warning" : "success"} label={`Due in ${remaining}m`} />;
};

export const WorkflowInboxPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [pending, setPending] = useState<WorkflowApprovalItem[]>([]);
  const [history, setHistory] = useState<WorkflowApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        apiClient.get<WorkflowApprovalItem[]>(endpoints.workflowInboxPending),
        apiClient.get<WorkflowApprovalItem[]>(endpoints.workflowInboxHistory)
      ]);
      setPending(pendingRes.data ?? []);
      setHistory(historyRes.data ?? []);
    } catch {
      setError("Unable to load workflow inbox.");
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeItems = tab === 0 ? pending : history;
  const paged = useMemo(
    () => activeItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [activeItems, page, rowsPerPage]
  );

  if (loading) return <LoadingState message="Loading workflow inbox..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Workflow & Approvals Inbox
      </Typography>
      <Tabs value={tab} onChange={(_, value) => { setTab(value); setPage(0); }}>
        <Tab label={`Pending (${pending.length})`} />
        <Tab label={`History (${history.length})`} />
      </Tabs>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Workflow</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Step</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>SLA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((item) => (
              <TableRow
                key={item.instanceId}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/approvals/${item.instanceId}`)}
              >
                <TableCell>{item.workflowName}</TableCell>
                <TableCell>{item.entityType} / {item.entityId}</TableCell>
                <TableCell>{item.currentStepName}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>{slaChip(item.stepStartedAt, item.slaMinutes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={activeItems.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </Stack>
  );
};
