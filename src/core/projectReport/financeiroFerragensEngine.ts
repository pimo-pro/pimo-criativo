/**
 * P3.28 — Motor visual de Ferragens no Relatório Final (Financeiro).
 * NÃO altera o SSOT Unificado. Só reconstrói a lista editável e persistida.
 */

import type { ProjectState } from "@/context/projectTypes";
import {
  computeFerragensUnificadoSsot,
  type FerragemOrigemPrecoSsot,
} from "@/core/financeiro/ferragensUnificadoLines";
import { loadFerragensCatalogForPricing } from "@/core/financeiro/priceFerragensFromCatalog";
import type { Ferragem } from "@/core/ferragens/ferragens";

import { applyOverride as applyOverrideShared } from "./financeiroDynamicEngine";
import {
  makeReportId,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportFerragemItemOverride,
  type ReportFerragensOverridesMap,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type FerragemOrigemPreco = "catalogo" | "unificado" | "fallback" | "override" | "manual";

export type FerragemUnificadoLine = {
  ferragemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  /** Total SSOT agregado (paridade com Unificado). */
  precoTotal: number;
  observacoes: string;
  origemPreco: FerragemOrigemPreco | FerragemOrigemPrecoSsot;
};

export type FerragemVisualItem = {
  id: string;
  ferragemId: string;
  tipo: string;
  quantidade: number;
  precoUnitario: number;
  observacoes: string;
  total: number;
  isOverride: boolean;
  origemPreco: FerragemOrigemPreco;
  officialQuantidade: number;
  officialPrecoUnitario: number;
};

export function applyOverride(
  baseValue: number,
  overrideValue: number | null | undefined
): number {
  return applyOverrideShared(baseValue, overrideValue);
}

export function calcTotal(qtd: number, precoUnit: number): number {
  return round2(Math.max(0, Number(qtd) || 0) * Math.max(0, Number(precoUnit) || 0));
}

export function listCatalogoFerragens(): Ferragem[] {
  return loadFerragensCatalogForPricing();
}

export function collectUnificadoFerragens(
  state: ProjectState | null | undefined,
  catalog: Ferragem[] = listCatalogoFerragens()
): FerragemUnificadoLine[] {
  if (!state) return [];
  const ssot = computeFerragensUnificadoSsot(state, catalog);
  return ssot.lines.map((l) => ({
    ferragemId: l.ferragemId,
    nome: l.nome,
    quantidade: l.quantidade,
    precoUnitario: l.precoUnitario,
    precoTotal: l.precoTotal,
    observacoes: l.observacoes,
    origemPreco: l.origemPreco,
  }));
}

export function visualFerragemId(ferragemId: string): string {
  return `ferr-${ferragemId}`;
}

export function buildFerragensVisual(
  unificadoFerragens: FerragemUnificadoLine[],
  overrides: ReportFerragensOverridesMap | null | undefined
): FerragemVisualItem[] {
  const ov = overrides ?? {};
  const items: FerragemVisualItem[] = [];

  for (const base of unificadoFerragens) {
    const id = visualFerragemId(base.ferragemId);
    const itemOv = ov[id] ?? ov[base.ferragemId];
    if (itemOv?.removed) continue;

    const quantidade = applyOverride(base.quantidade, itemOv?.quantidade);
    const precoUnitario = applyOverride(base.precoUnitario, itemOv?.precoUnitario);
    const tipo = itemOv?.tipo?.trim() ? itemOv.tipo : base.nome;
    const observacoes =
      itemOv?.observacoes !== undefined ? itemOv.observacoes : base.observacoes;
    const total =
      itemOv?.total !== undefined && Number.isFinite(itemOv.total)
        ? round2(itemOv.total)
        : round2(base.precoTotal ?? calcTotal(quantidade, precoUnitario));
    const isOverride = Boolean(
      itemOv &&
        (itemOv.quantidade !== undefined ||
          itemOv.precoUnitario !== undefined ||
          itemOv.total !== undefined ||
          itemOv.tipo !== undefined ||
          itemOv.observacoes !== undefined)
    );

    items.push({
      id,
      ferragemId: base.ferragemId,
      tipo,
      quantidade,
      precoUnitario,
      observacoes,
      total,
      isOverride,
      origemPreco: isOverride ? "override" : base.origemPreco,
      officialQuantidade: base.quantidade,
      officialPrecoUnitario: base.precoUnitario,
    });
  }

  for (const [id, itemOv] of Object.entries(ov)) {
    if (!itemOv?.added || itemOv.removed) continue;
    if (items.some((i) => i.id === id)) continue;
    const quantidade = Math.max(0, Number(itemOv.quantidade) || 0);
    const precoUnitario = Math.max(0, Number(itemOv.precoUnitario) || 0);
    items.push({
      id,
      ferragemId: id,
      tipo: itemOv.tipo?.trim() || "Ferragem",
      quantidade,
      precoUnitario,
      observacoes: itemOv.observacoes ?? "",
      total:
        itemOv.total !== undefined ? round2(itemOv.total) : calcTotal(quantidade, precoUnitario),
      isOverride: true,
      origemPreco: "manual",
      officialQuantidade: 0,
      officialPrecoUnitario: 0,
    });
  }

  return items;
}

export function emitFerragensTotalVisual(items: Array<{ total?: number }>): number {
  return round2(items.reduce((s, i) => s + (Number(i.total) || 0), 0));
}

export function visualToDetalhe(items: FerragemVisualItem[]): ReportFinanceiroDetalhe[] {
  return items.map((i) => ({
    id: i.id,
    tipo: i.tipo,
    dimensoes: i.observacoes,
    quantidade: i.quantidade,
    precoUnitario: i.precoUnitario,
    total: i.total,
    ferragemId: i.ferragemId,
  }));
}

export function detalheToOverrides(
  detalhe: ReportFinanceiroDetalhe[],
  unificadoFerragens: FerragemUnificadoLine[]
): ReportFerragensOverridesMap {
  const baseById = new Map(unificadoFerragens.map((b) => [visualFerragemId(b.ferragemId), b]));
  const out: ReportFerragensOverridesMap = {};
  const seen = new Set<string>();

  for (const d of detalhe) {
    const id = d.id || visualFerragemId(d.ferragemId || d.tipo);
    seen.add(id);
    const base =
      baseById.get(id) ??
      unificadoFerragens.find((b) => b.ferragemId === d.ferragemId || b.nome === d.tipo);
    if (!base) {
      out[id] = {
        added: true,
        tipo: d.tipo,
        quantidade: d.quantidade,
        precoUnitario: d.precoUnitario,
        total: d.total,
        observacoes: d.dimensoes,
      };
      continue;
    }
    const ov: ReportFerragemItemOverride = {};
    if (d.tipo !== base.nome) ov.tipo = d.tipo;
    if (round2(d.quantidade) !== round2(base.quantidade)) ov.quantidade = d.quantidade;
    if (round2(d.precoUnitario) !== round2(base.precoUnitario)) {
      ov.precoUnitario = d.precoUnitario;
    }
    const expectedTotal = calcTotal(
      ov.quantidade ?? base.quantidade,
      ov.precoUnitario ?? base.precoUnitario
    );
    if (round2(d.total) !== expectedTotal) ov.total = d.total;
    if ((d.dimensoes || "") !== (base.observacoes || "")) ov.observacoes = d.dimensoes;
    if (Object.keys(ov).length > 0) out[id] = ov;
  }

  for (const base of unificadoFerragens) {
    const id = visualFerragemId(base.ferragemId);
    if (!seen.has(id)) out[id] = { removed: true };
  }
  return out;
}

/** Grava lista visual + overrides.ferragens sem alterar o snapshot SSOT. */
export function persistFerragensVisual(
  fin: ProjectReportFinanceiro,
  detalhe: ReportFinanceiroDetalhe[],
  unificadoFerragens: FerragemUnificadoLine[] = []
): ProjectReportFinanceiro {
  const mapped = detalhe.map((d) => {
    const qty = Math.max(0, Number(d.quantidade) || 0);
    const unit = Math.max(0, Number(d.precoUnitario) || 0);
    return {
      ...d,
      quantidade: qty,
      precoUnitario: unit,
      total: calcTotal(qty, unit),
    };
  });
  const ferragensOv = detalheToOverrides(mapped, unificadoFerragens);
  const official =
    typeof fin.officialSnapshot?.ferragens === "number"
      ? Number(fin.officialSnapshot.ferragens)
      : round2(Number(fin.linhas.find((l) => l.key === "ferragens")?.total) || 0);

  return {
    ...fin,
    overrides: {
      ...(fin.overrides ?? {}),
      ferragens: Object.keys(ferragensOv).length > 0 ? ferragensOv : undefined,
    },
    linhas: fin.linhas.map((l) =>
      l.key === "ferragens"
        ? {
            ...l,
            detalhe: mapped,
            quantidade: null,
            precoUnitario: null,
            total: applyOverride(official, fin.lineOverrides?.ferragens),
          }
        : l
    ),
  };
}

export function withFerragensDetalhe(
  fin: ProjectReportFinanceiro,
  detalhe: ReportFinanceiroDetalhe[]
): ProjectReportFinanceiro {
  return {
    ...fin,
    linhas: fin.linhas.map((l) =>
      l.key === "ferragens"
        ? { ...l, detalhe, quantidade: null, precoUnitario: null }
        : l
    ),
  };
}

export function getFerragensOverrides(
  fin: ProjectReportFinanceiro | null | undefined
): ReportFerragensOverridesMap {
  return fin?.overrides?.ferragens ?? {};
}

export function findFerragemInCatalog(
  nome: string,
  catalog: Ferragem[] = listCatalogoFerragens()
): Ferragem | undefined {
  const t = nome.trim();
  if (!t) return undefined;
  return catalog.find((c) => c.nome === t || c.id === t);
}

/** Actualiza nome: catálogo → preços; manual → tipo livre. */
export function patchFerragemNome(
  row: ReportFinanceiroDetalhe,
  nome: string,
  catalog: Ferragem[] = listCatalogoFerragens()
): ReportFinanceiroDetalhe {
  const opt = findFerragemInCatalog(nome, catalog);
  if (opt) return applyFerragemCatalogOpt(row, opt);
  return rebuildFerragemDetalhe(row, {
    tipo: nome,
    ferragemId: row.id,
  });
}

export function createEmptyFerragemDetalhe(
  opt?: Ferragem | null,
  opts?: { manual?: boolean }
): ReportFinanceiroDetalhe {
  const id = makeReportId("ferr");
  const qty = 1;
  if (opts?.manual) {
    return {
      id,
      ferragemId: id,
      tipo: "",
      dimensoes: "",
      quantidade: qty,
      precoUnitario: 0,
      total: 0,
    };
  }
  const unit = Math.max(0, Number(opt?.precoUnitario) || 0);
  return {
    id,
    ferragemId: opt?.id ?? id,
    tipo: opt?.nome ?? "Ferragem",
    dimensoes: opt?.medidas ?? "",
    quantidade: qty,
    precoUnitario: unit,
    total: calcTotal(qty, unit),
  };
}

export function rebuildFerragemDetalhe(
  row: ReportFinanceiroDetalhe,
  patch: Partial<
    Pick<
      ReportFinanceiroDetalhe,
      "tipo" | "quantidade" | "precoUnitario" | "total" | "dimensoes" | "ferragemId"
    >
  >
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
    total: calcTotal(qty, unit),
  };
}

export function applyFerragemCatalogOpt(
  row: ReportFinanceiroDetalhe,
  opt: Ferragem
): ReportFinanceiroDetalhe {
  return rebuildFerragemDetalhe(row, {
    ferragemId: opt.id,
    tipo: opt.nome,
    dimensoes: opt.medidas ?? row.dimensoes,
    precoUnitario: Math.max(0, Number(opt.precoUnitario) || 0),
  });
}

export function origemPrecoLabel(origem: FerragemOrigemPreco): string {
  switch (origem) {
    case "catalogo":
      return "cat\u00e1logo B";
    case "fallback":
      return "fallback A";
    case "unificado":
      return "Unificado";
    case "override":
      return "override";
    case "manual":
      return "manual";
    default:
      return origem;
  }
}

export function resolveOrigemPrecoLinha(
  row: ReportFinanceiroDetalhe,
  overrides: ReportFerragensOverridesMap | null | undefined,
  baseOrigem?: FerragemOrigemPreco
): FerragemOrigemPreco {
  const ov = overrides?.[row.id] ?? (row.ferragemId ? overrides?.[row.ferragemId] : undefined);
  if (ov?.added) return "manual";
  if (ov && (ov.precoUnitario !== undefined || ov.total !== undefined)) return "override";
  if (ov) return "override";
  return baseOrigem ?? "catalogo";
}
