/**
 * Compensação −40 mm no lado da dobradiça + peça compensadora.
 * Não altera fórmulas globais L/A/P da caixa mãe.
 */

import type { BoxModule, CutListItem } from "../types";
import { resolveIndustrialMaterialKey } from "../materials/service";
import { getMaterialDisplayInfo } from "../materials/materialsService";
import { resolveIndustrialGrainCode } from "../materials/grainDirection";
import { buildCutlistRotationMetadata } from "../manufacturing/cutlistRotationMetadata";
import { buildA1CarcassIndustrialLabel } from "./a1Naming";

export const HINGE_COMPENSATION_MM = 40;
export const A1_COMP_TIPO = "a1_cx_comp_40";

export function resolveHingeCompensationSide(box: {
  doorsLayer?: Array<{ hingeSide?: string }>;
}): "left" | "right" {
  const hinge = box.doorsLayer?.find(
    (d) => d.hingeSide === "left" || d.hingeSide === "right"
  )?.hingeSide;
  return hinge === "left" ? "left" : "right";
}

export function buildHingeCompensation40CutlistItem(params: {
  box: BoxModule;
  depthMm: number;
  heightMm: number;
  espessuraMm: number;
  bodyMaterialId?: string;
  boxName?: string;
}): CutListItem {
  const materialId = resolveIndustrialMaterialKey(params.bodyMaterialId);
  const industrialLabel = buildA1CarcassIndustrialLabel(
    params.boxName ?? params.box.nome ?? params.box.id,
    "cx_comp_40"
  );
  const side = resolveHingeCompensationSide(params.box);
  return {
    id: `${params.box.id}-${A1_COMP_TIPO}`,
    nome: industrialLabel,
    quantidade: 1,
    dimensoes: {
      largura: HINGE_COMPENSATION_MM,
      altura: Math.max(1, params.heightMm),
      profundidade: params.espessuraMm,
    },
    espessura: params.espessuraMm,
    material: getMaterialDisplayInfo(materialId).label,
    materialId,
    tipo: A1_COMP_TIPO,
    sourceType: "parametric",
    boxId: params.box.id,
    grainDirection: resolveIndustrialGrainCode({ tipo: A1_COMP_TIPO }),
    metadata: {
      panelId: `${params.box.id}-${A1_COMP_TIPO}`,
      industrialLabel,
      innerCabinetId: "a_1",
      hingeCompensationMm: HINGE_COMPENSATION_MM,
      hingeSide: side,
      profundidadeUtilMm: params.depthMm,
      ...buildCutlistRotationMetadata({
        allowPieceRotation: params.box.allowPieceRotation,
        lockWoodGrain: params.box.lockWoodGrain,
        materialId,
      }),
    },
  };
}
