/**
 * Metricas do Painel grafico — derivadas (nao editaveis manualmente).
 * 1A: erros / solucoes / melhorias somam Design + Producao + Montagem.
 */

import type {
  ProjectReport,
  ProjectReportMetricas,
  ReportOperador,
  ReportTextoItem,
} from "./types";

function countItems(list: ReportTextoItem[] | undefined): number {
  return (list ?? []).filter((i) => String(i.texto ?? "").trim()).length;
}

export function sumHorasOperadores(list: ReportOperador[] | undefined): number {
  return Math.round(
    (list ?? []).reduce((s, o) => s + (Number(o.horas) || 0), 0) * 100
  ) / 100;
}

export function deriveTempoTrabalhoHoras(report: Pick<ProjectReport, "producao" | "montagem">): number {
  const prod = sumHorasOperadores(report.producao?.operadores);
  const mont = sumHorasOperadores(report.montagem?.instaladores);
  // Preferir horas efetivas de producao se superiores ao somatorio de operadores
  const horasProd = Math.max(prod, Number(report.producao?.horasEfetivas) || 0);
  return Math.round((horasProd + mont) * 100) / 100;
}

export function deriveColaboradores(report: Pick<ProjectReport, "producao" | "montagem">): number {
  const instaladores = report.montagem?.instaladores?.length ?? 0;
  if (instaladores > 0) return instaladores;
  return report.producao?.operadores?.length ?? 0;
}

export function deriveErrosCount(report: Pick<ProjectReport, "design" | "producao" | "montagem">): number {
  return (
    countItems(report.design?.errosDesign) +
    countItems(report.producao?.erros) +
    countItems(report.montagem?.erros)
  );
}

export function deriveErrosCorrigidosCount(
  report: Pick<ProjectReport, "design" | "producao" | "montagem">
): number {
  return (
    countItems(report.design?.solucoesAplicadas) +
    countItems(report.producao?.solucoesAplicadas) +
    countItems(report.montagem?.solucoesAplicadas)
  );
}

export function deriveMelhoriasCount(
  report: Pick<ProjectReport, "design" | "producao" | "montagem">
): number {
  return (
    countItems(report.design?.melhoriasPropostas) +
    countItems(report.design?.melhoriasImplementadas) +
    countItems(report.producao?.melhoriasPropostas) +
    countItems(report.producao?.melhoriasImplementadas) +
    countItems(report.montagem?.melhoriasPropostas) +
    countItems(report.montagem?.melhoriasImplementadas)
  );
}

/**
 * Recalcula metricas automaticas.
 * Preserva ordensTrabalho / tarefasConcluidas vindas do TRAK (ja em metricas).
 */
export function deriveMetricas(report: ProjectReport): ProjectReportMetricas {
  const prev = report.metricas ?? {
    tarefasConcluidas: 0,
    erros: 0,
    errosCorrigidos: 0,
    melhorias: 0,
    ordensTrabalho: 0,
    colaboradores: 0,
  };
  return {
    ordensTrabalho: Math.max(0, Number(prev.ordensTrabalho) || 0),
    tarefasConcluidas: Math.max(0, Number(prev.tarefasConcluidas) || 0),
    erros: deriveErrosCount(report),
    errosCorrigidos: deriveErrosCorrigidosCount(report),
    melhorias: deriveMelhoriasCount(report),
    colaboradores: deriveColaboradores(report),
  };
}

/** Aplica deriveMetricas ao documento. */
export function withDerivedMetricas(report: ProjectReport): ProjectReport {
  return { ...report, metricas: deriveMetricas(report) };
}
