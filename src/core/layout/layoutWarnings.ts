/**
 * Deteção de colisões e limites para modelos dentro da caixa.
 * Usa boxesOverlap e limites da caixa (origem canto, mm).
 */

import type { Dimensoes } from "../types";
import { boxesOverlap } from "../rules/positioning";
import { mToMm } from "../../utils/units";

export type LayoutCollision = {
  boxId: string;
  modelIdA: string;
  modelIdB: string;
};

export type LayoutOutOfBounds = {
  boxId: string;
  modelInstanceId: string;
  axis?: "x" | "y" | "z";
};

export type LayoutWarnings = {
  collisions: LayoutCollision[];
  outOfBounds: LayoutOutOfBounds[];
};

/** Dimensões da caixa em metros. */
type BoxDimsM = { width: number; height: number; depth: number };

const MARGIN_MM = 1;

/**
 * Converte posição centro (m, box local) e tamanho (m) para posição centro em mm
 * (origem no canto da caixa).
 */
function centerLocalMToMm(
  positionM: { x: number; y: number; z: number },
  sizeM: { width: number; height: number; depth: number },
  boxDimsM: BoxDimsM
): { posMm: { x: number; y: number; z: number }; sizeMm: Dimensoes } {
  const w = boxDimsM.width;
  const h = boxDimsM.height;
  const d = boxDimsM.depth;
  const centerX = positionM.x + w / 2;
  const centerY = positionM.y + h / 2;
  const centerZ = positionM.z + d / 2;
  return {
    posMm: {
      x: mToMm(centerX),
      y: mToMm(centerY),
      z: mToMm(centerZ),
    },
    sizeMm: {
      largura: mToMm(sizeM.width),
      altura: mToMm(sizeM.height),
      profundidade: mToMm(sizeM.depth),
    },
  };
}

/**
 * Verifica colisões entre modelos e modelos fora dos limites da caixa.
 * positionsAndSizes: para cada modelInstanceId, { position: box local m (centro), size: m }.
 */
export function computeLayoutWarnings(
  boxId: string,
  boxDimsM: BoxDimsM,
  positionsAndSizes: Array<{
    modelInstanceId: string;
    position: { x: number; y: number; z: number };
    size: { width: number; height: number; depth: number };
  }>
): LayoutWarnings {
  const collisions: LayoutCollision[] = [];
  const outOfBounds: LayoutOutOfBounds[] = [];
  const wMm = mToMm(boxDimsM.width);
  const hMm = mToMm(boxDimsM.height);
  const dMm = mToMm(boxDimsM.depth);

  const models: Array<{
    id: string;
    posMm: { x: number; y: number; z: number };
    sizeMm: Dimensoes;
  }> = positionsAndSizes.map((m) => {
    const { posMm, sizeMm } = centerLocalMToMm(m.position, m.size, boxDimsM);
    return { id: m.modelInstanceId, posMm, sizeMm };
  });

  for (let i = 0; i < models.length; i++) {
    const a = models[i];
    const halfW = a.sizeMm.largura / 2;
    const halfH = a.sizeMm.altura / 2;
    const halfD = a.sizeMm.profundidade / 2;
    if (
      a.posMm.x - halfW < -MARGIN_MM ||
      a.posMm.x + halfW > wMm + MARGIN_MM ||
      a.posMm.y - halfH < -MARGIN_MM ||
      a.posMm.y + halfH > hMm + MARGIN_MM ||
      a.posMm.z - halfD < -MARGIN_MM ||
      a.posMm.z + halfD > dMm + MARGIN_MM
    ) {
      outOfBounds.push({ boxId, modelInstanceId: a.id });
    }
    for (let j = i + 1; j < models.length; j++) {
      const b = models[j];
      if (boxesOverlap(a.posMm, a.sizeMm, b.posMm, b.sizeMm, MARGIN_MM)) {
        collisions.push({ boxId, modelIdA: a.id, modelIdB: b.id });
      }
    }
  }
  return { collisions, outOfBounds };
}
