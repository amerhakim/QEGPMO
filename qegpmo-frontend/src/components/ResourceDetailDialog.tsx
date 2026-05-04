import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ResourceDetail } from "../types";

interface ResourceDetailDialogProps {
  open: boolean;
  resource: ResourceDetail | null;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  workflowError?: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export const ResourceDetailDialog = ({
  open,
  resource,
  canEdit,
  canSubmit,
  canApprove,
  canReject,
  workflowError,
  onClose,
  onSubmit,
  onApprove,
  onReject
}: ResourceDetailDialogProps) => {
  if (!resource) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Resource Detail - {resource.fullName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            {canEdit ? "Editable by RBAC policy." : "Read-only by RBAC policy (executive insight mode)."}
          </Typography>
          {workflowError ? <Alert severity="error">{workflowError}</Alert> : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <Chip label={`Type: ${resource.resourceType}`} />
            <Chip label={`Role: ${resource.roleName ?? "-"}`} />
            <Chip label={`Availability: ${resource.availabilityStatus ?? "-"}`} />
            <Chip label={`Workflow: ${resource.workflowState?.currentState ?? "N/A"}`} />
          </Stack>
          <Divider />
          <Typography variant="h6">Skills</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {resource.skills.map((skill) => (
              <Chip key={skill.skillId} label={`${skill.skillName}${skill.proficiency ? ` (${skill.proficiency})` : ""}`} />
            ))}
          </Stack>
          <Divider />
          <Typography variant="h6">Capacity vs Allocation Timeline</Typography>
          <Typography variant="body2" color="text.secondary">
            All capacity/allocation values are rendered from backend; no client-side recomputation.
          </Typography>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resource.allocationTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="capacityHours" fill="#90a4ae" name="Capacity Hours" />
              <Bar dataKey="allocatedHours" fill="#0b4f8a" name="Allocated Hours" />
            </BarChart>
          </ResponsiveContainer>
          <Divider />
          <Typography variant="h6">Historical Allocation</Typography>
          <Stack spacing={0.8}>
            {resource.historicalAllocations.map((item) => (
              <Typography key={item.allocationId} variant="body2">
                {item.period} - {item.projectCode} {item.projectName}: {item.allocationPercent ?? 0}% ({item.plannedHours ?? 0}h planned /{" "}
                {item.actualHours ?? 0}h actual)
              </Typography>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        {canSubmit && resource.workflowState?.canSubmit ? <Button onClick={onSubmit}>Submit</Button> : null}
        {canApprove && resource.workflowState?.canApprove ? (
          <Button color="success" onClick={onApprove}>
            Approve
          </Button>
        ) : null}
        {canReject && resource.workflowState?.canReject ? (
          <Button color="error" onClick={onReject}>
            Reject
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
