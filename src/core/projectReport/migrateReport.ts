/**
 * Migracao de Relatorio Final v1 (strings) -> v2 (listas de itens).
 */

import {
  emptyDesign,
  emptyMontagem,
  emptyProducao,
  makeReportId,
  PROJECT_REPORT_VERSION,
  type ProjectReport,
  type ProjectReportDesign,
  type ProjectReportMontagem,
  type ProjectReportProducao,
  type ReportTextoItem,
} from "./types";

/** Converte string legado (linhas ou bloco) em itens. */
export function stringToTextoItems(raw: unknown, prefix = "it"): ReportTextoItem[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (entry && typeof entry === "object" && "texto" in entry) {
          const o = entry as { id?: string; texto?: unknown };
          const texto = String(o.texto ?? "").trim();
          if (!texto) return null;
          return { id: String(o.id || makeReportId(prefix)), texto };
        }
        const texto = String(entry ?? "").trim();
        if (!texto) return null;
        return { id: makeReportId(prefix), texto };
      })
      .filter((x): x is ReportTextoItem => Boolean(x));
  }
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return [{ id: makeReportId(prefix), texto: trimmed }];
  }
  return lines.map((texto) => ({ id: makeReportId(prefix), texto }));
}

function migrateDesign(raw: unknown): ProjectReportDesign {
  const base = emptyDesign();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  return {
    dataInicio: String(d.dataInicio ?? ""),
    dataConclusao: String(d.dataConclusao ?? ""),
    revisoesAntesProducao: Math.max(0, Number(d.revisoesAntesProducao) || 0),
    revisoesAposProducao: Math.max(0, Number(d.revisoesAposProducao) || 0),
    errosDesign: stringToTextoItems(d.errosDesign, "de"),
    solucoesAplicadas: stringToTextoItems(d.solucoesAplicadas, "ds"),
    melhoriasPropostas: stringToTextoItems(d.melhoriasPropostas, "dp"),
    melhoriasImplementadas: stringToTextoItems(d.melhoriasImplementadas, "di"),
  };
}

function migrateProducao(raw: unknown): ProjectReportProducao {
  const base = emptyProducao();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;
  return {
    ...base,
    ...(p as Partial<ProjectReportProducao>),
    operadores: Array.isArray(p.operadores) ? (p.operadores as ProjectReportProducao["operadores"]) : [],
    caixas: Array.isArray(p.caixas) ? (p.caixas as ProjectReportProducao["caixas"]) : [],
    pecas: Array.isArray(p.pecas) ? (p.pecas as ProjectReportProducao["pecas"]) : [],
    dataInicio: String(p.dataInicio ?? ""),
    dataFim: String(p.dataFim ?? ""),
    horasEfetivas: Math.max(0, Number(p.horasEfetivas) || 0),
    reProducoes: Math.max(0, Number(p.reProducoes) || 0),
    erros: stringToTextoItems(p.erros, "pe"),
    solucoesAplicadas: stringToTextoItems(p.solucoesAplicadas, "ps"),
    melhoriasPropostas: stringToTextoItems(p.melhoriasPropostas, "pp"),
    melhoriasImplementadas: stringToTextoItems(p.melhoriasImplementadas, "pi"),
  };
}

function migrateMontagem(raw: unknown): ProjectReportMontagem {
  const base = emptyMontagem();
  if (!raw || typeof raw !== "object") return base;
  const m = raw as Record<string, unknown>;
  return {
    ...base,
    ...(m as Partial<ProjectReportMontagem>),
    dataEnvio: String(m.dataEnvio ?? ""),
    instaladores: Array.isArray(m.instaladores)
      ? (m.instaladores as ProjectReportMontagem["instaladores"])
      : [],
    dataInicio: String(m.dataInicio ?? ""),
    dataFim: String(m.dataFim ?? ""),
    intervencoesPos: Math.max(0, Number(m.intervencoesPos) || 0),
    erros: stringToTextoItems(m.erros, "me"),
    solucoesAplicadas: stringToTextoItems(m.solucoesAplicadas, "ms"),
    melhoriasPropostas: stringToTextoItems(m.melhoriasPropostas, "mp"),
    melhoriasImplementadas: stringToTextoItems(m.melhoriasImplementadas, "mi"),
  };
}

/** Normaliza qualquer payload guardado para ProjectReport v2. */
export function migrateProjectReport(raw: ProjectReport | Record<string, unknown>): ProjectReport {
  const r = raw as ProjectReport & Record<string, unknown>;
  return {
    ...(r as ProjectReport),
    version: PROJECT_REPORT_VERSION,
    design: migrateDesign(r.design),
    producao: migrateProducao(r.producao),
    montagem: migrateMontagem(r.montagem),
  };
}

export function joinTextoItems(items: ReportTextoItem[] | undefined): string {
  if (!items?.length) return "";
  return items.map((i) => i.texto).filter(Boolean).join("\n");
}
