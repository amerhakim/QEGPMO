import React from "react";
import { ProjectComparisonMatrix } from "./ProjectComparisonMatrix";
import { RagPill } from "./RagPill";
import { SeverityDistributionChart } from "./SeverityDistributionChart";
import { useExecutiveDashboard } from "../hooks/useExecutiveDashboard";
import { DashboardScope, UserContext } from "../types";

interface Props {
  user: UserContext;
  initialScope: DashboardScope;
}

export function ExecutiveConsolidatedDashboard({ user, initialScope }: Props) {
  const { data, error, loading, setScope, onExportDrilldown, onExportFull, canViewFinancials } =
    useExecutiveDashboard(initialScope, user);

  if (loading) return <div>Loading executive dashboard...</div>;
  if (error) return <div style={{ color: "#C53030" }}>{error}</div>;
  if (!data) return null;

  return (
    <main style={{ padding: 20, display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>QEGPMO Executive Consolidated Dashboard</h1>
          <small>Computed at: {new Date(data.matrix.computedAt).toLocaleString()}</small>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void onExportFull()}>Export Full Dashboard (Excel)</button>
          <button onClick={() => void onExportDrilldown()}>Export Current Drill-down (Excel)</button>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard title="Progress" value={`${data.summary.progressPercent.toFixed(2)}%`} />
        <StatCard title="Schedule RAG" value={<RagPill value={data.summary.scheduleRag} />} />
        <StatCard title="Cost RAG" value={<RagPill value={data.summary.costRag} />} />
        <StatCard title="Overall RAG" value={<RagPill value={data.summary.overallRag} />} />
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px 0" }}>Drill-down Path</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {data.drilldownPath.map((node) => (
            <button
              key={`${node.level}:${node.id}`}
              onClick={() => setScope({ tenantId: user.tenantId, level: node.level, id: node.id })}
            >
              {node.level} / {node.name}
            </button>
          ))}
        </div>
      </section>

      <ProjectComparisonMatrix
        dataset={data.matrix}
        onProjectSelect={(projectId) =>
          setScope({ tenantId: user.tenantId, level: "PROJECT", id: projectId })
        }
      />

      <SeverityDistributionChart points={data.severityDistribution} />

      {!canViewFinancials && (
        <div style={{ color: "#B7791F" }}>
          Financial visibility is restricted by your role permissions.
        </div>
      )}
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: 14,
        minHeight: 84,
      }}
    >
      <div style={{ fontSize: 13, color: "#4A5568" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{value}</div>
    </div>
  );
}
