/**
 * Layout industrial — produto gaveta_porta_sep_prateleiras (GPS).
 * Variante «gaveta embutida» (v1): gaveta em baixo + SEP (= SIP) + porta parcial + prateleiras.
 *
 * Contrato validado:
 * - SIP ≡ SEP intermédio (um único painel horizontal; id sep-gaveta-porta).
 * - Porta: meio do SEP → face inferior da CIMA − 2 mm; folga 2 mm laterais.
 * - Frente: altura = zona da gaveta − 2×folga (2 mm); cobre o vão da zona
 *   com folga em cima e em baixo (não fica “presa” entre letras CIMA/FUNDO).
 * - Overlay FUN (2 mm) é detalhe de produto, não limita a altura visual da frente.
 * - v1: só posição bottom (topo = fase futura).
 * - Gate por baseCabinetId; não altera caixa clássica nem gaveteiro n≥2.
 * - bodyBottom SSOT 18,5 / guia 41 permanecem; elevação frente↔corpo GPS
 *   deriva da base da frente na zona (folga sobre floorTop).
 *
 * Não altera fórmulas globais de L/A/P da caixa.
 */

import { getDoorVerticalEdges } from "../doors/doorLayerGeometry";
import { DOOR_OVERLAY_FABRICO_MM } from "../doors/doorRules/doorRulesDefaults";
import {
  DRAWER_FRONT_LATERAL_GAP_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
} from "../drawers/drawerGeometryConstants";
import type { SeparadorItem } from "../divSep/types";
import type { BoxModule } from "../types";

export const GAVETA_PORTA_SEP_PRODUCT_MODE_ID = "gaveta_porta_sep_prateleiras";
/** Nome industrial de catálogo / Admin (Fase 5–6). */
export const GAVETA_PORTA_SEP_NOME_INDUSTRIAL =
  "Gaveta embutida + porta + SEP + prateleiras";
export const GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM = 180;
/** Folga industrial 2 mm em toda a frente (gaveta e porta). */
export const GAVETA_PORTA_SEP_FRONT_GAP_MM = DRAWER_FRONT_LATERAL_GAP_MM;
export const GAVETA_PORTA_SEP_DOOR_GAP_MM = DOOR_OVERLAY_FABRICO_MM;
export const GAVETA_PORTA_SEP_SEP_ID = "sep-gaveta-porta";
/**
 * Overlay inferior de produto abaixo da aresta exterior do FUN (mm).
 * Detalhe GPS — não define a altura/posição visual da frente (usa-se zona − 2×folga).
 */
export const GAVETA_PORTA_SEP_FUNDO_OVERLAY_BELOW_MM = 2;
/** v1: apenas gaveta em baixo. */
export type GavetaPortaSepDrawerPosition = "bottom";
export const GAVETA_PORTA_SEP_DRAWER_POSITION_V1: GavetaPortaSepDrawerPosition = "bottom";

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
  drawerPosition: GavetaPortaSepDrawerPosition;
  /** Altura da zona inferior (corpo/vão da gaveta). */
  drawerZoneHeightMm: number;
  /** Frente: zona − 2×folga (cobre o vão da zona). */
  drawerFrontHeightMm: number;
  /** Frente gaveta: largura exterior − 2×folga. */
  drawerFrontWidthMm: number;
  /** Aresta inferior absoluta da frente (origem = base exterior da caixa). */
  drawerFrontBottomAbsMm: number;
  /** Aresta superior absoluta da frente (topo da zona − folga). */
  drawerFrontTopAbsMm: number;
  /** Centro Y local da frente (origem = centro da caixa). */
  drawerFrontCenterYLocalMm: number;
  /**
   * Base da frente relativa ao floorTop (face superior do FUN).
   * Positivo = folga acima do FUN dentro da zona.
   */
  drawerFrontBottomFromFloorTopMm: number;
  /**
   * Elevação corpo↔frente GPS-only para bodyBottom absoluto 18,5.
   * = 18,5 − drawerFrontBottomFromFloorTopMm.
   */
  drawerBodyElevationFromFrontMm: number;
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
 * Frente: cobre a zona da gaveta com folga 2 mm em cima e em baixo (zona − 2×folga).
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

  // SEP acima da zona da gaveta: centerY = T + positionMm → positionMm = H_gav + T/2
  const sepPositionMm = drawerZoneHeightMm + espessuraMm / 2;
  const sepCenterYAbsMm = espessuraMm + sepPositionMm;

  // Zona da gaveta: floorTop (= T) … floorTop + zona. Frente = zona − 2×folga.
  const zoneBottomAbsMm = espessuraMm; // floorTop
  const zoneTopAbsMm = espessuraMm + drawerZoneHeightMm;
  const drawerFrontBottomAbsMm = zoneBottomAbsMm + gap;
  const drawerFrontTopAbsMm = zoneTopAbsMm - gap;
  const drawerFrontHeightMm = Math.max(1, drawerFrontTopAbsMm - drawerFrontBottomAbsMm);
  const drawerFrontWidthMm = Math.max(1, boxWidthMm - 2 * gap);
  const drawerFrontBottomFromFloorTopMm = drawerFrontBottomAbsMm - espessuraMm; // = gap
  const drawerBodyElevationFromFrontMm =
    DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM - drawerFrontBottomFromFloorTopMm;
  const drawerFrontCenterAbsMm = (drawerFrontTopAbsMm + drawerFrontBottomAbsMm) / 2;
  const drawerFrontCenterYLocalMm = drawerFrontCenterAbsMm - boxHeightMm / 2;

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
    drawerPosition: GAVETA_PORTA_SEP_DRAWER_POSITION_V1,
    drawerZoneHeightMm,
    drawerFrontHeightMm,
    drawerFrontWidthMm,
    drawerFrontBottomAbsMm,
    drawerFrontTopAbsMm,
    drawerFrontCenterYLocalMm,
    drawerFrontBottomFromFloorTopMm,
    drawerBodyElevationFromFrontMm,
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

/** Frente: altura = zona − 2×folga; topo = topo da zona − folga. */
export function assertFrontCoversDrawerZone(layout: GavetaPortaSepLayout, eps = 0.6): boolean {
  const gap = GAVETA_PORTA_SEP_FRONT_GAP_MM;
  const expectedH = layout.drawerZoneHeightMm - 2 * gap;
  const expectedBottom = layout.espessuraMm + gap;
  const expectedTop = layout.espessuraMm + layout.drawerZoneHeightMm - gap;
  return (
    Math.abs(layout.drawerFrontHeightMm - expectedH) <= eps &&
    Math.abs(layout.drawerFrontBottomAbsMm - expectedBottom) <= eps &&
    Math.abs(layout.drawerFrontTopAbsMm - expectedTop) <= eps
  );
}

/** @deprecated Preferir assertFrontCoversDrawerZone — frente já não vai ao meio do SEP. */
export function assertFrontReachesSepMid(layout: GavetaPortaSepLayout, eps = 0.6): boolean {
  return assertFrontCoversDrawerZone(layout, eps);
}

/** @deprecated Preferir assertFrontCoversDrawerZone — frente já não ancora em −overlay FUN. */
export function assertFrontOverlaysFundo(layout: GavetaPortaSepLayout, eps = 0.6): boolean {
  return (
    Math.abs(layout.drawerFrontBottomFromFloorTopMm - GAVETA_PORTA_SEP_FRONT_GAP_MM) <= eps
  );
}
