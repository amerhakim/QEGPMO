import { Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { DependencyLink } from "../types";

interface DependencyPanelProps {
  dependencies: DependencyLink[];
  selectedTaskId?: string;
}

export const DependencyPanel = ({ dependencies, selectedTaskId }: DependencyPanelProps) => {
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Dependency links from backend (FS, SS, FF, SF). No scheduling computations are performed in UI.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Predecessor</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Successor</TableCell>
            <TableCell>Lag (days)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {dependencies.map((dep) => {
            const highlighted = selectedTaskId
              ? dep.predecessorTaskId === selectedTaskId || dep.successorTaskId === selectedTaskId
              : false;
            return (
              <TableRow key={dep.dependencyId} selected={highlighted}>
                <TableCell>{dep.predecessorTaskName}</TableCell>
                <TableCell>
                  <Chip size="small" label={dep.dependencyType} />
                </TableCell>
                <TableCell>{dep.successorTaskName}</TableCell>
                <TableCell>{dep.lagDays ?? 0}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Stack>
  );
};
