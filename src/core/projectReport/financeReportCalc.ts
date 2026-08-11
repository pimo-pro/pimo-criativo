/**
 * Calculos financeiros do relatorio — alinhados ao Financeiro Unificado (ADMIN).
 * P3.17: IVA só sobre materiais; ADM/montagem/portes fora da base de IVA.
 */

import {
  FINANCEIRO_CUSTO_KEYS,
  FINANCEIRO_CUSTO_MATERIAL_KEYS,
} from "../financeiro/financeiroUnificadoTypes";
import type { FinanceiroCustoKey } from "../financeiro/financeiroUnificadoTypes";
import { recalcChapaDetalhe } from "./chapasReport";
import {
  FINANCEIRO_REPORT_LABELS,
  PROJECT_REPORT_IVA_DEFAULT,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportFinanceiroLinha,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const ADMIN_EXTRA_KEYS: FinanceiroCustoKey[] = ["adm", "montagem", "portes"];

export function lineTotalFromQtyPrice(
  quantidade: number | null,
  precoUnitario: number | null,
  fallbackTotal = 0
): number {
  if (
    typeof quantidade === "number" &&
    Number.isFinite(quantidade) &&
    typeof precoUnitario === "number" &&
    Number.isFinite(precoUnitario)
  ) {
    return round2(quantidade * precoUnitario);
  }
  return round2(fallbackTotal);
}

export function recalcDetalhe(d: ReportFinanceiroDetalhe): ReportFinanceiroDetalhe {
  const hasChapaMeta =
    (typeof d.precoPorMetro === "number" && d.precoPorMetro > 0) ||
    (typeof d.comprimentoMm === "number" && d.comprimentoMm > 0) ||
    (typeof d.precoPorM2 === "number" && d.precoPorM2 > 0) ||
    (typeof d.areaChapaM2 === "number" && d.areaChapaM2 > 0) ||
    (typeof d.espessuraMm === "number" && d.espessuraMm > 0);

  if (hasChapaMeta) {
    return recalcChapaDetalhe(d);
  }

  return {
    ...d,
    total: lineTotalFromQtyPrice(d.quantidade, d.precoUnitario, d.total),
  };
}

export function recalcLinha(linha: ReportFinanceiroLinha): ReportFinanceiroLinha {
  if (linha.key === "iva" || linha.key === "total") return linha;

  const detalhe = (linha.detalhe ?? []).map(recalcDetalhe);
  if (detalhe.length > 0) {
    const total = round2(detalhe.reduce((s, d) => s + (Number(d.total) || 0), 0));
    const quantidade = round2(detalhe.reduce((s, d) => s + (Number(d.quantidade) || 0), 0));
    return {
      ...linha,
      detalhe,
      quantidade,
      precoUnitario: quantidade > 0 ? round2(total / quantidade) : linha.precoUnitario,
      total,
    };
  }

  return {
    ...linha,
    detalhe,
    total: lineTotalFromQtyPrice(linha.quantidade, linha.precoUnitario, linha.total),
  };
}

/** Recalcula subtotal, IVA e total — fórmula ADMIN (P3.17). */
export function recalcFinanceiro(fin: ProjectReportFinanceiro): ProjectReportFinanceiro {
  const ivaPct =
    typeof fin.ivaPct === "number" && Number.isFinite(fin.ivaPct) && fin.ivaPct >= 0
      ? fin.ivaPct
      : PROJECT_REPORT_IVA_DEFAULT;

  const custoLinhas = fin.linhas
    .filter((l) => l.key !== "iva" && l.key !== "total")
    .map(recalcLinha);

  const byKey = new Map(custoLinhas.map((l) => [l.key, l]));

  const subtotalMateriais = round2(
    FINANCEIRO_CUSTO_MATERIAL_KEYS.reduce((s, k) => s + (Number(byKey.get(k)?.total) || 0), 0)
  );
  const extraAdmin = round2(
    ADMIN_EXTRA_KEYS.reduce((s, k) => s + (Number(byKey.get(k)?.total) || 0), 0)
  );
  const ivaValor = round2(subtotalMateriais * (ivaPct / 100));
  const totalProjeto = round2(subtotalMateriais + extraAdmin + ivaValor);

  const ordered: ReportFinanceiroLinha[] = [];

  for (const key of FINANCEIRO_CUSTO_KEYS) {
    const existing = byKey.get(key);
    ordered.push(
      existing ?? {
        key,
        label: FINANCEIRO_REPORT_LABELS[key],
        quantidade: null,
        precoUnitario: null,
        total: 0,
        detalhe: [],
      }
    );
  }

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
    ivaPct,
    linhas: ordered,
    subtotal: subtotalMateriais,
    ivaValor,
    totalProjeto,
  };
}

export function updateFinanceiroLinha(
  fin: ProjectReportFinanceiro,
  key: FinanceiroCustoKey,
  patch: Partial<Pick<ReportFinanceiroLinha, "quantidade" | "precoUnitario" | "detalhe">>
): ProjectReportFinanceiro {
  const linhas = fin.linhas.map((l) => {
    if (l.key !== key) return l;
    const next: ReportFinanceiroLinha = { ...l, ...patch };
    if (
      patch.detalhe === undefined &&
      (patch.quantidade !== undefined || patch.precoUnitario !== undefined)
    ) {
      next.detalhe = [];
      next.total = lineTotalFromQtyPrice(
        patch.quantidade !== undefined ? patch.quantidade : l.quantidade,
        patch.precoUnitario !== undefined ? patch.precoUnitario : l.precoUnitario,
        l.total
      );
    } else if (patch.quantidade !== undefined || patch.precoUnitario !== undefined) {
      next.total = lineTotalFromQtyPrice(
        patch.quantidade !== undefined ? patch.quantidade : l.quantidade,
        patch.precoUnitario !== undefined ? patch.precoUnitario : l.precoUnitario,
        l.total
      );
    }
    return next;
  });
  return recalcFinanceiro({ ...fin, linhas });
}

export function ensureFinanceiroShape(
  partial: Partial<ProjectReportFinanceiro> | null | undefined,
  seedTotals?: Partial<Record<FinanceiroCustoKey, number>>
): ProjectReportFinanceiro {
  const existing = new Map((partial?.linhas ?? []).map((l) => [l.key, l]));
  const linhas: ReportFinanceiroLinha[] = FINANCEIRO_CUSTO_KEYS.map((key) => {
    const prev = existing.get(key);
    if (prev) return prev;
    return {
      key,
      label: FINANCEIRO_REPORT_LABELS[key],
      quantidade: null,
      precoUnitario: null,
      total: round2(seedTotals?.[key] ?? 0),
      detalhe: [],
    };
  });
  return recalcFinanceiro({
    ivaPct: partial?.ivaPct ?? PROJECT_REPORT_IVA_DEFAULT,
    linhas,
    subtotal: 0,
    ivaValor: 0,
    totalProjeto: 0,
  });
}
