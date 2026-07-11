/**
 * Conversão bidirecional entre coordenadas de furo (mm) e posição local do mesh (m).
 * Delega posicionamento face-aware ao SSOT visual (viewerHighlightGeometry).
 */

import type { TechnicalDrillHole } from "../types";
import type { PanelOutlineKind, PanelOutlineDims } from "../../3d/viewer-engine/highlight/viewerHighlightGeometry";
import { holeMmToLocalMeters as holeToLocalSsot } from "../../3d/viewer-engine/highlight/viewerHighlightGeometry";

export type HoleLocalMeters = { x: number; y: number; z: number };

function legacyDims(
  panelType: string,
  widthM: number,
  heightM: number,
  thicknessM = 0.019
): PanelOutlineDims {
  if (panelType === "left" || panelType === "right") {
    return { width: heightM, height: widthM, thickness: thicknessM };
  }
  if (panelType === "front" || panelType === "back") {
    return { width: widthM, height: heightM, thickness: thicknessM, depth: thicknessM };
  }
  return { width: widthM, height: heightM, thickness: thicknessM };
}

export function holeMmToLocalMeters(
  panelType: string,
  widthM: number,
  heightM: number,
  xMm: number,
  yMm: number,
  hole?: { face?: TechnicalDrillHole["face"]; tipo?: TechnicalDrillHole["tipo"] }
): HoleLocalMeters {
  const dims = legacyDims(panelType, widthM, heightM);
  const technical: TechnicalDrillHole = {
    x: xMm,
    y: yMm,
    diametro: 8,
    profundidade: 13,
    tipo: (hole?.tipo as TechnicalDrillHole["tipo"]) ?? "cavilha",
    face: (hole?.face as TechnicalDrillHole["face"]) ?? "fundo",
  };
  const local = holeToLocalSsot(panelType as PanelOutlineKind, dims, technical);
  if (local) return local;

  return {
    x: xMm / 1000 - widthM / 2,
    y: -dims.thickness / 2,
    z: heightM / 2 - yMm / 1000,
  };
}

export function localMetersToHoleMm(
  panelType: string,
  widthM: number,
  heightM: number,
  local: HoleLocalMeters
): { xMm: number; yMm: number } {
  if (panelType === "top" || panelType === "bottom") {
    return {
      xMm: (local.x + widthM / 2) * 1000,
      yMm: (heightM / 2 - local.z) * 1000,
    };
  }

  if (panelType === "left" || panelType === "right") {
    const sideH = Math.max(0.001, widthM - 2 * 0.019);
    return {
      xMm: (local.z + heightM / 2) * 1000,
      yMm: (sideH / 2 - local.y) * 1000,
    };
  }

  if (panelType === "back" || panelType === "front") {
    return {
      xMm: (local.x + widthM / 2) * 1000,
      yMm: (heightM / 2 - local.y) * 1000,
    };
  }

  return {
    xMm: (local.x + widthM / 2) * 1000,
    yMm: (heightM / 2 - local.z) * 1000,
  };
}
