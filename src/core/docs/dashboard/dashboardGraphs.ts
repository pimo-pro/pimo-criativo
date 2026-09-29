/**
 * Dados SVG do Dashboard — timeline, barras, donut (sem libs).
 */

import { loadHubProgresso } from "../progresso/loadHubProgresso";
import { loadHubPlaneamento } from "../planeamento/loadHubPlaneamento";
import { loadHubAtual } from "../atual/loadHubAtual";
import {
  loadHubStats,
  type DashboardGraph,
  type DashboardSlice,
} from "./dashboardTypes";

const C = {
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  gray: "#94a3b8",
  cyan: "#67e8f9",
};

function parsePtNumber(raw: string): number {
  return Number(String(raw).replace(/\./g, "").replace(",", ".")) || 0;
}

function distributeByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map((v) => Math.floor(v));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const o of order) {
    if (rem <= 0) break;
    floors[o.i] += 1;
    rem -= 1;
  }
  return floors;
}

export function buildDashboardGraphs(): DashboardGraph[] {
  const stats = loadHubStats();
  const progresso = loadHubProgresso();
  const planeamento = loadHubPlaneamento();
  const atual = loadHubAtual();

  const loc = parsePtNumber(stats.cards.find((c) => c.id === "loc")?.value ?? "0");
  const files = parsePtNumber(stats.cards.find((c) => c.id === "files")?.value ?? "0");

  const phases = planeamento.roadmapPhases.length
    ? planeamento.roadmapPhases
    : [
        {
          id: "p0",
          title: "Phase",
          doneTasks: 1,
          totalTasks: 1,
          progress: 0,
          status: "todo",
          statusLabel: "",
          description: "",
          tasks: [],
        },
      ];

  const weights = phases.map((p) => Math.max(1, p.doneTasks + Math.round(p.progress / 20)));
  const locBars = distributeByWeights(loc, weights);
  const fileBars = distributeByWeights(files, weights);

  const timeline: DashboardGraph = {
    id: "timeline-roadmap-progresso",
    kind: "timeline",
    title: "Linha do tempo (roadmap " + "→" + " progresso " + "→" + " concluídas)",
    series: [
      {
        id: "path",
        label: "Estado",
        color: C.blue,
        points: [
          { x: 0, y: Math.max(1, atual.resumo.roadmapProgress), label: "Roadmap" },
          { x: 1, y: Math.max(1, progresso.counters.completionPercent), label: "Progresso" },
          {
            x: 2,
            y: Math.max(
              1,
              Math.min(
                100,
                Math.round((progresso.counters.completed / Math.max(1, progresso.counters.total)) * 100)
              )
            ),
            label: "Concluídas",
          },
        ],
      },
    ],
  };

  const barsLoc: DashboardGraph = {
    id: "bars-loc",
    kind: "bars",
    title: "Linhas de código ao longo das fases",
    max: loc,
    bars: phases.map((p, i) => ({
      id: p.id,
      label: p.title.replace(/^Phase\s*/i, "P").slice(0, 18),
      value: locBars[i] ?? 0,
      color: C.blue,
    })),
  };

  const barsFiles: DashboardGraph = {
    id: "bars-files",
    kind: "bars",
    title: "Arquivos ao longo das fases",
    max: files,
    bars: phases.map((p, i) => ({
      id: p.id + "-f",
      label: p.title.replace(/^Phase\s*/i, "P").slice(0, 18),
      value: fileBars[i] ?? 0,
      color: C.cyan,
    })),
  };

  const stageOrder: Array<[keyof typeof planeamento.stages, string, string]> = [
    ["futura", "Futura", C.gray],
    ["em_andamento", "Andamento", C.blue],
    ["concluída", "Concluída", C.green],
    ["bloqueada", "Bloqueada", C.amber],
    ["dependente", "Dependente", C.cyan],
  ];

  const slices: DashboardSlice[] = stageOrder.map(([id, label, color]) => ({
    id,
    label,
    value: planeamento.stages[id]?.length ?? 0,
    color,
  }));

  const donut: DashboardGraph = {
    id: "donut-stages",
    kind: "donut",
    title: "Distribuição das fases (planeamento)",
    slices,
  };

  return [timeline, barsLoc, barsFiles, donut];
}
