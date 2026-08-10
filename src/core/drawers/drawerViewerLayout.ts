/**
 * Geometria 3D unificada das gavetas (Viewer).
 * Origem local do grupo da gaveta: centro da frente externa (X/Y/Z).
 * Z+ = para a frente do módulo; Y+ = para cima.
 */
import {
  DRAWER_SIDE_BASE_ELEVATION_MAX_MM,
  DRAWER_SIDE_BASE_ELEVATION_MIN_MM,
  DRAWER_SIDE_BASE_ELEVATION_MM,
  DRAWER_SIDE_HEIGHT_RATIO,
  DRAWER_SIDE_TOP_CLEARANCE_RATIO,
} from "./drawerGeometryConstants";
import { resolveDrawerWoodBodyHeightForStackRoleMm } from "./drawerSolidWorksStackGeometry";
import { isMetalBoxCatalogType } from "./drawerMetalBoxCatalog";
import {
  DRAWER_FRONT_FACE_OVERHANG_MM,
  resolveDrawerBodyCenterZFromFrontMm,
  resolveDrawerFrontPosZMm,
  resolveDrawerSideDepthMm,
  resolveDrawerViewerBodyDepthMm,
} from "./drawerSlideDepth";

export type DrawerViewerPieceBox = {
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** Folga vertical no topo da frente (mm) — 25% da altura da frente. */
export function resolveDrawerSideTopClearanceMm(frontHeightMm: number): number {
  const frontH = Math.max(0, Number(frontHeightMm));
  return frontH * DRAWER_SIDE_TOP_CLEARANCE_RATIO;
}

/** Elevação da base das laterais acima da base da frente (mm), clamp 12,5–22. */
export function resolveDrawerSideBaseElevationMm(
  overrideMm?: number
): number {
  if (overrideMm != null && Number.isFinite(overrideMm)) {
    return Math.min(
      DRAWER_SIDE_BASE_ELEVATION_MAX_MM,
      Math.max(DRAWER_SIDE_BASE_ELEVATION_MIN_MM, overrideMm)
    );
  }
  return DRAWER_SIDE_BASE_ELEVATION_MM;
}

/** Altura do corpo madeira (laterais). SSOT: frente × percentual Admin. */
export function resolveDrawerWoodBodyHeightMm(
  frontHeightMm: number,
  stackRole?: import("./drawerStackPosition").DrawerStackRole,
  heightRatio?: number
): number {
  return resolveDrawerWoodBodyHeightForStackRoleMm(
    frontHeightMm,
    stackRole ?? "middle",
    heightRatio
  );
}

/**
 * Offset Y do centro das laterais/costa.
 * Base da lateral = base da frente + elevação industrial (12,5–22 mm).
 */
export function resolveDrawerBodyCenterOffsetYMm(
  frontHeightMm: number,
  woodBodyHeightMm?: number,
  baseElevationMm: number = resolveDrawerSideBaseElevationMm()
): number {
  const frontH = Math.max(0, Number(frontHeightMm));
  const bodyH = woodBodyHeightMm ?? resolveDrawerWoodBodyHeightMm(frontH);
  const elevation = resolveDrawerSideBaseElevationMm(baseElevationMm);
  return -(frontH - bodyH) / 2 + elevation;
}

/** Centro Z do corpo (laterais/fundo) atrás da frente, coords locais (origem = centro da frente). */
export function resolveDrawerBodyCenterZMm(
  combinedFrontThicknessMm: number,
  bodyDepthMm: number
): number {
  return -(combinedFrontThicknessMm / 2 + bodyDepthMm / 2);
}

/** Centro Z da costa no fundo do corpo (coords locais). */
export function resolveDrawerBackCenterZMm(
  combinedFrontThicknessMm: number,
  bodyDepthMm: number,
  backThicknessMm: number
): number {
  return -(combinedFrontThicknessMm / 2 + bodyDepthMm - backThicknessMm / 2);
}

/** Centro Y do fundo (painel horizontal). */
export function resolveDrawerBottomCenterYMm(
  woodBodyHeightMm: number,
  bottomThicknessMm: number,
  bodyCenterOffsetYMm: number
): number {
  return -woodBodyHeightMm / 2 + bottomThicknessMm / 2 + bodyCenterOffsetYMm;
}

/**
 * Posição Z do grupo da gaveta no sistema local da caixa.
 * Face exterior da frente = profundidade_externa + 1 mm.
 */
export function resolveDrawerGroupPosZMm(
  profundidadeExternaMm: number,
  frontThicknessMm: number
): number {
  return resolveDrawerFrontPosZMm(profundidadeExternaMm, frontThicknessMm);
}

/** Laterais fabricadas: madeira ou perfil metálico (mutuamente exclusivo, paridade industrial). */
export type DrawerManufacturedSideMode = "wood" | "metal" | "none";

export function resolveDrawerManufacturedSideMode(
  metalBoxType: string | undefined | null,
  leftSideWidthMm: number
): DrawerManufacturedSideMode {
  if (isMetalBoxCatalogType(metalBoxType)) return "metal";
  if (leftSideWidthMm > 0) return "wood";
  return "none";
}

const HIDDEN_BRANDED_SLIDE_TYPES = new Set([
  "Blum Tandem",
  "Blum Movento",
  "Hettich InnoTech",
  "Hettich ArciTech",
]);

/**
 * Corrediças genéricas decorativas — apenas quando não há laterais fabricadas no viewer.
 * Evita duplicar laterais madeira/metal com perfis de corrediça.
 */
export function shouldRenderGenericDrawerSlideRails(
  slideType: string | undefined,
  sideMode: DrawerManufacturedSideMode
): boolean {
  if (sideMode !== "none") return false;
  return !HIDDEN_BRANDED_SLIDE_TYPES.has(slideType ?? "Hettich ArciTech");
}

/** Paridade viewer ↔ XML industrial — laterais de madeira. */
export const DRAWER_VIEWER_SIDE_HEIGHT_RATIO = DRAWER_SIDE_HEIGHT_RATIO;
export const DRAWER_VIEWER_SIDE_WALL_GAP_MM = 7;

export type DrawerViewerWoodSideLayoutMm = {
  sideHeightMm: number;
  sidePosYMm: number;
  leftPosXMm: number;
  rightPosXMm: number;
  /** Comprimento industrial das laterais (corrediça − 10 mm). */
  sideDepthMm: number;
  /** Comprimento do fundo (= corrediça). */
  bodyDepthMm: number;
  internalWidthMm: number;
};

/** Altura da lateral: frente × percentual Admin (default 75%). */
export function resolveDrawerViewerSideHeightMm(frontHeightMm: number): number {
  return resolveDrawerWoodBodyHeightMm(frontHeightMm);
}

/** Largura interna útil da caixa a partir da largura do corpo (bodyWidth = interna − 2×folga). */
export function resolveDrawerViewerInternalWidthMm(
  bodyWidthMm: number,
  wallGapMm: number = DRAWER_VIEWER_SIDE_WALL_GAP_MM
): number {
  return Math.max(0, Number(bodyWidthMm)) + 2 * Math.max(0, wallGapMm);
}

/** Posição Y do centro da lateral — base elevada acima da base da frente (coords locais, mm). */
export function resolveDrawerViewerSidePosYMm(
  frontPosYMm: number,
  frontHeightMm: number,
  sideHeightMm: number,
  baseElevationMm: number = resolveDrawerSideBaseElevationMm()
): number {
  const elevation = resolveDrawerSideBaseElevationMm(baseElevationMm);
  return (
    Number(frontPosYMm) -
    Number(frontHeightMm) / 2 +
    Number(sideHeightMm) / 2 +
    elevation
  );
}

/** Posição X do centro da lateral (coords locais da gaveta, mm). */
export function resolveDrawerViewerSidePosXMm(
  internalWidthMm: number,
  sideThicknessMm: number,
  side: "left" | "right",
  wallGapMm: number = DRAWER_VIEWER_SIDE_WALL_GAP_MM
): number {
  const magnitude =
    Math.max(0, Number(internalWidthMm)) / 2 -
    Math.max(0, wallGapMm) -
    Math.max(0, Number(sideThicknessMm)) / 2;
  return side === "left" ? -magnitude : magnitude;
}

/** Posição Y do centro da frente quando as laterais definem a base (mm). Não usar no viewer quando a frente é a âncora em Y=0. */
export function resolveDrawerViewerFrontPosYMm(
  sidePosYMm: number,
  sideHeightMm: number,
  frontHeightMm: number
): number {
  return (
    Number(sidePosYMm) +
    Number(sideHeightMm) / 2 -
    Number(frontHeightMm) / 2
  );
}

/** Dimensões e posições viewer das laterais madeira (paridade XML). */
export function resolveDrawerViewerWoodSideLayoutMm(input: {
  frontPosYMm: number;
  frontHeightMm: number;
  bodyWidthMm: number;
  sideThicknessMm: number;
  /** Comprimento nominal da corrediça (mm). */
  slideLengthMm: number;
  /** Elevação da base das laterais vs frente (mm). Inferior 18,5; mid 17; superior 12,5. */
  baseElevationMm?: number;
  /** Altura industrial das laterais (mm). Default = frontH × percentual Admin. */
  sideHeightMm?: number;
}): DrawerViewerWoodSideLayoutMm {
  const sideHeightMm =
    input.sideHeightMm != null &&
    Number.isFinite(input.sideHeightMm) &&
    input.sideHeightMm > 0
      ? input.sideHeightMm
      : resolveDrawerViewerSideHeightMm(input.frontHeightMm);
  const internalWidthMm = resolveDrawerViewerInternalWidthMm(input.bodyWidthMm);
  const slideLength = Math.max(0, Number(input.slideLengthMm));
  const sideDepthMm = resolveDrawerSideDepthMm(slideLength);
  return {
    sideHeightMm,
    sidePosYMm: resolveDrawerViewerSidePosYMm(
      input.frontPosYMm,
      input.frontHeightMm,
      sideHeightMm,
      input.baseElevationMm
    ),
    leftPosXMm: resolveDrawerViewerSidePosXMm(
      internalWidthMm,
      input.sideThicknessMm,
      "left"
    ),
    rightPosXMm: resolveDrawerViewerSidePosXMm(
      internalWidthMm,
      input.sideThicknessMm,
      "right"
    ),
    sideDepthMm,
    bodyDepthMm: slideLength,
    internalWidthMm,
  };
}

/** Paridade viewer ↔ XML industrial — fundo (gav_fun) e costa (gav_cost). */
export const DRAWER_VIEWER_FLOOR_ABOVE_SIDE_BASE_MM = 12;
export const DRAWER_VIEWER_FLOOR_INTERNAL_WIDTH_TRIM_MM = 14;

export type DrawerViewerWoodBottomBackLayoutMm = {
  floorWidthMm: number;
  floorDepthMm: number;
  floorThicknessMm: number;
  floorPosYMm: number;
  floorPosZMm: number;
  backWidthMm: number;
  backHeightMm: number;
  backThicknessMm: number;
  backPosYMm: number;
  backPosZMm: number;
};

/** Largura do fundo/costa: internalWidth − 14 mm − (espessuraLateral × 2). */
export function resolveDrawerViewerFloorWidthMm(
  internalWidthMm: number,
  sideThicknessMm: number
): number {
  return Math.max(
    1,
    Number(internalWidthMm) -
      DRAWER_VIEWER_FLOOR_INTERNAL_WIDTH_TRIM_MM -
      2 * Math.max(0, Number(sideThicknessMm))
  );
}

export function resolveDrawerViewerWoodBottomBackLayoutMm(input: {
  sidePosYMm: number;
  sideHeightMm: number;
  internalWidthMm: number;
  sideThicknessMm: number;
  /** Comprimento nominal da corrediça (fundo). */
  bodyDepthMm: number;
  /** Comprimento das laterais/costa (corrediça − 10 mm). */
  sideDepthMm: number;
  combinedFrontThicknessMm: number;
  floorThicknessMm: number;
  backThicknessMm: number;
}): DrawerViewerWoodBottomBackLayoutMm {
  const sideY = Number(input.sidePosYMm);
  const sideH = Math.max(0, Number(input.sideHeightMm));
  const floorT = Math.max(0, Number(input.floorThicknessMm));
  const backT = Math.max(0, Number(input.backThicknessMm));
  const bodyDepth = Math.max(0, Number(input.bodyDepthMm));
  const sideDepth = Math.max(0, Number(input.sideDepthMm));
  const bodyCenterZ = resolveDrawerBodyCenterZMm(
    input.combinedFrontThicknessMm,
    bodyDepth
  );
  const floorWidth = resolveDrawerViewerFloorWidthMm(
    input.internalWidthMm,
    input.sideThicknessMm
  );
  const floorPosY =
    sideY - sideH / 2 + DRAWER_VIEWER_FLOOR_ABOVE_SIDE_BASE_MM + floorT / 2;
  const backHeight = Math.max(
    1,
    sideH - DRAWER_VIEWER_FLOOR_ABOVE_SIDE_BASE_MM - floorT
  );
  const backPosY = sideY + sideH / 2 - backHeight / 2;
  const backPosZ = resolveDrawerBackCenterZMm(
    input.combinedFrontThicknessMm,
    sideDepth > 0 ? sideDepth : bodyDepth,
    backT
  );

  return {
    floorWidthMm: floorWidth,
    floorDepthMm: bodyDepth,
    floorThicknessMm: floorT,
    floorPosYMm: floorPosY,
    floorPosZMm: bodyCenterZ,
    backWidthMm: floorWidth,
    backHeightMm: backHeight,
    backThicknessMm: backT,
    backPosYMm: backPosY,
    backPosZMm: backPosZ,
  };
}

/** Compensação viewer quando carcaça usa P útil ≠ P externa (igual às portas). */
export function resolveDrawerViewerPosZAdjustmentMm(
  profundidadeExternaMm: number,
  profundidadeInternaUtilMm: number
): number {
  return (profundidadeInternaUtilMm - profundidadeExternaMm) / 2;
}

/** Posições flush no sistema local da caixa (mm). Origem = centro da caixa. */
export type DrawerFrontFlushLayoutMm = {
  frontOuterZ: number;
  frontPosZ: number;
  bodyCenterZ: number;
  bodyDepthMm: number;
  /** Relativo ao centro da frente (frontOffsetZ = 0). */
  bodyCenterLocalZ: number;
};

/**
 * Flush viewer da frente overlay face à carcaça 3D (P_útil).
 *
 * IMPORTANTE: `P_útil` já desconta a espessura da frente. Por isso NÃO se pode
 * aplicar o `dz` das portas (`(P_útil−P_ext)/2`) sobre o centro P_ext — isso
 * enterra a frente quase toda dentro da caixa (regressão FASE A).
 *
 * Regra correcta (overlay):
 *   face da carcaça  = P_útil / 2
 *   face exterior    = P_útil / 2 + espFrente + overhang (1 mm)
 *   centro da frente = face exterior − espFrente / 2
 *
 * O corpo fica imediatamente atrás da frente em coords locais
 * (`bodyCenterLocalZ = −(espFrente/2 + bodyDepth/2)`); o grupo usa `frontPosZ`
 * como origem — sem offset extra em `groupPosZ`.
 *
 * `profundidadeExternaMm` mantém-se na assinatura (domínio / callers) mas o Z
 * do flush viewer ancora-se na carcaça 3D (P_útil).
 */
export function resolveDrawerFrontFlushLayoutMm(
  profundidadeExternaMm: number,
  profundidadeUtilMm: number,
  frontThicknessMm: number,
  folgaCorredicaMm: number
): DrawerFrontFlushLayoutMm {
  void profundidadeExternaMm;
  const frontT = Math.max(0, Number(frontThicknessMm));
  const carcassFrontZ = Math.max(0, Number(profundidadeUtilMm)) / 2;
  const frontOuterZ =
    carcassFrontZ + frontT + DRAWER_FRONT_FACE_OVERHANG_MM;
  const frontPosZ = frontOuterZ - frontT / 2;
  const bodyDepthMm = resolveDrawerViewerBodyDepthMm(profundidadeUtilMm, folgaCorredicaMm);
  const bodyCenterZ = resolveDrawerBodyCenterZFromFrontMm(frontPosZ, frontT, bodyDepthMm);
  return {
    frontOuterZ,
    frontPosZ,
    bodyCenterZ,
    bodyDepthMm,
    bodyCenterLocalZ: bodyCenterZ - frontPosZ,
  };
}

function boxFromCenter(
  name: string,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number
): DrawerViewerPieceBox {
  return {
    name,
    minX: cx - sx / 2,
    maxX: cx + sx / 2,
    minY: cy - sy / 2,
    maxY: cy + sy / 2,
    minZ: cz - sz / 2,
    maxZ: cz + sz / 2,
  };
}

export function boxesOverlap(a: DrawerViewerPieceBox, b: DrawerViewerPieceBox, epsilon = 0.05): boolean {
  return !(
    a.maxX <= b.minX + epsilon ||
    b.maxX <= a.minX + epsilon ||
    a.maxY <= b.minY + epsilon ||
    b.maxY <= a.minY + epsilon ||
    a.maxZ <= b.minZ + epsilon ||
    b.maxZ <= a.minZ + epsilon
  );
}

/** Caixas axis-aligned das peças madeira (mm) para validação de intersecção. */
export function buildDrawerWoodViewerPieceBoxes(input: {
  frontWidthMm: number;
  frontHeightMm: number;
  frontThicknessMm: number;
  bodyWidthMm: number;
  slideLengthMm: number;
  sideThicknessMm: number;
  woodBodyHeightMm: number;
  bottomThicknessMm: number;
  backThicknessMm: number;
  backWidthMm: number;
  baseElevationMm?: number;
}): DrawerViewerPieceBox[] {
  const woodH = input.woodBodyHeightMm;
  const offsetY = resolveDrawerBodyCenterOffsetYMm(
    input.frontHeightMm,
    woodH,
    input.baseElevationMm
  );
  const combinedFront = input.frontThicknessMm;
  const sideDepth = resolveDrawerSideDepthMm(input.slideLengthMm);
  const bodyZ = resolveDrawerBodyCenterZMm(combinedFront, sideDepth);
  const floorZ = resolveDrawerBodyCenterZMm(combinedFront, input.slideLengthMm);
  const backZ = resolveDrawerBackCenterZMm(combinedFront, sideDepth, input.backThicknessMm);
  const bottomY = resolveDrawerBottomCenterYMm(woodH, input.bottomThicknessMm, offsetY);
  const halfW = input.bodyWidthMm / 2;

  return [
    boxFromCenter("frente_ext", 0, 0, 0, input.frontWidthMm, input.frontHeightMm, input.frontThicknessMm),
    boxFromCenter(
      "lat_esq",
      -halfW + input.sideThicknessMm / 2,
      offsetY,
      bodyZ,
      input.sideThicknessMm,
      woodH,
      sideDepth
    ),
    boxFromCenter(
      "lat_dir",
      halfW - input.sideThicknessMm / 2,
      offsetY,
      bodyZ,
      input.sideThicknessMm,
      woodH,
      sideDepth
    ),
    boxFromCenter("fundo", 0, bottomY, floorZ, input.backWidthMm, input.bottomThicknessMm, input.slideLengthMm),
    boxFromCenter("costa", 0, offsetY, backZ, input.backWidthMm, woodH, input.backThicknessMm),
  ];
}

export function assertDrawerWoodPiecesDisjoint(boxes: DrawerViewerPieceBox[]): string | null {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i]!, boxes[j]!)) {
        return `${boxes[i]!.name} intersecta ${boxes[j]!.name}`;
      }
    }
  }
  return null;
}
