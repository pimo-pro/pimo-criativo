/**
 * P3.22 — financeiroAdapter (fluxo original do Relatório Final).
 * Adapta ProjectState → modelo financeiro para UI detalhada.
 * NÃO usa computeFinanceiroUnificado para construir linhas/detalhe.
 */

import type { ProjectState } from "@/context/projectTypes";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  FINANCEIRO_REPORT_LABELS,
  PROJECT_REPORT_IVA_DEFAULT,
  type ProjectReportFinanceiro,
  type ReportFinanceiroLinha,
} from "./types";

export type FinanceiroAdapterModel = {
  projectId: string;
  state: ProjectState | null;
  ivaPct: number;
  /** Totais de categoria (baseline UI); detalhe preenchido pelas industrial rules. */
  custos: Record<FinanceiroCustoKey, number>;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function emptyCustos(): Record<FinanceiroCustoKey, number> {
  const out = {} as Record<FinanceiroCustoKey, number>;
  for (const key of FINANCEIRO_CUSTO_KEYS) out[key] = 0;
  return out;
}

/**
 * Adapta o estado do projecto para o modelo financeiro da página
 * «Financeiro (custos dinâmicos)» — estrutura antiga, sem Unificado.
 */
export function financeiroAdapter(
  state: ProjectState | null | undefined,
  projectId: string
): FinanceiroAdapterModel {
  const ivaPct =
    typeof state?.financeiroOverrides?.ivaPct === "number" &&
    Number.isFinite(state.financeiroOverrides.ivaPct) &&
    state.financeiroOverrides.ivaPct >= 0
      ? state.financeiroOverrides.ivaPct
      : PROJECT_REPORT_IVA_DEFAULT;

  const custos = emptyCustos();
  const overrides = state?.financeiroOverrides?.custos;
  if (overrides) {
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      const v = overrides[key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        custos[key] = round2(v);
      }
    }
  }

  return {
    projectId: String(projectId || "").trim(),
    state: state ?? null,
    ivaPct,
    custos,
  };
}

/** Converte o modelo adaptado em shape do relatório (sem IVA/Total ainda). */
export function adapterModelToFinanceiroShape(
  model: FinanceiroAdapterModel
): ProjectReportFinanceiro {
  const linhas: ReportFinanceiroLinha[] = FINANCEIRO_CUSTO_KEYS.map((key) => ({
    key,
    label: FINANCEIRO_REPORT_LABELS[key],
    quantidade: null,
    precoUnitario: null,
    total: round2(model.custos[key] ?? 0),
    detalhe: [],
  }));
  return {
    ivaPct: model.ivaPct,
    linhas,
    subtotal: 0,
    ivaValor: 0,
    totalProjeto: 0,
  };
}
