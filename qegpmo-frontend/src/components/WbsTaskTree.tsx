import { KeyboardArrowDown, KeyboardArrowRight } from "@mui/icons-material";
import { Box, IconButton, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { RagChip } from "./RagChip";
import type { TaskSummary } from "../types";

interface WbsTaskTreeProps {
  tasks: TaskSummary[];
  canEdit: boolean;
  onOpenTask: (task: TaskSummary) => void;
}

const buildTree = (items: TaskSummary[]) => {
  const byParent = new Map<string, TaskSummary[]>();
  const roots: TaskSummary[] = [];
  items.forEach((task) => {
    if (task.parentTaskId) {
      const list = byParent.get(task.parentTaskId) ?? [];
      list.push(task);
      byParent.set(task.parentTaskId, list);
    } else {
      roots.push(task);
    }
  });
  const attach = (node: TaskSummary): TaskSummary => ({
    ...node,
    children: (byParent.get(node.taskId) ?? []).map(attach)
  });
  return roots.map(attach);
};

export const WbsTaskTree = ({ tasks, canEdit, onOpenTask }: WbsTaskTreeProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => buildTree(tasks), [tasks]);

  const toggle = (taskId: string) => {
    setExpanded((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const renderRows = (nodes: TaskSummary[], depth: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    nodes.forEach((task) => {
      const hasChildren = Boolean(task.children?.length);
      const isExpanded = expanded[task.taskId] ?? true;
      out.push(
        <TableRow key={task.taskId} hover onClick={() => onOpenTask(task)} sx={{ cursor: "pointer" }}>
          <TableCell>
            <Box sx={{ pl: depth * 2, display: "flex", alignItems: "center", gap: 0.5 }}>
              {hasChildren ? (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggle(task.taskId); }}>
                  {isExpanded ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
                </IconButton>
              ) : (
                <Box sx={{ width: 32 }} />
              )}
              <Typography fontWeight={task.taskType === "MILESTONE" ? 700 : 500}>
                {task.wbsCode} {task.name}
              </Typography>
            </Box>
          </TableCell>
          <TableCell>{task.taskType}</TableCell>
          <TableCell>{task.status}</TableCell>
          <TableCell>
            <Box sx={{ minWidth: 120 }}>
              <Typography variant="body2">{task.actualProgressPercent ?? 0}%</Typography>
              <LinearProgress variant="determinate" value={task.actualProgressPercent ?? 0} />
            </Box>
          </TableCell>
          <TableCell>{task.plannedStart ?? "-"} / {task.plannedFinish ?? "-"}</TableCell>
          <TableCell>{task.actualStart ?? "-"} / {task.actualFinish ?? "-"}</TableCell>
          <TableCell>{task.scheduleIndicator ? <RagChip value={task.scheduleIndicator} /> : "-"}</TableCell>
          <TableCell>{task.costIndicator ? <RagChip value={task.costIndicator} /> : "-"}</TableCell>
          <TableCell align="right">{canEdit ? "Editable" : "Read-only"}</TableCell>
        </TableRow>
      );
      if (hasChildren && isExpanded) {
        out.push(...renderRows(task.children ?? [], depth + 1));
      }
    });
    return out;
  };

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>WBS Task</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Actual Progress</TableCell>
          <TableCell>Planned Dates</TableCell>
          <TableCell>Actual Dates</TableCell>
          <TableCell>Schedule</TableCell>
          <TableCell>Cost</TableCell>
          <TableCell align="right">Access</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>{renderRows(tree, 0)}</TableBody>
    </Table>
  );
};
