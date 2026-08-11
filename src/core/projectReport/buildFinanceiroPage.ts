/**
 * P3.22 — Orquestração do fluxo original:
 * state → financeiroAdapter → financeiroIndustrialRules → financeiroTotals → UI
 */

import type { ProjectState } from "@/context/projectTypes";
import type { Ferragem } from "@/core/ferragens/ferragens";
import type { MaterialIndustrial } from "@/core/manufacturing/materials";

import { financeiroAdapter } from "./financeiroAdapter";
import { financeiroIndustrialRules } from "./financeiroIndustrialRules";
import { alignOfficialTotalsToUnificado, financeiroTotals } from "./financeiroTotals";
import type { ProjectReportFinanceiro, ReportMaterialLinha } from "./types";

export type BuildFinanceiroPageOptions = {
  materiais?: ReportMaterialLinha[];
  ferragensCatalog?: Ferragem[];
  materials?: MaterialIndustrial[];
  /** Se true (default), alinha subtotal/IVA/Total ao Unificado (SSOT). */
  alignOfficialTotals?: boolean;
};

/**
 * Constrói o financeiro da página «custos dinâmicos» pelo fluxo antigo.
 * Detalhe UI: adapter + industrial rules (sem Unificado).
 * Totais oficiais: alinhados ao Unificado quando alignOfficialTotals≠false.
 */
export function buildFinanceiroPageFromState(
  state: ProjectState | null | undefined,
  projectId: string,
  opts: BuildFinanceiroPageOptions = {}
): ProjectReportFinanceiro {
  const model = financeiroAdapter(state, projectId);
  const ruled = financeiroIndustrialRules({
    model,
    materiais: opts.materiais ?? [],
    ferragensCatalog: opts.ferragensCatalog ?? [],
  });
  const totaled = financeiroTotals(ruled);
  if (opts.alignOfficialTotals === false) return totaled;
  return alignOfficialTotalsToUnificado(totaled, state ?? null, opts.materials ?? []);
}
