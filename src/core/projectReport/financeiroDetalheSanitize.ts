/**
 * P3.23 — Sanitização do detalhe Financeiro (custos dinâmicos).
 * Remove blocos inexistentes e nomes de peças do caixa.
 */

import type { ReportFinanceiroDetalhe } from "./types";

/** Nomes internos de peças / componentes — não pertencem ao Financeiro. */
const PECA_CAIXA_RE =
  /^(cima|fundo|lado|laterais?|frente|costa|prateleira|divis[oó]ria|separador|gav[_-]|porta)(\b|[_\s(]|$)/i;

export function isPregoParaCostaTipo(tipo: string): boolean {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (!t) return false;
  if (t === "prego_costa" || t.includes("prego_costa")) return true;
  return t.includes("prego") && t.includes("costa");
}

export function isPecaCaixaTipo(tipo: string): boolean {
  const t = String(tipo ?? "").trim();
  if (!t) return false;
  if (/\(cat[aá]logo\)/i.test(t)) return true;
  return PECA_CAIXA_RE.test(t);
}

/** Linha de detalhe inválida para a UI Financeiro. */
export function isInvalidFinanceiroDetalheTipo(tipo: string): boolean {
  return isPregoParaCostaTipo(tipo) || isPecaCaixaTipo(tipo);
}

export function sanitizeFinanceiroDetalhe(
  detalhe: ReportFinanceiroDetalhe[] | null | undefined
): ReportFinanceiroDetalhe[] {
  return (detalhe ?? []).filter((d) => !isInvalidFinanceiroDetalheTipo(d.tipo));
}
