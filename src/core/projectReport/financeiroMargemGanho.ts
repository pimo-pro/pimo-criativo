/**
 * Passo C — Margem de ganho no Relatório Final (opção B).
 * Margem ausente/0: fórmula legacy P3.17 (IVA só materiais).
 * Margem > 0: IVA sobre (base total + margem).
 */

import {
  FINANCEIRO_CUSTO_KEYS,
  FINANCEIRO_CUSTO_MATERIAL_KEYS,
} from "@/core/financeiro/financeiroUnificadoTypes";

import {
  FINANCEIRO_REPORT_LABELS,
  MARGEM_GANHO_LABEL,
  PROJECT_REPORT_IVA_DEFAULT,
  type ProjectReportFinanceiro,
  type ReportFinanceiroLinha,
  type ReportMargemGanhoConfig,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function sumBasePreIva(totalsByKey: Map<string, number>): number {
  return round2(
    FINANCEIRO_CUSTO_KEYS.reduce((s, k) => s + (Number(totalsByKey.get(k)) || 0), 0)
  );
}

export function sumSubtotalMateriais(totalsByKey: Map<string, number>): number {
  return round2(
    FINANCEIRO_CUSTO_MATERIAL_KEYS.reduce((s, k) => s + (Number(totalsByKey.get(k)) || 0), 0)
  );
}

/** Percentagem efectiva da margem (% ou € fixo convertido sobre a base). */
export function effectiveMargemPercentagem(
  config: ReportMargemGanhoConfig | null | undefined,
  basePreIva: number
): number {
  if (!config) return 0;
  if (config.mode === "percentagem") {
    const pct = Number(config.percentagem);
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    return round2(pct);
  }
  const fixo = Number(config.valorFixo);
  if (!Number.isFinite(fixo) || fixo <= 0 || basePreIva <= 0) return 0;
  return round2((fixo / basePreIva) * 100);
}

export function hasActiveMargem(
  config: ReportMargemGanhoConfig | null | undefined,
  basePreIva: number
): boolean {
  return effectiveMargemPercentagem(config, basePreIva) > 0;
}

export type CalcReportTotalsResult = {
  subtotal: number;
  margemValor: number;
  ivaValor: number;
  totalProjeto: number;
};

export function calcReportTotals(
  totalsByKey: Map<string, number>,
  ivaPct: number,
  margemGanho?: ReportMargemGanhoConfig | null
): CalcReportTotalsResult {
  const subtotalMateriais = sumSubtotalMateriais(totalsByKey);
  const basePreIva = sumBasePreIva(totalsByKey);
  const adm = round2(Number(totalsByKey.get("adm")) || 0);
  const montagem = round2(Number(totalsByKey.get("montagem")) || 0);
  const portes = round2(Number(totalsByKey.get("portes")) || 0);
  const extraAdmin = round2(adm + montagem + portes);

  const pct = effectiveMargemPercentagem(margemGanho, basePreIva);

  if (pct <= 0) {
    const ivaValor = round2(subtotalMateriais * (ivaPct / 100));
    const totalProjeto = round2(subtotalMateriais + extraAdmin + ivaValor);
    return { subtotal: subtotalMateriais, margemValor: 0, ivaValor, totalProjeto };
  }

  const margemValor = round2(basePreIva * (pct / 100));
  const totalComMargem = round2(basePreIva + margemValor);
  const ivaValor = round2(totalComMargem * (ivaPct / 100));
  const totalProjeto = round2(totalComMargem + ivaValor);
  return { subtotal: subtotalMateriais, margemValor, ivaValor, totalProjeto };
}

function extractTotalsByKey(fin: ProjectReportFinanceiro): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of fin.linhas) {
    if (l.key === "iva" || l.key === "total" || l.key === "margemGanho") continue;
    map.set(l.key, round2(Number(l.total) || 0));
  }
  for (const key of FINANCEIRO_CUSTO_KEYS) {
    if (!map.has(key)) map.set(key, 0);
  }
  return map;
}

function margemLinhaLabel(pct: number): string {
  if (pct <= 0) return MARGEM_GANHO_LABEL;
  return `${MARGEM_GANHO_LABEL} (${pct}%)`;
}

/** SSOT de totais IVA/total do Relatório (legacy vs margem activa). */
export function finalizeReportFinanceiro(fin: ProjectReportFinanceiro): ProjectReportFinanceiro {
  const ivaPct =
    typeof fin.ivaPct === "number" && Number.isFinite(fin.ivaPct) && fin.ivaPct >= 0
      ? fin.ivaPct
      : PROJECT_REPORT_IVA_DEFAULT;

  const totalsByKey = extractTotalsByKey(fin);
  const basePreIva = sumBasePreIva(totalsByKey);
  const pct = effectiveMargemPercentagem(fin.margemGanho, basePreIva);
  const { subtotal, margemValor, ivaValor, totalProjeto } = calcReportTotals(
    totalsByKey,
    ivaPct,
    fin.margemGanho
  );

  const existingByKey = new Map(fin.linhas.map((l) => [l.key, l]));
  const ordered: ReportFinanceiroLinha[] = [];

  for (const key of FINANCEIRO_CUSTO_KEYS) {
    const existing = existingByKey.get(key);
    ordered.push(
      existing ?? {
        key,
        label: FINANCEIRO_REPORT_LABELS[key],
        quantidade: null,
        precoUnitario: null,
        total: round2(totalsByKey.get(key) ?? 0),
        detalhe: [],
      }
    );
  }

  ordered.push({
    key: "margemGanho",
    label: margemLinhaLabel(pct),
    quantidade: null,
    precoUnitario: null,
    total: margemValor,
    detalhe: [],
  });

  ordered.push({
    key: "iva",
    label: `IVA (${ivaPct}%)`,
    quantidade: null,
    precoUnitario: null,
    total: ivaValor,
    detalhe: [],
  });

  ordered.push({
    key: "total",
    label: "Total do projeto",
    quantidade: null,
    precoUnitario: null,
    total: totalProjeto,
    detalhe: [],
  });

  return {
    ...fin,
    ivaPct,
    linhas: ordered,
    subtotal,
    ivaValor,
    totalProjeto,
  };
}

export function setReportMargemGanho(
  fin: ProjectReportFinanceiro,
  config: ReportMargemGanhoConfig | null
): ProjectReportFinanceiro {
  const next: ProjectReportFinanceiro = config
    ? { ...fin, margemGanho: config }
    : { ...fin, margemGanho: undefined };
  return finalizeReportFinanceiro(next);
}
