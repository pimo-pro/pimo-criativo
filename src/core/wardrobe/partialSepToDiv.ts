/**
 * SEP parcial roupeiro → DIV (apenas cavilha 10×30 / 10×13).
 * Não altera SEP2 visual (horizontalDivider) nem fórmulas globais L/A/P.
 */

import { SYSTEM_THICKNESS_MM } from "../baseCabinets";
import type { DivisorItem, SeparadorItem } from "../divSep/types";
import {
  computeWardrobeLocalLayout,
  getWardrobeSideDrawerSide,
  hasWardrobeSideDrawerBox,
  type WardrobeDrawerSide,
} from "./wardrobeRules";

export const WARDROBE_PARTIAL_SEP_PRODUCT_MODE = "wardrobe_sep_parcial_gavetas";
export const WARDROBE_PARTIAL_SEP_ID_RIGHT = "sep-parcial-caixa-dir";
export const WARDROBE_PARTIAL_SEP_ID_LEFT = "sep-parcial-caixa-esq";
export const WARDROBE_PARTIAL_DIV_ID = "div-wardrobe-side";

export function boxUsesWardrobePartialSep(box: {
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
  return hasWardrobeSideDrawerBox(custom ?? box.baseCabinetId);
}

export function isPartialSepCavilhaOnly(sep: Pick<SeparadorItem, "id">): boolean {
  const id = String(sep.id ?? "");
  return id === WARDROBE_PARTIAL_SEP_ID_RIGHT || id === WARDROBE_PARTIAL_SEP_ID_LEFT;
}

export function partialSepIdForSide(side: WardrobeDrawerSide): string {
  return side === "left" ? WARDROBE_PARTIAL_SEP_ID_LEFT : WARDROBE_PARTIAL_SEP_ID_RIGHT;
}

export function partialSepSideFromId(sepId: string): WardrobeDrawerSide {
  return sepId === WARDROBE_PARTIAL_SEP_ID_LEFT ? "left" : "right";
}

/** Largura SEP parcial: lateral do lado → face do DIV (− folgas). */
export function computePartialSepWidthMm(params: {
  widthMm: number;
  verticalDividerFromLeftMm: number;
  side: WardrobeDrawerSide;
  thicknessMm?: number;
  clearanceMm?: number;
}): number {
  const T = params.thicknessMm ?? SYSTEM_THICKNESS_MM;
  const clear = params.clearanceMm ?? 2;
  const divLeft = params.verticalDividerFromLeftMm - T / 2;
  const divRight = params.verticalDividerFromLeftMm + T / 2;
  if (params.side === "right") {
    const innerRight = params.widthMm - T;
    return Math.max(1, innerRight - divRight - clear);
  }
  const innerLeft = T;
  return Math.max(1, divLeft - innerLeft - clear);
}

export type PartialSepToDivBuildResult = {
  side: WardrobeDrawerSide;
  sep: SeparadorItem;
  div: DivisorItem;
  sepWidthMm: number;
  sepPositionMm: number;
};

/**
 * Gera SEP parcial (referenceEdge: bottom) + DIV ligado só por cavilha.
 * positionMm do SEP = topo da zona inferior de gavetas (SEP2 visual permanece intacto).
 */
export function buildPartialSepToDivItems(params: {
  baseCabinetId?: string | null;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  feetHeightMm: number;
  espessuraMm?: number;
}): PartialSepToDivBuildResult {
  const side = getWardrobeSideDrawerSide(params.baseCabinetId);
  const layout = computeWardrobeLocalLayout({
    baseCabinetId: params.baseCabinetId,
    widthMm: params.widthMm,
    heightMm: params.heightMm,
    depthMm: params.depthMm,
    feetHeightMm: params.feetHeightMm,
  });
  const T = params.espessuraMm ?? SYSTEM_THICKNESS_MM;
  const fromLeft = layout.verticalDividerFromLeftMm;
  if (fromLeft == null) {
    throw new Error("buildPartialSepToDivItems requer DIV vertical activo (largura >= 800)");
  }

  const sepWidthMm = computePartialSepWidthMm({
    widthMm: params.widthMm,
    verticalDividerFromLeftMm: fromLeft,
    side,
    thicknessMm: T,
  });

  const lowerH = layout.drawerCompartmentBoxHeightForGen_mm ?? 300;
  const sepPositionMm = Math.max(T, lowerH - T / 2);
  const sepId = partialSepIdForSide(side);

  const sep: SeparadorItem = {
    id: sepId,
    positionMm: sepPositionMm,
    referenceEdge: "bottom",
    larguraMm: sepWidthMm,
  };

  // Centro DIV desde aresta esquerda externa ≈ fromLeft;
  // resolveDivisorCenterX (ref left): center ≈ T + positionMm ⇒ positionMm = fromLeft - T
  const div: DivisorItem = {
    id: WARDROBE_PARTIAL_DIV_ID,
    positionMm: Math.max(T / 2, fromLeft - T),
    referenceEdge: "left",
    linkedSeparadorId: sepId,
  };

  return { side, sep, div, sepWidthMm, sepPositionMm };
}

/** X absoluto da aresta esquerda do SEP parcial (para pairing DIV no drill). */
export function resolvePartialSepLeftXAbsMm(
  box: { dimensoes: { largura: number }; espessura: number },
  sep: SeparadorItem,
  side: WardrobeDrawerSide
): number {
  const T = Math.max(1, Number(box.espessura) || SYSTEM_THICKNESS_MM);
  const W = Number(box.dimensoes.largura) || 0;
  const larguraInterna = Math.max(0, W - 2 * T);
  const sepW = Number(sep.larguraMm) || Math.max(1, larguraInterna - 2);
  if (side === "right") {
    return T + larguraInterna - sepW;
  }
  return T;
}

/** Sync aditivo: SEP parcial + DIV; nunca remove outros SEP. */
export function syncWardrobePartialSepBox<
  T extends {
    baseCabinetId?: string | null;
    dimensoes: { largura: number; altura: number; profundidade: number };
    espessura: number;
    feetHeight?: number;
    pe_cm?: number;
    separadores?: SeparadorItem[];
    divisores?: DivisorItem[];
  },
>(box: T): T {
  if (!boxUsesWardrobePartialSep(box)) return box;
  const feetHeightMm = Math.max(40, box.feetHeight ?? (box.pe_cm ?? 10) * 10);
  const built = buildPartialSepToDivItems({
    baseCabinetId: box.baseCabinetId,
    widthMm: box.dimensoes.largura,
    heightMm: box.dimensoes.altura,
    depthMm: box.dimensoes.profundidade,
    feetHeightMm,
    espessuraMm: box.espessura,
  });

  const seps = [...(box.separadores ?? [])].filter((s) => !isPartialSepCavilhaOnly(s));
  seps.push(built.sep);

  const divs = [...(box.divisores ?? [])].filter((d) => d.id !== WARDROBE_PARTIAL_DIV_ID);
  divs.push(built.div);

  return { ...box, separadores: seps, divisores: divs };
}
