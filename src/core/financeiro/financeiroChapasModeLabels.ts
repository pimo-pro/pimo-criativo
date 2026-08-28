/**
 * Labels UI para modo de chapas (Financeiro Unificado / badges).
 * Semântica:
 * - oficial_pro → nesting PRO/TCN (único oficial para N e €)
 * - estimado → fast/área (N visível + monetização preliminar N×€/chapa ou Σ sheets)
 * - real → legado (até passo 5: nesting com sheets[], tipicamente fast)
 */

import type { FinanceiroChapasMode } from "./financeiroUnificadoTypes";

export function isChapasModeOficial(mode: FinanceiroChapasMode): boolean {
  return mode === "oficial_pro";
}

export function isChapasModeEstimado(mode: FinanceiroChapasMode): boolean {
  return mode === "estimado";
}

export function financeiroChapasMetricLabel(mode: FinanceiroChapasMode): string {
  switch (mode) {
    case "oficial_pro":
      return "Nº de chapas (Oficial TCN/PRO)";
    case "estimado":
      return "Nº de chapas (Estimado)";
    case "real":
    default:
      return "Nº de chapas (Real)";
  }
}

export function financeiroChapasBadgeLabel(mode: FinanceiroChapasMode): string {
  switch (mode) {
    case "oficial_pro":
      return "Oficial (TCN/PRO)";
    case "estimado":
      return "Estimado — pode diferir do TCN final";
    case "real":
    default:
      return "Real";
  }
}

/** Aviso sob a métrica quando mode=estimado. */
export function financeiroChapasEstimadoHint(): string {
  return (
    "Estimado — pode diferir do TCN final. " +
    "Painéis usa N × €/chapa (ou Σ sheets fast) como preliminar; o valor oficial vem do nesting PRO/TCN."
  );
}
