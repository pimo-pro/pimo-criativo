/**
 * Dashboard Avançado — barrel (Fase 12).
 */

export type {
  HubStatTone,
  HubStatIcon,
  HubStatDelta,
  HubStatCard,
  HubStatsSnapshot,
  DashboardTone,
  DashboardKpi,
  DashboardPoint,
  DashboardSeries,
  DashboardBar,
  DashboardSlice,
  DashboardGraph,
  DashboardHealthStatus,
  DashboardHealthItem,
  DashboardHealth,
  DashboardCounters,
  HubDashboardSnapshot,
} from "./dashboardTypes";

export { loadHubStats } from "./dashboardTypes";
export { buildDashboardKpis } from "./dashboardKpis";
export { buildDashboardGraphs } from "./dashboardGraphs";
export { buildDashboardHealth } from "./dashboardHealth";
export { loadHubDashboard } from "./loadHubDashboard";
