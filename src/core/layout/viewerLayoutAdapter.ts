/**
 * Adaptador entre o Viewer (metros, origem no centro da caixa) e o módulo de
 * posicionamento (mm, origem no canto da caixa).
 * Usado para aplicar computeAutoPosition e setModelPosition no viewer.
 */

import { mToMm, mmToM } from "../../utils/units";
import { computeAutoPosition } from "../rules/positioning";
import type { BoxBoundsMm, PlacedModelMm } from "../rules/positioning";
import type { Dimensoes } from "../types";
import type { AutoPositionResult } from "../rules/types";

/** Dimensões da caixa em metros (viewer). */
export type BoxDimsM = { width: number; height: number; depth: number };

/** Posição em metros, espaço local da caixa (origem no centro). */
export type PositionLocalM = { x: number; y: number; z: number };

/** Tamanho em metros. */
export type SizeM = { width: number; height: number; depth: number };

/** Converte box dims (m) para BoxBoundsMm (origem 0,0,0). */
export function boxDimsToBoundsMm(dims: BoxDimsM): BoxBoundsMm {
  return {
    width: mToMm(dims.width),
    height: mToMm(dims.height),
    depth: mToMm(dims.depth),
    originX: 0,
    originY: 0,
    originZ: 0,
  };
}

/**
 * Converte posição e tamanho do modelo (viewer: centro, m) para PlacedModelMm
 * (canto mínimo em mm).
 */
export function toPlacedModelMm(
  instanceId: string,
  modelId: string,
  positionLocalM: PositionLocalM,
  sizeM: SizeM,
  boxDimsM: BoxDimsM
): PlacedModelMm {
  const w = boxDimsM.width;
  const h = boxDimsM.height;
  const d = boxDimsM.depth;
  const cornerX = positionLocalM.x - sizeM.width / 2 + w / 2;
  const cornerY = positionLocalM.y - sizeM.height / 2 + h / 2;
  const cornerZ = positionLocalM.z - sizeM.depth / 2 + d / 2;
  return {
    instanceId,
    modelId,
    position: {
      x: mToMm(cornerX),
      y: mToMm(cornerY),
      z: mToMm(cornerZ),
    },
    size: {
      largura: mToMm(sizeM.width),
      altura: mToMm(sizeM.height),
      profundidade: mToMm(sizeM.depth),
    },
  };
}

/**
 * Converte resultado de computeAutoPosition (centro em mm, origem canto) para
 * posição local do viewer (centro em m, origem no centro da caixa).
 */
export function positionMmToLocalM(
  positionMm: { x: number; y: number; z: number },
  boxDimsM: BoxDimsM
): PositionLocalM {
  const w = boxDimsM.width;
  const h = boxDimsM.height;
  const d = boxDimsM.depth;
  return {
    x: mmToM(positionMm.x) - w / 2,
    y: mmToM(positionMm.y) - h / 2,
    z: mmToM(positionMm.z) - d / 2,
  };
}

/**
 * Calcula a próxima posição automática para um novo modelo e devolve a posição
 * em espaço local do viewer (metros).
 */
export function computeAutoPositionLocal(
  boxDimsM: BoxDimsM,
  placedModels: PlacedModelMm[],
  modelId: string,
  modelSizeMm: Dimensoes,
  instanceId: string
): AutoPositionResult {
  const bounds = boxDimsToBoundsMm(boxDimsM);
  const result = computeAutoPosition(bounds, placedModels, modelId, modelSizeMm, instanceId);
  return {
    ...result,
    positionMm: result.positionMm,
  };
}
