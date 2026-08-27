/**
 * P3.19 / P3.26 — Detalhe de chapas em Painéis (só visualização).
 * Nunca chama updateFinanceiroLinha — totais Unificado intactos.
 * R1: cutlist a partir do ProjectState passado; offline só se não houver state.
 */

import type { ProjectState } from "@/context/projectTypes";
import { deriveCustoChapaReal } from "@/core/financeiro/deriveCustoChapaReal";
import { buildCutlistItemsForIndustrialExport } from "@/core/fabrication/buildCutlistItemsForIndustrialExport";
import { computeChapasReal } from "@/core/industrial/computeChapasReal";
import { findOfflineProjectByAnyKey } from "@/core/projects/projectIdentity";
import { toSavedRecordFromOffline } from "@/core/projects/projectsMappers";
import type { CutListItem } from "@/core/types";
import { resolveProjectCutlistFromRecord } from "@/industrial/work-orders/resolveProjectCutlistFromRecord";

import {
  aggregateChapasByEspessura,
  aggregateChapasByEspessuraEMaterial,
  detalheFromCatalogoChapa,
  formatMedidaMm,
  recalcChapaDetalhe,
  resolveDimensoesMm,
} from "./chapasReport";
import type { CatalogoChapaOption } from "./chapasReport";
import { isReportFinanceiroProvenanceEnabled } from "../features";
import type { ProjectReportFinanceiro, ReportFinanceiroDetalhe } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

/** Total madeira no Unificado (Painéis + chapas reais, anti double-count). */
export function madeiraTotalFromFinanceiro(fin: ProjectReportFinanceiro): number {
  const paineis = Number(fin.linhas.find((l) => l.key === "paineis")?.total) || 0;
  const chapas = Number(fin.linhas.find((l) => l.key === "chapasReais")?.total) || 0;
  return round2(paineis + chapas);
}

/** Soma dos totais do detalhe de chapas (UI apenas — não é SSOT). */
export function totalChapasDetalhe(detalhe: ReportFinanceiroDetalhe[]): number {
  return round2(detalhe.reduce((s, d) => s + (Number(d.total) || 0), 0));
}

function normalizeCutlistPrices(
  items: CutListItem[]
): Array<CutListItem & { precoUnitario: number; precoTotal: number }> {
  return items.map((item) => ({
    ...item,
    precoUnitario: Number((item as { precoUnitario?: number }).precoUnitario) || 0,
    precoTotal: Number((item as { precoTotal?: number }).precoTotal) || 0,
  }));
}

/** Cutlist alinhada a resolveProjectCutlistFromRecord, a partir do state vivo. */
export function cutlistItemsFromProjectState(
  state: ProjectState,
  projectId: string
): CutListItem[] {
  const fromState = Array.isArray(state.cutList)
    ? (state.cutList as CutListItem[])
    : [];
  if (fromState.length > 0) return fromState;
  return buildCutlistItemsForIndustrialExport({
    boxes: state.boxes ?? [],
    rules: state.rules,
    materialId: state.materialId,
    projectName: state.projectName || projectId,
    remates: state.remates ?? [],
    rodapes: state.rodapes ?? [],
    extractedPartsByBoxId: state.extractedPartsByBoxId,
    industrialPieceEdits: state.industrialPieceEdits,
  });
}

function resolveCutlistForPaineisDetalhe(
  projectId: string,
  state: ProjectState | null | undefined
): ReturnType<typeof normalizeCutlistPrices> {
  if (state) {
    return normalizeCutlistPrices(cutlistItemsFromProjectState(state, projectId));
  }
  const offline = findOfflineProjectByAnyKey(projectId);
  if (!offline) return [];
  const ctx = resolveProjectCutlistFromRecord(toSavedRecordFromOffline(offline));
  return normalizeCutlistPrices(ctx?.cutListItems ?? []);
}

/**
 * Constrói detalhe visual de chapas reais.
 * Usa o mesmo €/m² dominante de deriveCustoChapaReal (SSOT ADMIN) para exibição.
 * Com `state` presente, ignora cutlist offline (pode estar stale).
 */
export function buildPaineisChapasDetalhe(
  projectId: string,
  state: ProjectState | null | undefined
): ReportFinanceiroDetalhe[] {
  if (!state && !findOfflineProjectByAnyKey(projectId)) return [];
  try {
    const cutlist = resolveCutlistForPaineisDetalhe(projectId, state);
    const boxes = (state?.boxes ?? []).map((b) => ({ id: b.id }));
    const chapas = computeChapasReal(
      cutlist,
      state?.projectName || projectId,
      boxes,
      { projectId }
    );
    if (chapas.sheets.length === 0) return [];

    const derived = deriveCustoChapaReal({ cutlist });
    const rows = isReportFinanceiroProvenanceEnabled()
      ? aggregateChapasByEspessuraEMaterial(chapas.sheets)
      : aggregateChapasByEspessura(chapas.sheets);

    // Alinhar €/m² e €/chapa ao derivado ADMIN (não ao resolveEurM2 local divergente).
    if (derived.eurM2 > 0 && derived.custoChapaReal > 0) {
      return rows.map((d) => {
        const { L, A } = resolveDimensoesMm(d);
        const area = round4((Math.max(0, L) * Math.max(0, A)) / 1_000_000);
        const precoUnitario = round2(derived.eurM2 * area);
        return recalcChapaDetalhe({
          ...d,
          dimensoes: formatMedidaMm(L, A),
          comprimentoMm: L,
          larguraMm: A,
          precoPorM2: derived.eurM2,
          precoPorMetro: 0,
          precoUnitario,
          total: round2((Number(d.quantidade) || 0) * precoUnitario),
        });
      });
    }

    return rows;
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
      l.key === "paineis"
        ? {
            ...l,
            detalhe: mapped,
            quantidade: null,
            precoUnitario: null,
          }
        : l.key === "chapasReais"
          ? {
              ...l,
              detalhe: mapped,
              total: 0,
              quantidade: null,
              precoUnitario: null,
            }
          : l
    ),
  };
}

/** Obtém detalhe Painéis do relatório. */
export function getPaineisDetalhe(
  fin: ProjectReportFinanceiro
): ReportFinanceiroDetalhe[] {
  return fin.linhas.find((l) => l.key === "paineis")?.detalhe ?? [];
}

/**
 * Adiciona chapa do catálogo ao detalhe visual (não altera totais oficiais).
 */
export function addChapaToPaineisFinanceiro(
  fin: ProjectReportFinanceiro,
  opt: CatalogoChapaOption
): ProjectReportFinanceiro {
  return withPaineisChapasDetalhe(fin, [
    ...getPaineisDetalhe(fin),
    detalheFromCatalogoChapa(opt),
  ]);
}

/** Actualiza detalhe visual de chapas (não altera totais oficiais). */
export function setPaineisChapasDetalhe(
  fin: ProjectReportFinanceiro,
  detalhe: ReportFinanceiroDetalhe[]
): ProjectReportFinanceiro {
  return withPaineisChapasDetalhe(fin, detalhe);
}
