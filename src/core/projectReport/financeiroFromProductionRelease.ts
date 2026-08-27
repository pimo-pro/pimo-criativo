/**
 * F1/F2 — Financeiro do Relatório a partir do productionRelease (última geração TCN).
 * Não chama Unificado live nem nesting FAST.
 * F2: preenche detalhe accordion a partir de chapas.sheets e ferragens.lines.
 */

import { FINANCEIRO_CUSTO_KEYS } from "@/core/financeiro/financeiroUnificadoTypes";
import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import type { ProductionRelease } from "@/core/industrial/productionRelease";
import { priceChapasSheetsEur } from "@/core/financeiro/priceChapasSheetsEur";
import { aggregateChapasByEspessuraEMaterial, recalcChapaDetalhe } from "./chapasReport";
import {
  buildFerragensVisual,
  visualToDetalhe,
  type FerragemUnificadoLine,
} from "./financeiroFerragensEngine";
import { finalizeReportFinanceiro } from "./financeiroMargemGanho";
import { applyReportLineOverrides } from "./financeiroOverrides";
import {
  FINANCEIRO_REPORT_LABELS,
  PROJECT_REPORT_IVA_DEFAULT,
  emptyFinanceiro,
  type ProjectReport,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportFerragensOverridesMap,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function pricePaineisFromReleaseChapas(
  release: ProductionRelease
): { totalEur: number; sheetCount: number } {
  return priceChapasSheetsEur(release.chapas?.sheets ?? []);
}

export function detalhePaineisFromRelease(
  release: ProductionRelease
): ReportFinanceiroDetalhe[] {
  return aggregateChapasByEspessuraEMaterial(release.chapas?.sheets ?? []).map((row) =>
    recalcChapaDetalhe(row)
  );
}

export function releaseFerragensAsUnificadoLines(
  release: ProductionRelease
): FerragemUnificadoLine[] {
  return (release.ferragens?.lines ?? []).map((l) => ({
    ferragemId: l.ferragemId,
    nome: l.nome,
    quantidade: l.quantidade,
    precoUnitario: l.precoUnitario,
    precoTotal: l.precoTotal,
    observacoes: l.observacoes,
    origemPreco: l.origemPreco,
  }));
}

export function detalheFerragensFromRelease(
  release: ProductionRelease,
  itemOverrides?: ReportFerragensOverridesMap | null
): ReportFinanceiroDetalhe[] {
  return visualToDetalhe(
    buildFerragensVisual(releaseFerragensAsUnificadoLines(release), itemOverrides)
  );
}

export function buildFinanceiroFromProductionRelease(
  release: ProductionRelease | null,
  opts?: {
    lineOverrides?: ProjectReportFinanceiro["lineOverrides"];
    margemGanho?: ProjectReportFinanceiro["margemGanho"];
    ivaPct?: number;
    ferragensOverrides?: ReportFerragensOverridesMap;
  }
): ProjectReportFinanceiro {
  if (!release) {
    return emptyFinanceiro();
  }

  const paineis = pricePaineisFromReleaseChapas(release);
  const ferragensEur = round2(Number(release.ferragens.totalEur) || 0);
  const ferragensQty = Number(release.ferragens.totalQty) || 0;
  const paineisDetalhe = detalhePaineisFromRelease(release);
  const ferragensDetalhe = detalheFerragensFromRelease(release, opts?.ferragensOverrides);

  const officialSnapshot: ProjectReportFinanceiro["officialSnapshot"] = {};
  const linhas = FINANCEIRO_CUSTO_KEYS.map((key: FinanceiroCustoKey) => {
    let total = 0;
    let quantidade: number | null = null;
    let detalhe: ReportFinanceiroDetalhe[] = [];
    if (key === "paineis") {
      total = paineis.totalEur;
      quantidade = paineis.sheetCount;
      detalhe = paineisDetalhe;
    } else if (key === "ferragens") {
      total = ferragensEur;
      quantidade = ferragensQty;
      detalhe = ferragensDetalhe;
    }
    officialSnapshot[key] = total;
    return {
      key,
      label: FINANCEIRO_REPORT_LABELS[key],
      quantidade,
      precoUnitario: null,
      total,
      detalhe,
    };
  });

  const base: ProjectReportFinanceiro = {
    ivaPct: opts?.ivaPct ?? PROJECT_REPORT_IVA_DEFAULT,
    linhas,
    subtotal: 0,
    ivaValor: 0,
    totalProjeto: 0,
    paineisOrigem: "oficial_pro",
    officialSnapshot,
    lineOverrides: opts?.lineOverrides,
    margemGanho: opts?.margemGanho,
    overrides: opts?.ferragensOverrides
      ? { ferragens: opts.ferragensOverrides }
      : undefined,
  };

  const withOverrides = opts?.lineOverrides
    ? applyReportLineOverrides(base, opts.lineOverrides)
    : finalizeReportFinanceiro(base);
  return withOverrides;
}

export function withProductionReleaseFinanceiro(
  report: ProjectReport,
  release: ProductionRelease | null
): ProjectReport {
  return {
    ...report,
    financeiro: buildFinanceiroFromProductionRelease(release, {
      lineOverrides: report.financeiro?.lineOverrides,
      margemGanho: report.financeiro?.margemGanho,
      ivaPct: report.financeiro?.ivaPct,
      ferragensOverrides: report.financeiro?.overrides?.ferragens,
    }),
  };
}
