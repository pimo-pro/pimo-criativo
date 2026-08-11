/**
 * P3.19 — Anexa detalhe de chapas a Painéis sem reprecificar totais do Unificado.
 */

import type { ProjectState } from "@/context/projectTypes";
import { computeChapasReal } from "@/core/industrial/computeChapasReal";
import { findOfflineProjectByAnyKey } from "@/core/projects/projectIdentity";
import { toSavedRecordFromOffline } from "@/core/projects/projectsMappers";
import { resolveProjectCutlistFromRecord } from "@/industrial/work-orders/resolveProjectCutlistFromRecord";

import { aggregateChapasByEspessura, recalcChapaDetalhe } from "./chapasReport";
import type { ProjectReportFinanceiro, ReportFinanceiroDetalhe } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Total madeira no Unificado (Painéis + chapas reais, anti double-count). */
export function madeiraTotalFromFinanceiro(fin: ProjectReportFinanceiro): number {
  const paineis = Number(fin.linhas.find((l) => l.key === "paineis")?.total) || 0;
  const chapas = Number(fin.linhas.find((l) => l.key === "chapasReais")?.total) || 0;
  return round2(paineis + chapas);
}

/** Soma dos totais do detalhe de chapas (UI Painéis). */
export function totalChapasDetalhe(detalhe: ReportFinanceiroDetalhe[]): number {
  return round2(detalhe.reduce((s, d) => s + (Number(d.total) || 0), 0));
}

/**
 * Constrói detalhe de chapas reais (mesmas sheets que alimentam TCN/nesting),
 * sem alterar subtotal/IVA/total do relatório.
 */
export function buildPaineisChapasDetalhe(
  projectId: string,
  state: ProjectState | null | undefined
): ReportFinanceiroDetalhe[] {
  const offline = findOfflineProjectByAnyKey(projectId);
  if (!offline && !state) return [];
  try {
    const ctx = offline
      ? resolveProjectCutlistFromRecord(toSavedRecordFromOffline(offline))
      : null;
    const cutlist = (ctx?.cutListItems ?? []).map((item) => ({
      ...item,
      precoUnitario: Number((item as { precoUnitario?: number }).precoUnitario) || 0,
      precoTotal: Number((item as { precoTotal?: number }).precoTotal) || 0,
    }));
    const boxes = (state?.boxes ?? []).map((b) => ({ id: b.id }));
    const chapas = computeChapasReal(
      cutlist,
      state?.projectName || projectId,
      boxes
    );
    if (chapas.mode !== "real" || chapas.sheets.length === 0) return [];
    return aggregateChapasByEspessura(chapas.sheets);
  } catch {
    return [];
  }
}

/**
 * Anexa/substitui detalhe em Painéis sem recalcFinanceiro (totais Unificado intactos).
 */
export function withPaineisChapasDetalhe(
  fin: ProjectReportFinanceiro,
  detalhe: ReportFinanceiroDetalhe[]
): ProjectReportFinanceiro {
  const mapped = detalhe.map(recalcChapaDetalhe);
  return {
    ...fin,
    linhas: fin.linhas.map((l) =>
      l.key === "paineis" ? { ...l, detalhe: mapped } : l
    ),
  };
}

/** Obtém detalhe Painéis do relatório. */
export function getPaineisDetalhe(
  fin: ProjectReportFinanceiro
): ReportFinanceiroDetalhe[] {
  return fin.linhas.find((l) => l.key === "paineis")?.detalhe ?? [];
}
