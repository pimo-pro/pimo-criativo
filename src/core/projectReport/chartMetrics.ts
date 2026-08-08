import type { ProjectReportMetricas } from "./types";

export type ChartMetricItem = {
  key: keyof ProjectReportMetricas;
  label: string;
  value: number;
  color: string;
};

/** Fatias do gráfico circular principal (ordens / tarefas / erros / corrigidos). */
export function buildCircleChartMetrics(metricas: ProjectReportMetricas): ChartMetricItem[] {
  return [
    {
      key: "ordensTrabalho",
      label: "Ordens de trabalho",
      value: metricas.ordensTrabalho,
      color: "#7c3aed",
    },
    {
      key: "tarefasConcluidas",
      label: "Tarefas conclu\u00eddas",
      value: metricas.tarefasConcluidas,
      color: "#16a34a",
    },
    { key: "erros", label: "Erros", value: metricas.erros, color: "#dc2626" },
    {
      key: "errosCorrigidos",
      label: "Erros corrigidos",
      value: metricas.errosCorrigidos,
      color: "#ea580c",
    },
  ];
}

export function buildChartMetrics(metricas: ProjectReportMetricas): ChartMetricItem[] {
  return [
    ...buildCircleChartMetrics(metricas),
    { key: "melhorias", label: "Melhorias", value: metricas.melhorias, color: "#2563eb" },
    {
      key: "colaboradores",
      label: "Colaboradores",
      value: metricas.colaboradores,
      color: "#0891b2",
    },
  ];
}
