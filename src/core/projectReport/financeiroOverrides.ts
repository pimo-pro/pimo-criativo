/**
 * P3.26 — Overrides manuais do Relatório Final.
 * Não recalculam a base Unificado: partem do SSOT e aplicam ajustes de linha.
 * Portas/Remates industriais permanecem 0 € (madeira nas chapas).
 */

import {
  FINANCEIRO_CUSTO_KEYS,
  FINANCEIRO_CUSTO_MATERIAL_KEYS,
  type FinanceiroCustoKey,
} from "@/core/financeiro/financeiroUnificadoTypes";
import type { FinanceiroUnificadoSnapshot } from "@/core/financeiro/financeiroUnificadoTypes";

import { isOfficialTotalLockedKey } from "./financeReportCalc";
import type { ProjectReportFinanceiro, ReportFinanceiroLinha } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type ReportLineOverrides = Partial<Record<FinanceiroCustoKey, number>>;

export type PaineisOrigemBadge =
  | "chapas_reais_m2_area"
  | "fallback_por_peca"
  | "estimado";

export const PAINEIS_ORIGEM_LABEL: Record<PaineisOrigemBadge, string> = {
  chapas_reais_m2_area: "chapas reais · €/m² × área",
  fallback_por_peca: "fallback por peça",
  estimado: "chapas estimadas (sem nesting real)",
};

/** Painéis oficiais = paineis + chapasReais (anti double-count na UI). */
export function officialPaineisTotal(snap: FinanceiroUnificadoSnapshot): number {
  return round2(
    (Number(snap.custosEffective.paineis) || 0) +
      (Number(snap.custosEffective.chapasReais) || 0)
  );
}

export function resolvePaineisOrigem(
  snap: FinanceiroUnificadoSnapshot
): PaineisOrigemBadge {
  const chapasEur = Number(snap.custosEffective.chapasReais) || 0;
  const meta = snap.chapasReaisMeta;
  if (chapasEur > 0 && meta?.nestingMode === "real") {
    return "chapas_reais_m2_area";
  }
  if (snap.chapas?.mode === "estimado" || meta?.nestingMode === "estimado") {
    return "estimado";
  }
  return "fallback_por_peca";
}

/** Normaliza overrides: chapasReais nunca tem override próprio (vai em Painéis). */
export function normalizeReportLineOverrides(
  overrides: ReportLineOverrides | null | undefined
): ReportLineOverrides {
  if (!overrides) return {};
  const out: ReportLineOverrides = {};
  for (const key of FINANCEIRO_CUSTO_KEYS) {
    if (key === "chapasReais") continue;
    const v = overrides[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = round2(v);
    }
  }
  return out;
}

/**
 * Aplica overrides manuais sobre um financeiro já SSOT.
 * Recalcula subtotal / IVA / total com a fórmula ADMIN (IVA só materiais).
 * Não usa detalhe nem €/m² local. Preserva officialSnapshot.
 */
export function applyReportLineOverrides(
  fin: ProjectReportFinanceiro,
  overrides: ReportLineOverrides | null | undefined
): ProjectReportFinanceiro {
  const ov = normalizeReportLineOverrides(overrides);
  const ivaPct =
    typeof fin.ivaPct === "number" && Number.isFinite(fin.ivaPct) && fin.ivaPct >= 0
      ? fin.ivaPct
      : 23;

  // Snapshot oficial: preferir o já gravado; senão capturar totais actuais sem ov.
  const officialSnapshot =
    fin.officialSnapshot ??
    Object.fromEntries([
      ...fin.linhas
        .filter((l) => l.key !== "iva" && l.key !== "total")
        .map((l) => [l.key, round2(Number(l.total) || 0)]),
      ["subtotal", round2(fin.subtotal)],
      ["ivaValor", round2(fin.ivaValor)],
      ["totalProjeto", round2(fin.totalProjeto)],
      ["ivaPct", ivaPct],
    ]);

  const linhas: ReportFinanceiroLinha[] = fin.linhas.map((l) => {
    if (l.key === "iva" || l.key === "total") return l;
    if (l.key === "chapasReais") {
      return {
        ...l,
        total: 0,
        quantidade: null,
        precoUnitario: null,
      };
    }
    const key = l.key as FinanceiroCustoKey;
    const base =
      typeof officialSnapshot[key] === "number"
        ? Number(officialSnapshot[key])
        : round2(Number(l.total) || 0);
    if (Object.prototype.hasOwnProperty.call(ov, key)) {
      return {
        ...l,
        total: round2(ov[key] ?? 0),
        quantidade: null,
        precoUnitario: null,
        detalhe: l.detalhe,
      };
    }
    return {
      ...l,
      total: base,
      quantidade: isOfficialTotalLockedKey(key) ? null : l.quantidade,
      precoUnitario: isOfficialTotalLockedKey(key) ? null : l.precoUnitario,
    };
  });

  const byKey = new Map(linhas.map((l) => [l.key, l]));
  const subtotal = round2(
    FINANCEIRO_CUSTO_MATERIAL_KEYS.reduce((s, k) => s + (Number(byKey.get(k)?.total) || 0), 0)
  );
  const adm = round2(Number(byKey.get("adm")?.total) || 0);
  const montagem = round2(Number(byKey.get("montagem")?.total) || 0);
  const portes = round2(Number(byKey.get("portes")?.total) || 0);
  const ivaValor = round2(subtotal * (ivaPct / 100));
  const totalProjeto = round2(subtotal + adm + montagem + portes + ivaValor);

  return {
    ...fin,
    ivaPct,
    officialSnapshot,
    linhas: linhas.map((l) => {
      if (l.key === "iva") {
        return { ...l, label: `IVA (${ivaPct}%)`, total: ivaValor, detalhe: [] };
      }
      if (l.key === "total") {
        return { ...l, total: totalProjeto, detalhe: [] };
      }
      return l;
    }),
    subtotal,
    ivaValor,
    totalProjeto,
    lineOverrides: Object.keys(ov).length > 0 ? ov : undefined,
  };
}

/** Define/remove um override de linha sem tocar no motor Unificado. */
export function setReportLineOverride(
  fin: ProjectReportFinanceiro,
  key: FinanceiroCustoKey,
  value: number | null
): ProjectReportFinanceiro {
  const prev = { ...(fin.lineOverrides ?? {}) };
  if (value == null || !Number.isFinite(value) || value < 0) {
    delete prev[key];
  } else if (key === "chapasReais") {
    delete prev[key];
  } else {
    prev[key] = round2(value);
  }
  return applyReportLineOverrides({ ...fin, lineOverrides: prev }, prev);
}
