/**
 * P3.27 — Motor de cálculo dinâmico do Relatório Final (camada visual).
 * NÃO altera o SSOT Unificado (ADMIN). Só recalcula detalhe / overrides de apresentação.
 */

import type { FinanceiroCustoKey } from "@/core/financeiro/financeiroUnificadoTypes";
import {
  FINANCEIRO_CUSTO_KEYS,
} from "@/core/financeiro/financeiroUnificadoTypes";

import { applyPrecoPorM2Edit, recalcChapaDetalhe, resolveDimensoesMm } from "./chapasReport";
import type { CatalogoChapaOption } from "./chapasReport";
import type {
  ProjectReportFinanceiro,
  ReportFinanceiroDetalhe,
  ReportFinanceiroLinha,
  ReportMargemGanhoConfig,
} from "./types";
import { calcReportTotals } from "./financeiroMargemGanho";
import { makeReportId } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

/** área = comprimento × largura / 1_000_000 */
export function calcArea(comprimentoMm: number, larguraMm: number): number {
  const L = Math.max(0, Number(comprimentoMm) || 0);
  const A = Math.max(0, Number(larguraMm) || 0);
  return round4((L * A) / 1_000_000);
}

/** €/chapa = €/m² × área */
export function calcChapa(areaM2: number, eurM2: number): number {
  return round2(Math.max(0, Number(areaM2) || 0) * Math.max(0, Number(eurM2) || 0));
}

/** Override: se definido e finito ≥0, substitui a base; senão mantém base. */
export function applyOverride(
  baseValue: number,
  overrideValue: number | null | undefined
): number {
  if (typeof overrideValue === "number" && Number.isFinite(overrideValue) && overrideValue >= 0) {
    return round2(overrideValue);
  }
  return round2(Number(baseValue) || 0);
}

export type OfficialTotalsMap = Partial<Record<FinanceiroCustoKey, number>> & {
  subtotal?: number;
  ivaValor?: number;
  totalProjeto?: number;
  ivaPct?: number;
};

/** Extrai totais oficiais (SSOT) de um financeiro já alinhado ao Unificado. */
export function syncWithUnificado(fin: ProjectReportFinanceiro): OfficialTotalsMap {
  const map: OfficialTotalsMap = {
    subtotal: round2(fin.subtotal),
    ivaValor: round2(fin.ivaValor),
    totalProjeto: round2(fin.totalProjeto),
    ivaPct: fin.ivaPct,
  };
  for (const l of fin.linhas) {
    if (l.key === "iva" || l.key === "total") continue;
    map[l.key as FinanceiroCustoKey] = round2(Number(l.total) || 0);
  }
  return map;
}

/** Soma visual do detalhe (não é SSOT). */
export function sumDetalheVisual(detalhe: ReportFinanceiroDetalhe[]): number {
  return round2(detalhe.reduce((s, d) => s + (Number(d.total) || 0), 0));
}

export type ChapaFieldPatch = {
  comprimentoMm?: number;
  larguraMm?: number;
  espessuraMm?: number;
  quantidade?: number;
  precoPorM2?: number;
  precoUnitario?: number;
  total?: number;
  tipo?: string;
  /** Substituição de material do catálogo. */
  materialOpt?: CatalogoChapaOption;
};

/**
 * Recalcula uma linha de chapa após edição de campo.
 * Regras: área → €/chapa → total (qty × €/chapa).
 * Override directo de precoUnitario/total respeitado se passado explicitamente.
 */
export function rebuildChapaDetalhe(
  row: ReportFinanceiroDetalhe,
  patch: ChapaFieldPatch = {}
): ReportFinanceiroDetalhe {
  let next: ReportFinanceiroDetalhe = { ...row };

  if (patch.materialOpt) {
    const opt = patch.materialOpt;
    next = {
      ...next,
      tipo: opt.label,
      espessuraMm: opt.espessuraMm,
      comprimentoMm: patch.comprimentoMm ?? next.comprimentoMm ?? opt.comprimentoMm,
      larguraMm: patch.larguraMm ?? next.larguraMm ?? opt.larguraMm,
      precoPorM2: opt.precoPorM2,
      precoPorMetro: 0,
    };
  }

  if (patch.tipo !== undefined) next.tipo = patch.tipo;
  if (patch.comprimentoMm !== undefined) next.comprimentoMm = Math.max(0, patch.comprimentoMm);
  if (patch.larguraMm !== undefined) next.larguraMm = Math.max(0, patch.larguraMm);
  if (patch.espessuraMm !== undefined) next.espessuraMm = Math.max(0, patch.espessuraMm);
  if (patch.quantidade !== undefined) next.quantidade = Math.max(0, patch.quantidade);

  if (patch.precoPorM2 !== undefined) {
    return applyPrecoPorM2Edit(
      { ...next, quantidade: next.quantidade },
      Math.max(0, patch.precoPorM2)
    );
  }

  // Override directo de €/chapa: deriva €/m² e total
  if (patch.precoUnitario !== undefined && patch.precoPorM2 === undefined) {
    const dims = resolveDimensoesMm(next);
    const area = calcArea(dims.L, dims.A);
    const unit = Math.max(0, Number(patch.precoUnitario) || 0);
    const eurM2 = area > 0 ? round2(unit / area) : Number(next.precoPorM2) || 0;
    const qty = Math.max(0, Number(next.quantidade) || 0);
    return recalcChapaDetalhe({
      ...next,
      comprimentoMm: dims.L,
      larguraMm: dims.A,
      precoPorM2: eurM2,
      precoUnitario: unit,
      total: patch.total !== undefined ? Math.max(0, patch.total) : round2(qty * unit),
    });
  }

  // Override directo de total da linha de detalhe
  if (patch.total !== undefined && patch.precoUnitario === undefined) {
    const qty = Math.max(0, Number(next.quantidade) || 0);
    const total = Math.max(0, Number(patch.total) || 0);
    const unit = qty > 0 ? round2(total / qty) : total;
    const dims = resolveDimensoesMm(next);
    const area = calcArea(dims.L, dims.A);
    const eurM2 = area > 0 ? round2(unit / area) : Number(next.precoPorM2) || 0;
    return {
      ...recalcChapaDetalhe({
        ...next,
        comprimentoMm: dims.L,
        larguraMm: dims.A,
        precoPorM2: eurM2,
      }),
      precoUnitario: unit,
      total,
    };
  }

  return recalcChapaDetalhe(next);
}

/** Item genérico (não-chapa): qty × unit = total. */
export function rebuildItemDetalhe(
  row: ReportFinanceiroDetalhe,
  patch: Partial<Pick<ReportFinanceiroDetalhe, "tipo" | "quantidade" | "precoUnitario" | "total" | "dimensoes">>
): ReportFinanceiroDetalhe {
  const next = { ...row, ...patch };
  const qty = Math.max(0, Number(next.quantidade) || 0);
  if (patch.total !== undefined && patch.precoUnitario === undefined) {
    const total = Math.max(0, Number(patch.total) || 0);
    return {
      ...next,
      quantidade: qty,
      total,
      precoUnitario: qty > 0 ? round2(total / qty) : total,
    };
  }
  const unit = Math.max(0, Number(next.precoUnitario) || 0);
  return {
    ...next,
    quantidade: qty,
    precoUnitario: unit,
    total: round2(qty * unit),
  };
}

/**
 * Reconstrói a linha visual: detalhe recalculado; total oficial preservado
 * excepto se houver override explícito de linha.
 */
export function rebuildLinhaVisual(
  linha: ReportFinanceiroLinha,
  opts: {
    detalhe?: ReportFinanceiroDetalhe[];
    lineOverride?: number | null;
    officialTotal: number;
    asChapas?: boolean;
  }
): ReportFinanceiroLinha {
  const detalhe = (opts.detalhe ?? linha.detalhe ?? []).map((d) =>
    opts.asChapas ? recalcChapaDetalhe(d) : rebuildItemDetalhe(d, {})
  );
  const total = applyOverride(opts.officialTotal, opts.lineOverride);
  return {
    ...linha,
    detalhe,
    total,
    quantidade: null,
    precoUnitario: null,
  };
}

export type EmitTotalFinalResult = {
  subtotal: number;
  ivaValor: number;
  totalProjeto: number;
  /** Totais oficiais SSOT (sem overrides). */
  official: OfficialTotalsMap;
  /** true se algum override activo. */
  hasOverrides: boolean;
};

/**
 * Emite totais finais de apresentação a partir dos oficiais + overrides de linha.
 * IVA só sobre materiais (fórmula ADMIN).
 */
export function emitTotalFinal(
  official: OfficialTotalsMap,
  lineOverrides: Partial<Record<FinanceiroCustoKey, number>> | null | undefined,
  ivaPct = 23,
  margemGanho?: ReportMargemGanhoConfig | null
): EmitTotalFinalResult {
  const ov = lineOverrides ?? {};
  const hasOverrides = Object.keys(ov).some((k) => {
    const v = ov[k as FinanceiroCustoKey];
    return typeof v === "number" && Number.isFinite(v);
  });

  const totalsByKey = new Map<string, number>();
  for (const key of FINANCEIRO_CUSTO_KEYS) {
    const base = Number(official[key]) || 0;
    totalsByKey.set(key, applyOverride(base, ov[key]));
  }

  const pct =
    typeof official.ivaPct === "number" && Number.isFinite(official.ivaPct)
      ? official.ivaPct
      : ivaPct;

  const { subtotal, ivaValor, totalProjeto } = calcReportTotals(
    totalsByKey,
    pct,
    margemGanho
  );

  return {
    subtotal,
    ivaValor,
    totalProjeto,
    official,
    hasOverrides,
  };
}

/** Linha de chapa vazia (sem fallback ao catálogo). */
export function createManualChapaDetalhe(): ReportFinanceiroDetalhe {
  return rebuildChapaDetalhe({
    id: makeReportId("ch"),
    tipo: "",
    dimensoes: "",
    comprimentoMm: 0,
    larguraMm: 0,
    espessuraMm: 0,
    quantidade: 1,
    precoPorM2: 0,
    precoPorMetro: 0,
    precoUnitario: 0,
    total: 0,
  });
}

/** Nova chapa vazia / do catálogo. */
export function createEmptyChapaDetalhe(
  opt?: CatalogoChapaOption | null
): ReportFinanceiroDetalhe {
  if (opt) {
    return rebuildChapaDetalhe({
      id: makeReportId("ch"),
      tipo: opt.label,
      dimensoes: opt.medidaDefault,
      comprimentoMm: opt.comprimentoMm,
      larguraMm: opt.larguraMm,
      espessuraMm: opt.espessuraMm,
      quantidade: 1,
      precoPorM2: opt.precoPorM2,
      precoPorMetro: 0,
      precoUnitario: 0,
      total: 0,
    });
  }
  return createManualChapaDetalhe();
}

export function createEmptyItemDetalhe(tipo = "Item"): ReportFinanceiroDetalhe {
  return {
    id: makeReportId("it"),
    tipo,
    dimensoes: "",
    quantidade: 1,
    precoUnitario: 0,
    total: 0,
  };
}

/** Anexa detalhe a uma key sem alterar totais oficiais das outras linhas. */
export function setLinhaDetalheVisual(
  fin: ProjectReportFinanceiro,
  key: FinanceiroCustoKey,
  detalhe: ReportFinanceiroDetalhe[],
  asChapas = false
): ProjectReportFinanceiro {
  const snap = fin.officialSnapshot ?? syncWithUnificado(fin);
  const officialTotal =
    key === "chapasReais"
      ? 0
      : typeof snap[key] === "number"
        ? Number(snap[key])
        : round2(Number(fin.linhas.find((l) => l.key === key)?.total) || 0);

  const lineOverride = fin.lineOverrides?.[key];

  return {
    ...fin,
    officialSnapshot: snap,
    linhas: fin.linhas.map((l) => {
      if (l.key !== key) {
        // Espelho visual em chapasReais quando editamos Painéis
        if (key === "paineis" && l.key === "chapasReais") {
          return {
            ...l,
            detalhe: asChapas ? detalhe.map((d) => recalcChapaDetalhe(d)) : detalhe,
            total: 0,
            quantidade: null,
            precoUnitario: null,
          };
        }
        return l;
      }
      return rebuildLinhaVisual(l, {
        detalhe,
        lineOverride,
        officialTotal,
        asChapas,
      });
    }),
  };
}

/** Lista de keys com accordion dinâmico (todas excepto espelho chapasReais / iva / total). */
export const DYNAMIC_DETALHE_KEYS: FinanceiroCustoKey[] = FINANCEIRO_CUSTO_KEYS.filter(
  (k) => k !== "chapasReais"
);
