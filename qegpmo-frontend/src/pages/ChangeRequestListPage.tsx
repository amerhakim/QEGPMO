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

export const ChangeRequestListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ChangeRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<RicExportResponse<ChangeRequestRecord>>(endpoints.ricExcelExport, {
        tenantId: user.tenantId,
        entityName: "CHANGE_REQUEST"
      });
      setItems(data.rows ?? []);
    } catch {
      setError("Unable to load change requests.");
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

  if (loading) return <LoadingState message="Loading change requests..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Change Request List
      </Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Object</TableCell>
              <TableCell>Requested By</TableCell>
              <TableCell>Created At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((item) => (
              <TableRow
                key={item.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/changes/${item.id}`)}
              >
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  <Chip size="small" color={statusColor(item.status)} label={item.status} />
                </TableCell>
                <TableCell>{item.objectType} / {item.objectId}</TableCell>
                <TableCell>{item.requestedBy}</TableCell>
                <TableCell>{item.createdAt}</TableCell>
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
