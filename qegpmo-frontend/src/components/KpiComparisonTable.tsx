import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import type { KpiMatrixRow } from "../types";

interface KpiComparisonTableProps {
  projectNames: string[];
  rows: KpiMatrixRow[];
}

export const KpiComparisonTable = ({ projectNames, rows }: KpiComparisonTableProps) => {
  return (
    <TableContainer component={Paper}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 200 }}>KPI</TableCell>
            {projectNames.map((name) => (
              <TableCell key={name} align="center">
                {name}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.kpiLabel} hover>
              <TableCell>
                <Typography fontWeight={600}>{row.kpiLabel}</Typography>
              </TableCell>
              {projectNames.map((name) => (
                <TableCell key={`${row.kpiLabel}-${name}`} align="center">
                  {row.valuesByProject[name] ?? "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
