/**
 * Chapas reais para o detalhe Painéis do Relatório Final.
 * Agrupa por espessura (não repetir mesma espessura).
 */

import { getPrecoPorMaterial } from "@/core/pricing/pricing";
import type { ChapasRealSheetRow } from "@/core/industrial/computeChapasReal";
import { CHAPA_PADRAO_ALTURA, CHAPA_PADRAO_LARGURA } from "@/core/manufacturing/materials";
import { listIndustrialWoodMaterials } from "@/core/materials/materials.api";

import { makeReportId, type ReportFinanceiroDetalhe } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
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

export function areaM2FromMedida(dimensoes: string): number {
  const { L, A } = parseMedidaMm(dimensoes);
  return (Math.max(0, L) / 1000) * (Math.max(0, A) / 1000);
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
      eurM2 = Number(getPrecoPorMaterial(row.material)) || 0;
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
    const precoUnitario = precoChapaFromArea(eurM2, dimensoes);
    rows.push({
      id: makeReportId("ch"),
      tipo: row.tipo,
      dimensoes,
      espessuraMm: esp,
      quantidade: row.qtd,
      precoPorM2: eurM2,
      precoUnitario,
      total: round2(precoUnitario * row.qtd),
    });
  }
  return rows;
}

export function recalcChapaDetalhe(d: ReportFinanceiroDetalhe): ReportFinanceiroDetalhe {
  const precoPorM2 = Number(d.precoPorM2) || 0;
  let precoUnitario = Number(d.precoUnitario) || 0;
  if (precoPorM2 > 0 && d.dimensoes) {
    precoUnitario = precoChapaFromArea(precoPorM2, d.dimensoes);
  }
  const quantidade = Math.max(0, Number(d.quantidade) || 0);
  return {
    ...d,
    precoUnitario,
    total: round2(quantidade * precoUnitario),
  };
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
  const dimensoes = opt.medidaDefault;
  const precoUnitario = precoChapaFromArea(opt.precoPorM2, dimensoes);
  return {
    id: makeReportId("ch"),
    tipo: opt.label,
    dimensoes,
    espessuraMm: opt.espessuraMm,
    quantidade: 1,
    precoPorM2: opt.precoPorM2,
    precoUnitario,
    total: precoUnitario,
  };
}
