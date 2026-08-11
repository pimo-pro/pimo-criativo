/**
 * P3.22/P3.23 — financeiroTotals (fluxo original do Relatório Final).
 * Calcula subtotal / IVA / total da página Financeiro.
 * Unificado continua SSOT dos totais oficiais (alinhamento).
 */

import type { ProjectState } from "@/context/projectTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import {
  FINANCEIRO_CUSTO_KEYS,
  type FinanceiroCustoKey,
} from "@/core/financeiro/financeiroUnificadoTypes";
import type { MaterialIndustrial } from "@/core/manufacturing/materials";

import { sanitizeFinanceiroDetalhe } from "./financeiroDetalheSanitize";
import { ensureFinanceiroShape, recalcFinanceiro } from "./financeReportCalc";
import type { ProjectReportFinanceiro } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Recalcula totais a partir das linhas/detalhe da UI (fórmula ADMIN:
 * IVA só sobre materiais).
 */
export function financeiroTotals(fin: ProjectReportFinanceiro): ProjectReportFinanceiro {
  return recalcFinanceiro(ensureFinanceiroShape(fin));
}

/**
 * Alinha totais oficiais ao Unificado (SSOT ADMIN).
 * Preserva detalhe UI sanitizado; não deixa detalhe/fallback sobrescrever o total oficial.
 * Painéis = paineis + chapasReais (igual à UI ADMIN).
 */
export function alignOfficialTotalsToUnificado(
  fin: ProjectReportFinanceiro,
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = []
): ProjectReportFinanceiro {
  if (!state) return financeiroTotals(fin);
  try {
    const snap = computeFinanceiroUnificado(state, materials);
    const totaled = financeiroTotals(fin);
    const ivaPct =
      typeof snap.ivaPct === "number" && Number.isFinite(snap.ivaPct) && snap.ivaPct >= 0
        ? snap.ivaPct
        : totaled.ivaPct;
    const subtotal = round2(snap.subtotal);
    const ivaValor = round2(snap.ivaValor);
    const totalProjeto = round2(snap.totalProjeto);

    const officialForKey = (key: FinanceiroCustoKey): number => {
      if (key === "chapasReais") return 0;
      if (key === "paineis") {
        return round2(
          (Number(snap.custosEffective.paineis) || 0) +
            (Number(snap.custosEffective.chapasReais) || 0)
        );
      }
      return round2(Number(snap.custosEffective[key]) || 0);
    };

    return {
      ...totaled,
      ivaPct,
      subtotal,
      ivaValor,
      totalProjeto,
      linhas: totaled.linhas.map((l) => {
        if (l.key === "iva") {
          return { ...l, label: `IVA (${ivaPct}%)`, total: ivaValor, detalhe: [] };
        }
        if (l.key === "total") {
          return { ...l, total: totalProjeto, detalhe: [] };
        }
        if (l.key === "chapasReais") {
          return { ...l, total: 0, detalhe: [], quantidade: null, precoUnitario: null };
        }
        if ((FINANCEIRO_CUSTO_KEYS as readonly string[]).includes(l.key)) {
          const key = l.key as FinanceiroCustoKey;
          return {
            ...l,
            total: officialForKey(key),
            detalhe: sanitizeFinanceiroDetalhe(l.detalhe),
          };
        }
        return l;
      }),
    };
  } catch {
    return financeiroTotals(fin);
  }
}
