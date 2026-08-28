/**
 * SSOT partilhado: linhas agregadas de Ferragens alinhadas ao Financeiro Unificado.
 * Consumido pelo Unificado (€ total) e pelo Relatório Final (detalhe visual).
 */

import type { ProjectState } from "@/context/projectTypes";
import { buildCutlistItemsForIndustrialExport } from "@/core/fabrication/buildCutlistItemsForIndustrialExport";
import { freeagem4x35JuntasRematesCusto } from "@/core/ferragens/freeagemParafusos";
import type { Ferragem } from "@/core/ferragens/ferragens";
import { ferragensFromBoxes } from "@/core/manufacturing/cutlistFromBoxes";
import { getSettings } from "@/core/settings/settingsService";

import {
  loadFerragensCatalogForPricing,
  priceFerragensFromCatalog,
  type FerragemCatalogLine,
  type FerragensFallbackUsage,
  type FerragensStrictWarning,
} from "./priceFerragensFromCatalog";
import {
  resolveCanonicalFerragemId,
  resolveFerragemCommercialName,
} from "../ferragens/ferragensCountRules";

export type FerragemOrigemPrecoSsot = "catalogo" | "unificado" | "fallback";

export type FerragemUnificadoLineSsot = {
  ferragemId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  observacoes: string;
  origemPreco: FerragemOrigemPrecoSsot;
};

export type FerragensUnificadoSsotResult = {
  totalEur: number;
  totalQty: number;
  lines: FerragemUnificadoLineSsot[];
  enableUnificacao: boolean;
  /** Metadados da Via B (evita segunda chamada a priceFerragensFromCatalog). */
  unificacaoMeta?: {
    warnings: FerragensStrictWarning[];
    fallbacks: FerragensFallbackUsage[];
  };
};

export type FerragensUnificadoProjectSlice = Pick<
  ProjectState,
  | "boxes"
  | "rules"
  | "materialId"
  | "projectName"
  | "remates"
  | "rodapes"
  | "extractedPartsByBoxId"
> & {
  industrialPieceEdits?: ProjectState["industrialPieceEdits"];
  workspaceBoxes?: ProjectState["workspaceBoxes"];
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function catalogNome(catalog: Ferragem[], ferragemId: string, fallback: string): string {
  return resolveFerragemCommercialName(ferragemId, catalog) || fallback;
}

function catalogObs(catalog: Ferragem[], ferragemId: string): string {
  const hit = catalog.find((f) => f.id === ferragemId || f.nome === ferragemId);
  return hit?.medidas ?? hit?.descricao ?? "";
}

/** Agrega linhas catálogo B por ferragemId com preço médio ponderado. */
export function aggregateFerragensCatalogLines(
  rawLines: FerragemCatalogLine[],
  catalog: Ferragem[] = loadFerragensCatalogForPricing()
): FerragemUnificadoLineSsot[] {
  const byId = new Map<
    string,
    { qty: number; totalEur: number; usedFallbackA: boolean }
  >();

  for (const line of rawLines) {
    if (!(line.qtd > 0)) continue;
    const key = resolveCanonicalFerragemId(line.ferragemId);
    const prev = byId.get(key) ?? { qty: 0, totalEur: 0, usedFallbackA: false };
    byId.set(key, {
      qty: prev.qty + line.qtd,
      totalEur: round2(prev.totalEur + line.precoTotal),
      usedFallbackA: prev.usedFallbackA || line.usedFallbackA,
    });
  }

  return [...byId.entries()]
    .map(([ferragemId, agg]) => {
      const quantidade = agg.qty;
      const precoTotal = agg.totalEur;
      const precoUnitario = quantidade > 0 ? round2(precoTotal / quantidade) : 0;
      return {
        ferragemId,
        nome: catalogNome(catalog, ferragemId, ferragemId),
        quantidade,
        precoUnitario,
        precoTotal,
        observacoes: catalogObs(catalog, ferragemId),
        origemPreco: agg.usedFallbackA ? ("fallback" as const) : ("catalogo" as const),
      };
    })
    .filter((l) => l.quantidade > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

/** Agrega ferragensFromBoxes + extra 4×35 (Via A). */
export function aggregateFerragensFromBoxes(
  boxes: ProjectState["boxes"],
  rules: ProjectState["rules"],
  remates: ProjectState["remates"],
  workspaceBoxes: ProjectState["workspaceBoxes"],
  catalog: Ferragem[] = loadFerragensCatalogForPricing()
): FerragemUnificadoLineSsot[] {
  const byId = new Map<string, { qty: number; totalEur: number; nome: string }>();

  const add = (ferragemId: string, nome: string, qty: number, totalEur: number) => {
    if (!(qty > 0)) return;
    const prev = byId.get(ferragemId) ?? { qty: 0, totalEur: 0, nome };
    byId.set(ferragemId, {
      nome: prev.nome || nome,
      qty: prev.qty + qty,
      totalEur: round2(prev.totalEur + totalEur),
    });
  };

  for (const f of ferragensFromBoxes(boxes ?? [], rules)) {
    const fid = resolveCanonicalFerragemId(String(f.tipo || f.id || f.nome));
    add(
      fid,
      catalogNome(catalog, fid, f.nome),
      Number(f.quantidade) || 0,
      Number(f.precoTotal) || 0
    );
  }

  const extra = freeagem4x35JuntasRematesCusto(boxes ?? [], remates, workspaceBoxes);
  if (extra.qty > 0) {
    add(
      "parafuso_4x35",
      catalogNome(catalog, "parafuso_4x35", "Parafuso 4\u00d735"),
      extra.qty,
      extra.custo
    );
  }

  return [...byId.entries()]
    .map(([ferragemId, agg]) => ({
      ferragemId,
      nome: agg.nome,
      quantidade: agg.qty,
      precoTotal: agg.totalEur,
      precoUnitario: agg.qty > 0 ? round2(agg.totalEur / agg.qty) : 0,
      observacoes: catalogObs(catalog, ferragemId),
      origemPreco: "unificado" as const,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

/** SSOT: mesmas linhas + totais que alimentam custosEffective.ferragens. */
export function computeFerragensUnificadoSsot(
  project: FerragensUnificadoProjectSlice,
  catalog: Ferragem[] = loadFerragensCatalogForPricing()
): FerragensUnificadoSsotResult {
  const boxes = project.boxes ?? [];
  const projectName = project.projectName?.trim() || "Projeto";

  let enableUnificacao = false;
  try {
    enableUnificacao = getSettings().orcamentos?.ferragens?.enableUnificacao === true;
  } catch {
    enableUnificacao = false;
  }

  if (enableUnificacao) {
    const cutlist = buildCutlistItemsForIndustrialExport({
      boxes,
      rules: project.rules,
      materialId: project.materialId,
      projectName,
      remates: project.remates ?? [],
      rodapes: project.rodapes ?? [],
      extractedPartsByBoxId: project.extractedPartsByBoxId,
      industrialPieceEdits: project.industrialPieceEdits,
    });
    const priced = priceFerragensFromCatalog({ cutlist, catalog, boxes });
    const lines = aggregateFerragensCatalogLines(priced.lines, catalog);
    return {
      totalEur: priced.totalEur,
      totalQty: priced.totalQty,
      lines,
      enableUnificacao: true,
      unificacaoMeta: {
        warnings: priced.warnings,
        fallbacks: priced.fallbacks,
      },
    };
  }

  const lines = aggregateFerragensFromBoxes(
    boxes,
    project.rules,
    project.remates,
    project.workspaceBoxes,
    catalog
  );
  const totalEur = round2(lines.reduce((s, l) => s + l.precoTotal, 0));
  const totalQty = lines.reduce((s, l) => s + l.quantidade, 0);
  return { totalEur, totalQty, lines, enableUnificacao: false };
}
