/**
 * Chapas reais para o detalhe Painéis do Relatório Final.
 * Agrupa por espessura. Preço por metro linear:
 * preco_unitario = preco_por_metro × (comprimento_mm / 1000).
 */

import { getPrecoPorMaterial } from "@/core/pricing/pricing";
import type { ChapasRealSheetRow } from "@/core/industrial/computeChapasReal";
import { CHAPA_PADRAO_ALTURA, CHAPA_PADRAO_LARGURA } from "@/core/manufacturing/materials";
import { listIndustrialWoodMaterials } from "@/core/materials/materials.api";

import { makeReportId, type ReportFinanceiroDetalhe } from "./types";

/** Área padrão de chapa industrial (m²) — legado / compat. */
export const AREA_CHAPA_PADRAO_M2 = 5.8;

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

export function parseMedidaMm(dimensoes: string): { L: number; A: number } {
  const m = String(dimensoes ?? "").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) {
    return { L: CHAPA_PADRAO_LARGURA, A: CHAPA_PADRAO_ALTURA };
  }
  return { L: Number(m[1]) || CHAPA_PADRAO_LARGURA, A: Number(m[2]) || CHAPA_PADRAO_ALTURA };
}

export function formatMedidaMm(L: number, A: number): string {
  return `${Math.round(L)} x ${Math.round(A)} mm`;
}

/** Resolve comprimento × largura (mm), com fallback à string dimensoes. */
export function resolveDimensoesMm(d: Pick<
  ReportFinanceiroDetalhe,
  "comprimentoMm" | "larguraMm" | "dimensoes"
>): { L: number; A: number } {
  const L = Number(d.comprimentoMm);
  const A = Number(d.larguraMm);
  if ((Number.isFinite(L) && L > 0) || (Number.isFinite(A) && A > 0)) {
    return {
      L: Number.isFinite(L) && L > 0 ? L : CHAPA_PADRAO_LARGURA,
      A: Number.isFinite(A) && A > 0 ? A : CHAPA_PADRAO_ALTURA,
    };
  }
  return parseMedidaMm(d.dimensoes);
}

/** Área real a partir da medida (mm → m²) — legado. */
export function areaM2FromMedida(dimensoes: string): number {
  const { L, A } = parseMedidaMm(dimensoes);
  return round4((Math.max(0, L) * Math.max(0, A)) / 1_000_000);
}

export function resolveAreaChapaM2(d: Pick<ReportFinanceiroDetalhe, "areaChapaM2">): number {
  const a = Number(d.areaChapaM2);
  return a > 0 ? round4(a) : AREA_CHAPA_PADRAO_M2;
}

/** Preço calculado por m² = preço_da_chapa / área_da_chapa (legado). */
export function precoM2FromChapa(
  precoChapa: number,
  areaChapaM2: number = AREA_CHAPA_PADRAO_M2
): number {
  const area = areaChapaM2 > 0 ? areaChapaM2 : AREA_CHAPA_PADRAO_M2;
  return round2((Number(precoChapa) || 0) / area);
}

export function precoChapaFromArea(precoPorM2: number, dimensoes: string): number {
  return round2((Number(precoPorM2) || 0) * areaM2FromMedida(dimensoes));
}

/** Deriva €/m a partir de €/m² × largura (m). */
export function precoPorMetroFromM2(precoPorM2: number, larguraMm: number): number {
  const w = Math.max(0, Number(larguraMm) || 0) / 1000;
  return round2((Number(precoPorM2) || 0) * w);
}

function resolveEurM2(material: string, esp: number): number {
  let eurM2 = 0;
  try {
    eurM2 = Number(getPrecoPorMaterial(material, esp)) || 0;
  } catch {
    eurM2 = 0;
  }
  if (eurM2 > 0) return eurM2;
  const match = listIndustrialWoodMaterials().find((m) => {
    const espMat = Number(m.industrialDefaults?.espessuraPadrao) || 0;
    const matLower = material.toLowerCase();
    return (
      espMat === esp &&
      (m.label.toLowerCase().includes(matLower) ||
        matLower.includes(m.viewerMaterialId?.toLowerCase() ?? "") ||
        matLower.includes(m.canonicalId.toLowerCase()))
    );
  });
  return Number(match?.industrialDefaults?.custo_m2) || 0;
}

/** Agrupa sheets por espessura; soma quantidades; uma linha por espessura. */
export function aggregateChapasByEspessura(
  sheets: ChapasRealSheetRow[]
): ReportFinanceiroDetalhe[] {
  const byEsp = new Map<
    number,
    { tipo: string; L: number; A: number; qtd: number; material: string }
  >();

  for (const s of sheets) {
    const esp = Math.round(Number(s.espessuraMm) || 0) || 18;
    const prev = byEsp.get(esp);
    if (prev) {
      prev.qtd += 1;
    } else {
      byEsp.set(esp, {
        tipo: String(s.material || "Chapa"),
        L: Number(s.sheetLarguraMm) || CHAPA_PADRAO_LARGURA,
        A: Number(s.sheetAlturaMm) || CHAPA_PADRAO_ALTURA,
        qtd: 1,
        material: String(s.material || ""),
      });
    }
  }

  const rows: ReportFinanceiroDetalhe[] = [];
  for (const [esp, row] of [...byEsp.entries()].sort((a, b) => a[0] - b[0])) {
    const eurM2 = resolveEurM2(row.material, esp);
    const precoPorMetro = precoPorMetroFromM2(eurM2, row.A);
    rows.push(
      recalcChapaDetalhe({
        id: makeReportId("ch"),
        tipo: row.tipo,
        dimensoes: formatMedidaMm(row.L, row.A),
        comprimentoMm: row.L,
        larguraMm: row.A,
        espessuraMm: esp,
        quantidade: row.qtd,
        precoPorMetro,
        precoPorM2: eurM2,
        precoUnitario: 0,
        total: 0,
      })
    );
  }
  return rows;
}

/**
 * Recalcula: preco_unitario = preco_por_metro × comprimento_m.
 * Migra legado €/m² → €/m via largura.
 */
export function recalcChapaDetalhe(d: ReportFinanceiroDetalhe): ReportFinanceiroDetalhe {
  const { L, A } = resolveDimensoesMm(d);
  const comprimentoMm = Math.max(0, L);
  const larguraMm = Math.max(0, A);
  const comprimentoM = comprimentoMm / 1000;

  let precoPorMetro = Number(d.precoPorMetro) || 0;
  if (!(precoPorMetro > 0) && Number(d.precoPorM2) > 0) {
    precoPorMetro = precoPorMetroFromM2(Number(d.precoPorM2), larguraMm);
  }
  // Legado: precoUnitario era preço da peça/chapa — se só isso existir, trata como €/m × 1m
  if (!(precoPorMetro > 0) && Number(d.precoUnitario) > 0 && comprimentoM > 0) {
    // Se dimensoes eram chapa completa, unitario antigo ≈ preço proporcional área;
    // preferir derivar €/m = unitario / comprimento_m
    precoPorMetro = round2(Number(d.precoUnitario) / comprimentoM);
  }

  const precoUnitario = round2(precoPorMetro * comprimentoM);
  const quantidade = Math.max(0, Number(d.quantidade) || 0);

  return {
    ...d,
    comprimentoMm,
    larguraMm,
    dimensoes: formatMedidaMm(comprimentoMm, larguraMm),
    precoPorMetro,
    precoUnitario,
    total: round2(quantidade * precoUnitario),
  };
}

/** Editar preço por metro (€/m). */
export function applyPrecoPorMetroEdit(
  d: ReportFinanceiroDetalhe,
  precoPorMetro: number
): ReportFinanceiroDetalhe {
  return recalcChapaDetalhe({
    ...d,
    precoPorMetro: Math.max(0, Number(precoPorMetro) || 0),
  });
}

/** Editar preço por m² — recalcula €/m e total da chapa. */
export function applyPrecoPorM2Edit(
  d: ReportFinanceiroDetalhe,
  precoPorM2: number
): ReportFinanceiroDetalhe {
  const { A } = resolveDimensoesMm(d);
  const eurM2 = Math.max(0, Number(precoPorM2) || 0);
  return recalcChapaDetalhe({
    ...d,
    precoPorM2: eurM2,
    precoPorMetro: precoPorMetroFromM2(eurM2, A),
  });
}

/** @deprecated alias — trata o valor como €/m. */
export function applyPrecoChapaEdit(
  d: ReportFinanceiroDetalhe,
  precoPorMetro: number
): ReportFinanceiroDetalhe {
  return applyPrecoPorMetroEdit(d, precoPorMetro);
}

export type CatalogoChapaOption = {
  id: string;
  label: string;
  espessuraMm: number;
  precoPorM2: number;
  precoPorMetro: number;
  medidaDefault: string;
  comprimentoMm: number;
  larguraMm: number;
};

export function listCatalogoChapas(): CatalogoChapaOption[] {
  return listIndustrialWoodMaterials().map((m) => {
    const comprimentoMm = Number(m.industrialDefaults?.larguraChapa) || CHAPA_PADRAO_LARGURA;
    const larguraMm = Number(m.industrialDefaults?.alturaChapa) || CHAPA_PADRAO_ALTURA;
    const precoPorM2 = Number(m.industrialDefaults?.custo_m2) || 0;
    return {
      id: m.canonicalId,
      label: m.label,
      espessuraMm: Number(m.industrialDefaults?.espessuraPadrao) || 18,
      precoPorM2,
      precoPorMetro: precoPorMetroFromM2(precoPorM2, larguraMm),
      comprimentoMm,
      larguraMm,
      medidaDefault: formatMedidaMm(comprimentoMm, larguraMm),
    };
  });
}

export function detalheFromCatalogoChapa(opt: CatalogoChapaOption): ReportFinanceiroDetalhe {
  return recalcChapaDetalhe({
    id: makeReportId("ch"),
    tipo: opt.label,
    dimensoes: opt.medidaDefault,
    comprimentoMm: opt.comprimentoMm,
    larguraMm: opt.larguraMm,
    espessuraMm: opt.espessuraMm,
    quantidade: 1,
    precoPorMetro: opt.precoPorMetro,
    precoPorM2: opt.precoPorM2,
    precoUnitario: 0,
    total: 0,
  });
}
