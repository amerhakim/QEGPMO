import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { ProjectFormDialog } from "../components/ProjectFormDialog";
import { RagChip } from "../components/RagChip";
import type { ProjectSummary, RagStatus } from "../types";
import { usePermission } from "../hooks/usePermission";

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const canCreate = usePermission("project.create");
  const canUpdate = usePermission("project.update");
  const [items, setItems] = useState<ProjectSummary[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [overallFilter, setOverallFilter] = useState<"ALL" | RagStatus>("ALL");
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ProjectSummary[]>(endpoints.projects);
      setItems(data);
    } catch {
      setError("Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchText =
          i.name.toLowerCase().includes(nameFilter.toLowerCase()) || i.projectCode.toLowerCase().includes(nameFilter.toLowerCase());
        const matchOverall = overallFilter === "ALL" ? true : i.overallHealth === overallFilter;
        return matchText && matchOverall;
      }),
    [items, nameFilter, overallFilter]
  );

  if (loading) return <LoadingState message="Loading projects..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Project & Delivery
      </Typography>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2}>
            <TextField
              label="Filter by project name or code"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              sx={{ minWidth: 320 }}
            />
            <TextField
              select
              label="Overall Status"
              value={overallFilter}
              onChange={(e) => setOverallFilter(e.target.value as typeof overallFilter)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="GREEN">Green</MenuItem>
              <MenuItem value="AMBER">Amber</MenuItem>
              <MenuItem value="RED">Red</MenuItem>
              <MenuItem value="UNKNOWN">Unknown</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={load}>
              Refresh
            </Button>
            {canCreate ? (
              <Button variant="contained" onClick={() => setCreateOpen(true)}>
                Create Project
              </Button>
            ) : null}
            {!canUpdate ? (
              <Typography color="text.secondary" sx={{ alignSelf: "center" }}>
                Read-only mode by RBAC policy.
              </Typography>
            ) : null}
          </Stack>
          <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Portfolio</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Cost</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>Actual</TableCell>
                  <TableCell>Overall</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.projectId}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/projects/${row.projectId}`)}
                  >
                    <TableCell>{row.projectCode}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.portfolioName ?? "-"}</TableCell>
                    <TableCell>{row.programName ?? "-"}</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">{row.progressPercent}%</Typography>
                        <LinearProgress variant="determinate" value={row.progressPercent} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <RagChip value={row.scheduleStatus} />
                    </TableCell>
                    <TableCell>
                      <RagChip value={row.costStatus} />
                    </TableCell>
                    <TableCell>{row.plannedBudget.toLocaleString()}</TableCell>
                    <TableCell>{row.actualCost.toLocaleString()}</TableCell>
                    <TableCell>
                      <RagChip value={row.overallHealth} />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/projects/${row.projectId}`);
                          }}
                        >
                          View
                        </Button>
                        {canUpdate ? (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedProject(row);
                              setEditOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ProjectFormDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
      <ProjectFormDialog
        open={editOpen}
        mode="edit"
        initialProject={selectedProject}
        onClose={() => {
          setEditOpen(false);
          setSelectedProject(undefined);
        }}
        onSaved={load}
      />
    </Stack>
  );
};
