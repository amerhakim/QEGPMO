import React, { useMemo } from "react";
import { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ComparisonMatrixDataset } from "../types";
import { RagPill } from "./RagPill";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

interface Props {
  dataset: ComparisonMatrixDataset;
  onProjectSelect: (projectId: string) => void;
}

type MatrixRow = {
  kpi: string;
  [projectCode: string]: string | number | React.ReactNode;
};

export function ProjectComparisonMatrix({ dataset, onProjectSelect }: Props) {
  const rowData = useMemo<MatrixRow[]>(() => {
    const rows: MatrixRow[] = [
      { kpi: "Progress %" },
      { kpi: "Schedule Var %" },
      { kpi: "Cost Var %" },
      { kpi: "Risk Critical" },
      { kpi: "Risk High" },
      { kpi: "Issue Critical" },
      { kpi: "Issue High" },
      { kpi: "Overall RAG" },
    ];

    dataset.columns.forEach((project) => {
      rows[0][project.projectCode] = project.progressPercent;
      rows[1][project.projectCode] = project.scheduleVariancePercent;
      rows[2][project.projectCode] = project.costVariancePercent;
      rows[3][project.projectCode] = project.riskCritical;
      rows[4][project.projectCode] = project.riskHigh;
      rows[5][project.projectCode] = project.issueCritical;
      rows[6][project.projectCode] = project.issueHigh;
      rows[7][project.projectCode] = <RagPill value={project.overallRag} />;
    });
    return rows;
  }, [dataset.columns]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "kpi",
        pinned: "left",
        minWidth: 180,
        sortable: false,
        filter: false,
      },
      ...dataset.columns.map<ColDef>((project) => ({
        headerName: `${project.projectCode}`,
        field: project.projectCode,
        minWidth: 150,
        headerTooltip: project.projectName,
        onCellClicked: () => onProjectSelect(project.projectId),
      })),
    ],
    [dataset.columns, onProjectSelect],
  );

  return (
    <section>
      <h3 style={{ margin: "0 0 8px 0" }}>Project KPI Comparison Matrix</h3>
      <div className="ag-theme-quartz" style={{ height: 360, width: "100%" }}>
        <AgGridReact rowData={rowData} columnDefs={columnDefs} domLayout="normal" />
      </div>
    </section>
  );
}
