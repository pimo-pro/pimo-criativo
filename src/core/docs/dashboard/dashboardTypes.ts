/**
 * Contratos e snapshot base do Hub — Dashboard Avançado.
 */

import { loadProjectCount } from "@/core/projects/loadProjectCount";

export type HubStatTone = "neutral" | "blue" | "green";

export type HubStatIcon =
  | "code"
  | "files"
  | "projects"
  | "designer"
  | "dev"
  | "ai";

export type HubStatDelta = {
  percentLabel: string;
  direction: "up" | "down" | "flat";
};

export type HubStatCard = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  icon: HubStatIcon;
  tone: HubStatTone;
  delta?: HubStatDelta;
};

export type HubStatsSnapshot = {
  sourceLabel: string;
  totalProjects: number;
  cards: HubStatCard[];
};

/** Snapshot de estatísticas do Hub, com contagem dinâmica de projetos. */
export function loadHubStats(): HubStatsSnapshot {
  const { totalProjects } = loadProjectCount();
  const projectsValue = totalProjects.toLocaleString("pt-PT");

  return {
    sourceLabel: "\u00daltimo scan VS Code + Clin \u00b7 ops internas \u00b7 /PROJETOS",
    totalProjects,
    cards: [
      {
        id: "loc",
        label: "Linhas de c\u00f3digo",
        value: "345.100",
        hint: "Scan de c\u00f3digo",
        icon: "code",
        tone: "blue",
        delta: { percentLabel: "306,5%", direction: "up" },
      },
      {
        id: "files",
        label: "Arquivos",
        value: "2.320",
        hint: "Scan de c\u00f3digo",
        icon: "files",
        tone: "blue",
        delta: { percentLabel: "324,9%", direction: "up" },
      },
      {
        id: "projects",
        label: "Projetos criados",
        value: projectsValue,
        hint: "Din\u00e2mico \u2014 alinhado a /PROJETOS",
        icon: "projects",
        tone: "neutral",
      },
      {
        id: "designers",
        label: "Designers ativos",
        value: "1",
        icon: "designer",
        tone: "neutral",
      },
      {
        id: "devs",
        label: "Programadores ativos",
        value: "1",
        icon: "dev",
        tone: "neutral",
      },
      {
        id: "agents",
        label: "Agentes de IA ativos",
        value: "6",
        icon: "ai",
        tone: "green",
      },
    ],
  };
}

export type DashboardTone = "neutral" | "blue" | "green" | "amber";

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone: DashboardTone;
  deltaLabel?: string;
  sparkline: number[];
};

export type DashboardPoint = { x: number; y: number; label?: string };

export type DashboardSeries = {
  id: string;
  label: string;
  color: string;
  points: DashboardPoint[];
};

export type DashboardBar = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type DashboardSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type DashboardGraph =
  | {
      id: string;
      kind: "timeline" | "line";
      title: string;
      series: DashboardSeries[];
    }
  | {
      id: string;
      kind: "bars";
      title: string;
      bars: DashboardBar[];
      max?: number;
    }
  | {
      id: string;
      kind: "donut";
      title: string;
      slices: DashboardSlice[];
    };

export type DashboardHealthStatus = "ok" | "warn" | "fail";

export type DashboardHealthItem = {
  id: string;
  label: string;
  status: DashboardHealthStatus;
  detail: string;
};

export type DashboardHealth = {
  overall: DashboardHealthStatus;
  items: DashboardHealthItem[];
};

export type DashboardCounters = {
  completed: number;
  inProgress: number;
  planned: number;
  total: number;
  completionPercent: number;
  roadmapProgress: number;
};

export type HubDashboardSnapshot = {
  generatedAtLabel: string;
  kpis: DashboardKpi[];
  counters: DashboardCounters;
  graphs: DashboardGraph[];
  health: DashboardHealth;
};
