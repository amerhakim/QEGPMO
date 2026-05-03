import React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RiskIssueSeverityPoint } from "../types";

export function SeverityDistributionChart({ points }: { points: RiskIssueSeverityPoint[] }) {
  return (
    <section style={{ width: "100%", height: 320 }}>
      <h3 style={{ margin: "0 0 8px 0" }}>Risk & Issue Severity Distribution</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="critical" stackId="a" fill="#C53030" />
          <Bar dataKey="high" stackId="a" fill="#DD6B20" />
          <Bar dataKey="medium" stackId="a" fill="#D69E2E" />
          <Bar dataKey="low" stackId="a" fill="#38A169" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
