import {
  resolveDivisorCenterX,
  resolveDivisorDimensions,
  resolveSeparadorCenterX,
  resolveSeparadorCenterY,
  resolveSeparadorDimensions,
} from "./dimensions";
import { resolveDivisorBottomYAbs } from "./coupling";
import type { DivSepBoxLike } from "./types";

const SHELF_VISUAL_INSET_M = 0.001;

export type DivSepMeshSpec = {
  name: string;
  size: [number, number, number];
  pos: [number, number, number];
};

export function getDivSepMeshSpecs(
  box: DivSepBoxLike,
  widthM: number,
  heightM: number,
  depthM: number,
  thicknessM: number
): DivSepMeshSpec[] {
  const specs: DivSepMeshSpec[] = [];
  const widthMm = widthM * 1000;

  for (const sep of box.separadores ?? []) {
    const dims = resolveSeparadorDimensions(box, sep);
    const centerYAbs = resolveSeparadorCenterY(box, sep);
    const centerXAbs = resolveSeparadorCenterX(box, sep);
    const centerYM = centerYAbs / 1000 - heightM / 2;
    const centerXM = centerXAbs / 1000 - widthMm / 1000 / 2;
    const shelfDepthM = Math.max(0.001, dims.profundidadeMm / 1000);
    const centerZ = -depthM / 2 + shelfDepthM / 2 + SHELF_VISUAL_INSET_M;
    specs.push({
      name: `divsep-sep-${sep.id}`,
      size: [Math.max(0.001, dims.larguraMm / 1000), thicknessM, shelfDepthM],
      pos: [centerXM, centerYM, centerZ],
    });
  }

  for (const div of box.divisores ?? []) {
    const dims = resolveDivisorDimensions(box, div);
    const centerXAbs = resolveDivisorCenterX(box, div);
    const centerXM = centerXAbs / 1000 - widthMm / 1000 / 2;
    const divHeightM = Math.max(0.001, dims.alturaMm / 1000);
    const divBottomYAbs = resolveDivisorBottomYAbs(box, div);
    const centerYAbs = divBottomYAbs + dims.alturaMm / 2;
    const centerYM = centerYAbs / 1000 - heightM / 2;
    const divDepthM = Math.max(0.001, dims.profundidadeMm / 1000);
    const centerZ = -depthM / 2 + divDepthM / 2 + SHELF_VISUAL_INSET_M;
    specs.push({
      name: `divsep-div-${div.id}`,
      size: [thicknessM, divHeightM, divDepthM],
      pos: [centerXM, centerYM, centerZ],
    });
  }

  return specs;
}
