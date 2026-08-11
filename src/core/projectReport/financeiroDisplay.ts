/**
 * Helpers de apresentação do bloco Financeiro (P3.18 — só UI, sem alterar totais).
 */

import type { ProjectReportFinanceiro, ReportFinanceiroLinha } from "./types";

/** Linhas técnicas (sem chapasReais oculto, sem IVA/Total de tabela). */
export function financeiroCustoLinhasDisplay(
  linhas: ReportFinanceiroLinha[]
): ReportFinanceiroLinha[] {
  return linhas.filter(
    (l) => l.key !== "chapasReais" && l.key !== "iva" && l.key !== "total"
  );
}

/** Totais exibidos uma única vez — alinhados ao Unificado. */
export function financeiroTotaisDisplay(fin: ProjectReportFinanceiro): {
  subtotal: number;
  ivaPct: number;
  ivaValor: number;
  totalProjeto: number;
} {
  return {
    subtotal: Number(fin.subtotal) || 0,
    ivaPct: Number(fin.ivaPct) || 0,
    ivaValor: Number(fin.ivaValor) || 0,
    totalProjeto: Number(fin.totalProjeto) || 0,
  };
}

export function formatEurDisplay(n: number): string {
  return `${(Number(n) || 0).toFixed(2)} EUR`;
}
