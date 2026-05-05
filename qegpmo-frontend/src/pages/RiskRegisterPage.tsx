import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import type { RicSeverity, RiskRecord } from "../types";

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

export const RiskRegisterPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<RiskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<RicExportResponse<RiskRecord>>(endpoints.ricExcelExport, {
        tenantId: user.tenantId,
        entityName: "RISK"
      });
      setItems(data.rows ?? []);
    } catch {
      setError("Unable to load risk register.");
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const paged = useMemo(
    () => items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [items, page, rowsPerPage]
  );

  if (loading) return <LoadingState message="Loading risk register..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Risk Register
      </Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Aging (Days)</TableCell>
              <TableCell>Escalated</TableCell>
              <TableCell>Owner</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((risk) => (
              <TableRow
                key={risk.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/risks/${risk.id}`)}
              >
                <TableCell>{risk.title}</TableCell>
                <TableCell>
                  <Chip size="small" color={severityColor(risk.severity)} label={risk.severity} />
                </TableCell>
                <TableCell>{risk.status}</TableCell>
                <TableCell>{agingDays(risk.createdAt)}</TableCell>
                <TableCell>{risk.status === "ESCALATED" ? "Yes" : "No"}</TableCell>
                <TableCell>{risk.ownerId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={items.length}
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
