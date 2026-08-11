/**
 * P3.22 — financeiroTotals (fluxo original do Relatório Final).
 * Calcula subtotal / IVA / total da página Financeiro.
 * Unificado continua SSOT dos totais oficiais (alinhamento opcional).
 */

import type { ProjectState } from "@/context/projectTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import type { MaterialIndustrial } from "@/core/manufacturing/materials";

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
 * Alinha apenas subtotal / IVA / Total oficiais ao Unificado (SSOT),
 * preservando o detalhe UI construído pelo adapter + industrial rules.
 * Categorias sem detalhe recebem o total oficial (não reconstrói a UI).
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
    return {
      ...totaled,
      ivaPct,
      subtotal,
      ivaValor,
      totalProjeto,
      linhas: totaled.linhas.map((l) => {
        if (l.key === "iva") {
          return { ...l, label: `IVA (${ivaPct}%)`, total: ivaValor };
        }
        if (l.key === "total") {
          return { ...l, total: totalProjeto };
        }
        // Portas/Remates industriais = 0 (regra UI); detalhe próprio manda.
        if (l.key === "portas" || l.key === "remates") return l;
        if ((l.detalhe?.length ?? 0) > 0) return l;
        const official = snap.custosEffective[l.key as keyof typeof snap.custosEffective];
        if (typeof official === "number" && Number.isFinite(official)) {
          return { ...l, total: round2(official) };
        }
        return l;
      }),
    };
  } catch {
    return financeiroTotals(fin);
  }
}
