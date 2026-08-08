/**
 * Layout industrial — produto gaveta_porta_sep_prateleiras.
 * Zonas: gaveta inferior + SEP intermédio + prateleiras superiores + porta parcial.
 * Não altera fórmulas globais de L/A/P da caixa.
 */

import { getDoorVerticalEdges } from "../doors/doorLayerGeometry";
import { DOOR_OVERLAY_FABRICO_MM } from "../doors/doorRules/doorRulesDefaults";
import { DRAWER_FRONT_LATERAL_GAP_MM } from "../drawers/drawerGeometryConstants";
import type { SeparadorItem } from "../divSep/types";
import type { BoxModule } from "../types";

export const GAVETA_PORTA_SEP_PRODUCT_MODE_ID = "gaveta_porta_sep_prateleiras";
export const GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM = 180;
/** Folga industrial 2 mm em toda a frente (gaveta e porta). */
export const GAVETA_PORTA_SEP_FRONT_GAP_MM = DRAWER_FRONT_LATERAL_GAP_MM;
export const GAVETA_PORTA_SEP_DOOR_GAP_MM = DOOR_OVERLAY_FABRICO_MM;
export const GAVETA_PORTA_SEP_SEP_ID = "sep-gaveta-porta";

export function boxUsesGavetaPortaSep(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}): boolean {
  const custom = box.customIndustrialModelId;
  if (
    typeof custom === "string" &&
    (custom.startsWith("industrial-") || custom.startsWith("custom-model-"))
  ) {
    return false;
  }
  const id = String(custom ?? box.baseCabinetId ?? "");
  return (
    id === GAVETA_PORTA_SEP_PRODUCT_MODE_ID ||
    id.includes("gaveta_porta_sep_prateleiras")
  );
}

export type GavetaPortaSepLayout = {
  espessuraMm: number;
  boxWidthMm: number;
  boxHeightMm: number;
  alturaInternaMm: number;
  /** Altura da zona inferior (corpo/vão da gaveta). */
  drawerZoneHeightMm: number;
  /** Frente gaveta: zona − 2×folga (altura). */
  drawerFrontHeightMm: number;
  /** Frente gaveta: largura exterior − 2×folga. */
  drawerFrontWidthMm: number;
  /** Centro Y absoluto do SEP (origem = base da caixa). */
  sepCenterYAbsMm: number;
  /** positionMm do SeparadorItem (referenceEdge: bottom). */
  sepPositionMm: number;
  /** Porta: base no meio do SEP → topo sob a CIMA − folga. */
  doorHeightMm: number;
  doorWidthMm: number;
  doorPosYMm: number;
  doorBottomEdgeLocalMm: number;
  doorTopEdgeLocalMm: number;
};

function resolveDrawerZoneHeightMm(box: {
  alturaGaveta?: number;
  dimensoes: { altura: number };
  espessura: number;
}): number {
  const T = Math.max(1, Number(box.espessura) || 19);
  const H = Number(box.dimensoes.altura) || 0;
  const H_int = Math.max(0, H - 2 * T);
  const maxZone = Math.max(80, H_int - 2 * T - 80);
  const fromBox = Number(box.alturaGaveta) || 0;
  if (fromBox > 0) return Math.min(fromBox, maxZone);
  return Math.min(GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM, maxZone);
}

/**
 * Calcula zonas. Coordenadas locais: Y=0 no centro da caixa.
 * Porta parcial: aresta inferior = meio do SEP; aresta superior = face inferior CIMA − 2 mm.
 */
export function computeGavetaPortaSepLayout(box: {
  dimensoes: { largura: number; altura: number; profundidade?: number };
  espessura: number;
  alturaGaveta?: number;
}): GavetaPortaSepLayout {
  const espessuraMm = Math.max(1, Number(box.espessura) || 19);
  const boxWidthMm = Number(box.dimensoes.largura) || 0;
  const boxHeightMm = Number(box.dimensoes.altura) || 0;
  const alturaInternaMm = Math.max(0, boxHeightMm - 2 * espessuraMm);
  const gap = GAVETA_PORTA_SEP_FRONT_GAP_MM;

  const drawerZoneHeightMm = resolveDrawerZoneHeightMm(box);
  const drawerFrontHeightMm = Math.max(1, drawerZoneHeightMm - 2 * gap);
  const drawerFrontWidthMm = Math.max(1, boxWidthMm - 2 * gap);

  // SEP acima da zona da gaveta: centerY = T + positionMm → positionMm = H_gav + T/2
  const sepPositionMm = drawerZoneHeightMm + espessuraMm / 2;
  const sepCenterYAbsMm = espessuraMm + sepPositionMm;

  const doorTopAbsMm = boxHeightMm - espessuraMm - gap;
  const doorBottomAbsMm = sepCenterYAbsMm;
  const doorHeightMm = Math.max(1, doorTopAbsMm - doorBottomAbsMm);
  const doorWidthMm = Math.max(1, boxWidthMm - 2 * gap);
  const doorCenterAbsMm = (doorTopAbsMm + doorBottomAbsMm) / 2;
  const doorPosYMm = doorCenterAbsMm - boxHeightMm / 2;

  const halfH = boxHeightMm / 2;
  return {
    espessuraMm,
    boxWidthMm,
    boxHeightMm,
    alturaInternaMm,
    drawerZoneHeightMm,
    drawerFrontHeightMm,
    drawerFrontWidthMm,
    sepCenterYAbsMm,
    sepPositionMm,
    doorHeightMm,
    doorWidthMm,
    doorPosYMm,
    doorBottomEdgeLocalMm: doorBottomAbsMm - halfH,
    doorTopEdgeLocalMm: doorTopAbsMm - halfH,
  };
}

export function buildGavetaPortaSepSeparador(layout: GavetaPortaSepLayout): SeparadorItem {
  return {
    id: GAVETA_PORTA_SEP_SEP_ID,
    positionMm: layout.sepPositionMm,
    referenceEdge: "bottom",
  };
}

/** Garante SEP intermédio no box (manufacturing / layers). */
export function syncGavetaPortaSepBox<T extends BoxModule>(box: T): T {
  if (!boxUsesGavetaPortaSep(box)) return box;
  const layout = computeGavetaPortaSepLayout(box);
  const sep = buildGavetaPortaSepSeparador(layout);
  const existing = box.separadores ?? [];
  const others = existing.filter((s) => s.id !== GAVETA_PORTA_SEP_SEP_ID);
  return {
    ...box,
    separadores: [sep, ...others],
    gavetas: Math.max(1, Math.floor(Number(box.gavetas) || 0) || 1),
    portaTipo: box.portaTipo === "sem_porta" ? "porta_simples" : box.portaTipo,
  };
}

export function assertDoorStartsAtSepMid(
  door: { height: number; posY: number },
  layout: GavetaPortaSepLayout,
  eps = 0.6
): boolean {
  const edges = getDoorVerticalEdges(door);
  return Math.abs(edges.bottomEdgeMm - layout.doorBottomEdgeLocalMm) <= eps;
}
