import type { CutListItemComPreco } from "../types";
import type { MaterialIndustrial } from "../manufacturing/materials";
import { CHAPA_PADRAO_LARGURA, CHAPA_PADRAO_ALTURA, DENSIDADE_PADRAO } from "../manufacturing/materials";
import { computeChapasReal } from "./computeChapasReal";
import {
  resolveFullIndustrialNameForDocument,
  resolveIndustrialIdForDocument,
} from "../etiquetas/industrialDisplayName";

export type ConsumoPorPecaRow = {
  pecaId: string;
  /** Nome industrial completo (`buildFullIndustrialName`). */
  peca: string;
  /** @deprecated Redundante face ao nome completo — mantido para consumidores legados. */
  caixa: string;
  /** ID industrial curto (= etiqueta / No ETQ). */
  nQr: string;
  material: string;
  areaMm2: number;
  pesoKg: number;
  quantidade: number;
};

export type ConsumoPorChapaRow = {
  chapaIndex: number;
  material: string;
  espessuraMm: number;
  areaUsadaMm2: number;
  areaChapaMm2: number;
  desperdicioMm2: number;
  desperdicioPct: number;
};

export type ConsumoMateriaisSummary = {
  porPeca: ConsumoPorPecaRow[];
  porChapa: ConsumoPorChapaRow[];
  desperdicioTotalMm2: number;
  desperdicioTotalPct: number;
};

function pieceWeightKg(item: CutListItemComPreco, materials: MaterialIndustrial[]): number {
  const largura = item.dimensoes.largura ?? 0;
  const altura = item.dimensoes.altura ?? 0;
  const esp = item.espessura ?? item.dimensoes.profundidade ?? 18;
  const qty = item.quantidade ?? 1;
  const mat = materials.find((m) => m.nome === item.material || m.id === item.materialId);
  const densidade = mat?.densidade ?? DENSIDADE_PADRAO;
  const volumeM3 = (largura * altura * esp * qty) / 1_000_000_000;
  return volumeM3 * densidade;
}

export function computeConsumoMateriais(
  items: CutListItemComPreco[],
  materials: MaterialIndustrial[],
  projectName: string,
  boxes: Array<{ id: string; nome?: string }>
): ConsumoMateriaisSummary {
  const boxNome = Object.fromEntries(boxes.map((b) => [b.id, b.nome?.trim() || b.id]));

  const porPeca: ConsumoPorPecaRow[] = items.map((item) => {
    const area = item.dimensoes.largura * item.dimensoes.altura * (item.quantidade ?? 1);
    const caixa = boxNome[item.boxId ?? ""] ?? item.boxId ?? "—";
    return {
      pecaId: item.id,
      peca: resolveFullIndustrialNameForDocument(item, projectName, caixa),
      caixa,
      nQr: resolveIndustrialIdForDocument(item, projectName, caixa),
      material: item.material ?? "—",
      areaMm2: area,
      pesoKg: pieceWeightKg(item, materials),
      quantidade: item.quantidade ?? 1,
    };
  });

  const chapas = computeChapasReal(items, projectName, boxes, { projectId: projectName });
  const porChapa: ConsumoPorChapaRow[] =
    chapas.sheets.length > 0
      ? chapas.sheets.map((s) => ({
          chapaIndex: s.sheetIndex,
          material: s.material,
          espessuraMm: s.espessuraMm,
          areaUsadaMm2: s.usedAreaMm2,
          areaChapaMm2: s.sheetAreaMm2,
          desperdicioMm2: s.wasteMm2,
          desperdicioPct: s.wastePct,
        }))
      : [
          {
            chapaIndex: 1,
            material: "MDF",
            espessuraMm: 18,
            areaUsadaMm2: porPeca.reduce((s, r) => s + r.areaMm2, 0),
            areaChapaMm2: CHAPA_PADRAO_LARGURA * CHAPA_PADRAO_ALTURA,
            desperdicioMm2: 0,
            desperdicioPct: 0,
          },
        ];

  const totalChapa = porChapa.reduce((s, r) => s + r.areaChapaMm2, 0);
  const desperdicioTotal = porChapa.reduce((s, r) => s + r.desperdicioMm2, 0);

  return {
    porPeca,
    porChapa,
    desperdicioTotalMm2: desperdicioTotal,
    desperdicioTotalPct: totalChapa > 0 ? (desperdicioTotal / totalChapa) * 100 : 0,
  };
}
