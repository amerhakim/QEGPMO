import { Dialog, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import type { MilestoneSummary } from "../types";

interface MilestoneDetailDialogProps {
  open: boolean;
  milestone: MilestoneSummary | null;
  onClose: () => void;
}

export const MilestoneDetailDialog = ({ open, milestone, onClose }: MilestoneDetailDialogProps) => {
  if (!milestone) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Milestone Detail - {milestone.code} {milestone.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography>Status: {milestone.status}</Typography>
          <Divider />
          <Typography>Baseline Date: {milestone.baselineDate ?? "-"}</Typography>
          <Typography>Forecast Date: {milestone.forecastDate ?? "-"}</Typography>
          <Typography>Actual Date: {milestone.actualDate ?? "-"}</Typography>
          <Typography>Critical: {milestone.criticalFlag ? "Yes" : "No"}</Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
