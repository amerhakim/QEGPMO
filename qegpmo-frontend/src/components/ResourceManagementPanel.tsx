import { Alert, Box, Button, Card, CardContent, Chip, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ResourceDetailDialog } from "./ResourceDetailDialog";
import type { ResourceDetail, ResourceSummary } from "../types";

interface ResourceManagementPanelProps {
  canRead: boolean;
  canEdit: boolean;
  canWorkflowSubmit: boolean;
  canWorkflowApprove: boolean;
  canWorkflowReject: boolean;
}

export const ResourceManagementPanel = ({
  canRead,
  canEdit,
  canWorkflowSubmit,
  canWorkflowApprove,
  canWorkflowReject
}: ResourceManagementPanelProps) => {
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [skillFilter, setSkillFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "AVAILABLE" | "LIMITED" | "UNAVAILABLE">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ResourceDetail | null>(null);

  const loadResources = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ResourceSummary[]>(endpoints.resources);
      setResources(data);
    } catch {
      setError("Unable to load resource pool.");
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const filtered = useMemo(
    () =>
      resources.filter((item) => {
        const bySkill = skillFilter ? item.skillTags.some((s) => s.toLowerCase().includes(skillFilter.toLowerCase())) : true;
        const byRole = roleFilter ? (item.roleName ?? "").toLowerCase().includes(roleFilter.toLowerCase()) : true;
        const byAvailability = availabilityFilter === "ALL" ? true : item.availabilityStatus === availabilityFilter;
        return bySkill && byRole && byAvailability;
      }),
    [resources, skillFilter, roleFilter, availabilityFilter]
  );

  const openDetail = async (resourceId: string) => {
    setWorkflowError(null);
    try {
      const { data } = await apiClient.get<ResourceDetail>(endpoints.resourceById(resourceId));
      setSelectedDetail(data);
      setDetailOpen(true);
    } catch {
      setError("Unable to load resource detail.");
    }
  };

  const workflowAction = async (action: "submit" | "approve" | "reject") => {
    if (!selectedDetail) return;
    setWorkflowError(null);
    try {
      const endpoint =
        action === "submit"
          ? endpoints.resourceWorkflowSubmit(selectedDetail.resourceId)
          : action === "approve"
            ? endpoints.resourceWorkflowApprove(selectedDetail.resourceId)
            : endpoints.resourceWorkflowReject(selectedDetail.resourceId);
      await apiClient.post(endpoint);
      await openDetail(selectedDetail.resourceId);
      await loadResources();
    } catch {
      setWorkflowError(`Unable to ${action} resource allocation workflow.`);
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view Resource Management.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={700}>
            Resource Management
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="Filter by skill" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
            <TextField label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />
            <TextField
              select
              label="Availability"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="AVAILABLE">Available</MenuItem>
              <MenuItem value="LIMITED">Limited</MenuItem>
              <MenuItem value="UNAVAILABLE">Unavailable</MenuItem>
            </TextField>
            <Button onClick={loadResources} variant="outlined">
              Refresh
            </Button>
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? <LinearProgress /> : null}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Skills</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell>Capacity</TableCell>
                <TableCell>Allocated</TableCell>
                <TableCell>Utilization</TableCell>
                <TableCell>Over-allocation</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.resourceId} hover>
                  <TableCell>{item.fullName}</TableCell>
                  <TableCell>{item.resourceType}</TableCell>
                  <TableCell>{item.roleName ?? "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {item.skillTags.slice(0, 3).map((tag) => (
                        <Chip key={`${item.resourceId}-${tag}`} label={tag} size="small" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{item.availabilityStatus ?? "-"}</TableCell>
                  <TableCell>{item.capacityHours ?? 0}</TableCell>
                  <TableCell>{item.allocatedHours ?? 0}</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Box>
                      <Typography variant="body2">{item.utilizationPercent ?? 0}%</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(item.utilizationPercent ?? 0, 100)}
                        color={item.overAllocated ? "error" : "primary"}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>{item.overAllocated ? <Chip color="error" label="Over-allocated" size="small" /> : "-"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => openDetail(item.resourceId)}>
                      {canEdit ? "View / Edit" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" color="text.secondary">
            Over-allocation and utilization are backend-provided indicators. UI only visualizes them.
          </Typography>
        </Stack>
      </CardContent>
      <ResourceDetailDialog
        open={detailOpen}
        resource={selectedDetail}
        canEdit={canEdit}
        canSubmit={canWorkflowSubmit}
        canApprove={canWorkflowApprove}
        canReject={canWorkflowReject}
        workflowError={workflowError}
        onClose={() => setDetailOpen(false)}
        onSubmit={() => workflowAction("submit")}
        onApprove={() => workflowAction("approve")}
        onReject={() => workflowAction("reject")}
      />
    </Card>
  );
};
