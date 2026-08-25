/**
 * Adapter cutlist — peças cx_gav (caixa cavita).
 * Chamado no final de cutlistComPrecoFromBox; path paramétrico aditivo.
 */

import type { BoxModule, CutListItem } from "../types";
import { resolveIndustrialGrainCode } from "../materials/grainDirection";
import { getMaterialDisplayInfo } from "../materials/materialsService";
import { resolveIndustrialMaterialKey } from "../materials/service";
import { buildCutlistRotationMetadata } from "../manufacturing/cutlistRotationMetadata";
import { buildCxGavDrillHoles } from "./cxGavDrilling";
import {
  boxUsesCxGav,
  computeCxGavLayout,
  CX_GAV_PIECE_TIPOS,
  type CxGavPieceTipo,
} from "./cxGavGeometry";

function pieceDims(
  tipo: CxGavPieceTipo,
  layout: ReturnType<typeof computeCxGavLayout>
): { largura: number; altura: number; espessura: number } {
  const e = layout.espessuraMm;
  switch (tipo) {
    case "cx_gav_lat_esq":
    case "cx_gav_lat_dir":
      return {
        largura: layout.lateralProfundidadeMm,
        altura: layout.lateralAlturaMm,
        espessura: e,
      };
    case "cx_gav_fun":
      return {
        largura: layout.fundoLarguraMm,
        altura: layout.fundoProfundidadeMm,
        espessura: e,
      };
    case "cx_gav_cima":
      return {
        largura: layout.cimaLarguraMm,
        altura: layout.cimaProfundidadeMm,
        espessura: e,
      };
  }
}

/**
 * Emite as 4 peças cx_gav com furos e industrialLabel.
 * Retorna [] se a caixa não usa o modo cx_gav_cavita.
 */
export function extractCxGavCutlistFromBox(
  box: BoxModule,
  bodyMaterialIdOrLegacyLabel?: string,
  boxName?: string
): CutListItem[] {
  if (!boxUsesCxGav(box)) return [];

  const layout = computeCxGavLayout(box);
  if (
    layout.larguraInternaMm <= 0 ||
    layout.lateralAlturaMm <= 0 ||
    layout.profundidadeInternaMm <= 0
  ) {
    return [];
  }

  const materialId = resolveIndustrialMaterialKey(bodyMaterialIdOrLegacyLabel);
  const materialLabel = getMaterialDisplayInfo(materialId).label;
  void boxName;
  const rotationMeta = buildCutlistRotationMetadata({
    allowPieceRotation: box.allowPieceRotation,
    lockWoodGrain: box.lockWoodGrain,
    materialId,
  });

  return CX_GAV_PIECE_TIPOS.map((tipo) => {
    const dims = pieceDims(tipo, layout);
    const panelId = `${box.id}-${tipo}`;
    return {
      id: panelId,
      nome: tipo,
      quantidade: 1,
      dimensoes: {
        largura: dims.largura,
        altura: dims.altura,
        profundidade: dims.espessura,
      },
      espessura: dims.espessura,
      material: materialLabel,
      materialId,
      tipo,
      sourceType: "parametric" as const,
      boxId: box.id,
      grainDirection: resolveIndustrialGrainCode({ tipo }),
      drillHoles: buildCxGavDrillHoles(tipo, layout),
      metadata: {
        panelId,
        cxGav: true,
        cxGavCimaRear: tipo === "cx_gav_cima",
        ...rotationMeta,
      },
    };
  });
}
