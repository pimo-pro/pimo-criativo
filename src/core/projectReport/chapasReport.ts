/**
 * Chapas reais para o detalhe Painéis do Relatório Final.
 * Agrupa por espessura (não repetir mesma espessura).
 * Cálculo por m²: preço_peça = preço_m² × área_real (L×A/1e6).
 */

import { getPrecoPorMaterial } from "@/core/pricing/pricing";
import type { ChapasRealSheetRow } from "@/core/industrial/computeChapasReal";
import { CHAPA_PADRAO_ALTURA, CHAPA_PADRAO_LARGURA } from "@/core/manufacturing/materials";
import { listIndustrialWoodMaterials } from "@/core/materials/materials.api";

import { makeReportId, type ReportFinanceiroDetalhe } from "./types";

/** Área padrão de chapa industrial (m²) — ~2800×2070 mm. */
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

/** Área real da peça/chapa a partir da medida (mm → m²). */
export function areaM2FromMedida(dimensoes: string): number {
  const { L, A } = parseMedidaMm(dimensoes);
  return round4((Math.max(0, L) * Math.max(0, A)) / 1_000_000);
}

export function resolveAreaChapaM2(d: Pick<ReportFinanceiroDetalhe, "areaChapaM2">): number {
  const a = Number(d.areaChapaM2);
  return a > 0 ? round4(a) : AREA_CHAPA_PADRAO_M2;
}

/** Preço calculado por m² = preço_da_chapa / área_da_chapa. */
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
    const dimensoes = formatMedidaMm(row.L, row.A);
    let eurM2 = 0;
    try {
      eurM2 = Number(getPrecoPorMaterial(row.material, esp)) || 0;
    } catch {
      eurM2 = 0;
    }
    if (!(eurM2 > 0)) {
      const match = listIndustrialWoodMaterials().find((m) => {
        const espMat = Number(m.industrialDefaults?.espessuraPadrao) || 0;
        const matLower = row.material.toLowerCase();
        return (
          espMat === esp &&
          (m.label.toLowerCase().includes(matLower) ||
            matLower.includes(m.viewerMaterialId?.toLowerCase() ?? "") ||
            matLower.includes(m.canonicalId.toLowerCase()))
        );
      });
      eurM2 = Number(match?.industrialDefaults?.custo_m2) || 0;
    }
    const areaChapaM2 = AREA_CHAPA_PADRAO_M2;
    const precoUnitario = precoChapaFromArea(eurM2, dimensoes);
    rows.push(
      recalcChapaDetalhe({
        id: makeReportId("ch"),
        tipo: row.tipo,
        dimensoes,
        espessuraMm: esp,
        quantidade: row.qtd,
        areaChapaM2,
        precoPorM2: eurM2,
        precoUnitario,
        total: 0,
      })
    );
  }
  return rows;
}

/**
 * Recalcula preço da peça: preco_proporcional = preco_m2 × area_real.
 * Se só houver preço da chapa, deriva preco_m2 = preco_chapa / area_chapa.
 */
export function recalcChapaDetalhe(d: ReportFinanceiroDetalhe): ReportFinanceiroDetalhe {
  const areaChapaM2 = resolveAreaChapaM2(d);
  const areaReal = areaM2FromMedida(d.dimensoes) || areaChapaM2;
  let precoPorM2 = Number(d.precoPorM2) || 0;
  let precoUnitario = Number(d.precoUnitario) || 0;

  if (precoPorM2 > 0) {
    precoUnitario = round2(precoPorM2 * areaReal);
  } else if (precoUnitario > 0 && areaChapaM2 > 0) {
    precoPorM2 = precoM2FromChapa(precoUnitario, areaChapaM2);
    precoUnitario = round2(precoPorM2 * areaReal);
  }

  const quantidade = Math.max(0, Number(d.quantidade) || 0);
  return {
    ...d,
    areaChapaM2,
    precoPorM2,
    precoUnitario,
    total: round2(quantidade * precoUnitario),
  };
}

/** Ao editar preço da chapa: atualiza €/m² = preço / área_chapa e reaplica à medida. */
export function applyPrecoChapaEdit(
  d: ReportFinanceiroDetalhe,
  precoChapa: number
): ReportFinanceiroDetalhe {
  const areaChapaM2 = resolveAreaChapaM2(d);
  const precoPorM2 = precoM2FromChapa(precoChapa, areaChapaM2);
  return recalcChapaDetalhe({
    ...d,
    areaChapaM2,
    precoPorM2,
    precoUnitario: precoChapa,
  });
}

export type CatalogoChapaOption = {
  id: string;
  label: string;
  espessuraMm: number;
  precoPorM2: number;
  medidaDefault: string;
};

export function listCatalogoChapas(): CatalogoChapaOption[] {
  return listIndustrialWoodMaterials().map((m) => ({
    id: m.canonicalId,
    label: m.label,
    espessuraMm: Number(m.industrialDefaults?.espessuraPadrao) || 18,
    precoPorM2: Number(m.industrialDefaults?.custo_m2) || 0,
    medidaDefault: formatMedidaMm(
      Number(m.industrialDefaults?.larguraChapa) || CHAPA_PADRAO_LARGURA,
      Number(m.industrialDefaults?.alturaChapa) || CHAPA_PADRAO_ALTURA
    ),
  }));
}

export function detalheFromCatalogoChapa(opt: CatalogoChapaOption): ReportFinanceiroDetalhe {
  return recalcChapaDetalhe({
    id: makeReportId("ch"),
    tipo: opt.label,
    dimensoes: opt.medidaDefault,
    espessuraMm: opt.espessuraMm,
    quantidade: 1,
    areaChapaM2: AREA_CHAPA_PADRAO_M2,
    precoPorM2: opt.precoPorM2,
    precoUnitario: 0,
    total: 0,
  });
}
