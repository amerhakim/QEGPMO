import { Dialog, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TaskDetail } from "../types";

interface TaskDetailDialogProps {
  open: boolean;
  task: TaskDetail | null;
  onClose: () => void;
  readOnly: boolean;
}

export const TaskDetailDialog = ({ open, task, onClose, readOnly }: TaskDetailDialogProps) => {
  if (!task) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {task.taskType === "MILESTONE" ? "Milestone" : "Task"} Detail - {task.wbsCode} {task.name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography color="text.secondary">{readOnly ? "Read-only by RBAC policy." : "Editable by permission."}</Typography>
          <Divider />
          <Typography>Status: {task.status}</Typography>
          <Typography>Planned: {task.plannedStart ?? "-"} to {task.plannedFinish ?? "-"}</Typography>
          <Typography>Actual: {task.actualStart ?? "-"} to {task.actualFinish ?? "-"}</Typography>
          <Typography>Baseline: {task.baselineStart ?? "-"} to {task.baselineFinish ?? "-"}</Typography>
          <Typography>Updated Baseline: {task.updatedBaselineStart ?? "-"} to {task.updatedBaselineFinish ?? "-"}</Typography>
          <Typography>Planned Progress: {task.plannedProgressPercent ?? 0}%</Typography>
          <Typography>Actual Progress: {task.actualProgressPercent ?? 0}%</Typography>
          {task.progressTrend?.length ? (
            <>
              <Divider />
              <Typography variant="h6">Progress Trend (Backend Values)</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={task.progressTrend}>
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line dataKey="plannedProgressPercent" stroke="#757575" strokeWidth={2} />
                  <Line dataKey="actualProgressPercent" stroke="#0b4f8a" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
