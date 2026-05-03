import { useEffect, useMemo, useState } from "react";
import { exportDashboard, exportDrilldown, getExecutiveDashboard } from "../api/dashboard-api";
import { DashboardData, DashboardScope, UserContext } from "../types";

export function useExecutiveDashboard(initialScope: DashboardScope, user: UserContext) {
  const [scope, setScope] = useState<DashboardScope>(initialScope);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getExecutiveDashboard(scope, user)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope.id, scope.level, scope.tenantId, user]);

  const canViewFinancials = useMemo(
    () => user.permissions.includes("financial.summary.compute"),
    [user.permissions],
  );

  return {
    scope,
    setScope,
    data,
    loading,
    error,
    canViewFinancials,
    onExportFull: () => exportDashboard(scope, user),
    onExportDrilldown: () => exportDrilldown(scope, user),
  };
}
