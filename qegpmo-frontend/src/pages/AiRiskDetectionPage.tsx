import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import type { AiRiskSuggestion, RicSeverity } from "../types";

const severityColor = (severity: RicSeverity): "error" | "warning" | "info" | "success" => {
  if (severity === "CRITICAL") return "error";
  if (severity === "HIGH") return "warning";
  if (severity === "MEDIUM") return "info";
  return "success";
};

const confidenceColor = (value: number): "error" | "warning" | "success" => {
  if (value >= 0.85) return "success";
  if (value >= 0.6) return "warning";
  return "error";
};

export const AiRiskDetectionPage = () => {
  const [items, setItems] = useState<AiRiskSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = items.find((item) => item.suggestionId === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<AiRiskSuggestion[]>(endpoints.aiRiskSuggestions);
      const rows = data ?? [];
      setItems(rows);
      if (!selectedId && rows.length) {
        setSelectedId(rows[0].suggestionId);
      }
    } catch {
      setError("Unable to load AI risk suggestions.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const trigger = async (action: "approve" | "reject" | "publish") => {
    if (!selected) return;
    setActionError(null);
    try {
      const endpoint =
        action === "approve"
          ? endpoints.aiRiskSuggestionApprove(selected.suggestionId)
          : action === "reject"
            ? endpoints.aiRiskSuggestionReject(selected.suggestionId)
            : endpoints.aiRiskSuggestionPublish(selected.suggestionId);
      await apiClient.post(endpoint);
      await load();
    } catch {
      setActionError(`Unable to ${action} suggestion.`);
    }
  };

  if (loading) return <LoadingState message="Loading AI risk suggestions..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        AI Risk Detection
      </Typography>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}
      <Card>
        <CardContent>
          <Typography variant="h6">Suggested Risks</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.suggestionId}
                  hover
                  selected={item.suggestionId === selectedId}
                  sx={{ cursor: "pointer" }}
                  onClick={() => setSelectedId(item.suggestionId)}
                >
                  <TableCell>{item.title}</TableCell>
                  <TableCell>
                    <Chip size="small" color={severityColor(item.severity)} label={item.severity} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={confidenceColor(item.confidenceScore)} label={`${Math.round(item.confidenceScore * 100)}%`} />
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardContent>
            <Typography variant="h6">Explanation</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1}>
              <Typography>{selected.explanation}</Typography>
              <Typography color="text.secondary">Detected At: {selected.detectedAt}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} mt={2}>
              <Button variant="outlined" color="success" onClick={() => trigger("approve")}>
                Approve
              </Button>
              <Button variant="outlined" color="error" onClick={() => trigger("reject")}>
                Reject
              </Button>
              <Button variant="contained" onClick={() => trigger("publish")}>
                Publish to Risk Register
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
};
