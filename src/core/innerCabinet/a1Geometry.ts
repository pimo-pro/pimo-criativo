/**
 * Geometria — caixa interna dinâmica a_1 (subset cutlist, não WorkspaceBox filha).
 * Largura = vão SEP↔DIV; profundidade = SSOT mãe; altura configurável.
 */

import { getProfundidadeInternaUtilMm } from "../box/boxDepthHelpers";
import { resolveActiveDrawersLayer, resolveActiveGavetasCount } from "../drawers";
import { resolveCostaThicknessMm } from "../materials/materials.api";
import type { BoxModule } from "../types";
import {
  computePartialSepWidthMm,
  isPartialSepCavilhaOnly,
} from "../wardrobe/partialSepToDiv";
import {
  computeWardrobeLocalLayout,
  getWardrobeSideDrawerSide,
  isWardrobeModel,
} from "../wardrobe/wardrobeRules";
import {
  HINGE_COMPENSATION_MM,
  resolveHingeCompensationSide,
} from "./hingeCompensation40";

export const INNER_CABINET_A1_PRODUCT_MODE = "inner_cabinet_a1";
export const INNER_CABINET_A1_DEFAULT_HEIGHT_MM = 400;
export const INNER_CABINET_A1_DEFAULT_DRAWER_COUNT = 1;

export function boxUsesInnerCabinetA1(box: {
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
  return id === INNER_CABINET_A1_PRODUCT_MODE || id.includes("inner_cabinet_a1");
}

export type A1Layout = {
  espessuraMm: number;
  /** Vão SEP↔DIV (antes da compensação −40). */
  spanSepDivMm: number;
  /** Largura exterior útil da a_1 após −40 no lado da dobradiça. */
  outerWidthMm: number;
  heightMm: number;
  depthMm: number;
  lateralAlturaMm: number;
  lateralProfundidadeMm: number;
  cimaLarguraMm: number;
  cimaProfundidadeMm: number;
  fundoLarguraMm: number;
  fundoProfundidadeMm: number;
  drawerCount: number;
  drawerZoneHeightMm: number;
  hingeSide: "left" | "right";
  compensationMm: number;
};

/** Largura dinâmica SEP↔DIV (lê SEP parcial Fase C ou layout wardrobe). */
export function resolveA1SpanSepDivMm(box: BoxModule): number {
  const partial = (box.separadores ?? []).find((s) => isPartialSepCavilhaOnly(s));
  if (partial?.larguraMm != null && partial.larguraMm > 0) {
    return Number(partial.larguraMm);
  }

  if (isWardrobeModel(box.baseCabinetId)) {
    const feet = Math.max(40, box.feetHeight ?? (box.pe_cm ?? 10) * 10);
    const layout = computeWardrobeLocalLayout({
      baseCabinetId: box.baseCabinetId,
      widthMm: Number(box.dimensoes.largura) || 0,
      heightMm: Number(box.dimensoes.altura) || 0,
      depthMm: Number(box.dimensoes.profundidade) || 0,
      feetHeightMm: feet,
    });
    if (layout.verticalDividerFromLeftMm != null) {
      return computePartialSepWidthMm({
        widthMm: Number(box.dimensoes.largura) || 0,
        verticalDividerFromLeftMm: layout.verticalDividerFromLeftMm,
        side: getWardrobeSideDrawerSide(box.baseCabinetId),
        thicknessMm: Number(box.espessura) || 19,
      });
    }
  }

  // Fallback: metade da largura interna (sem inventar fórmulas globais novas)
  const T = Math.max(1, Number(box.espessura) || 19);
  const W = Number(box.dimensoes.largura) || 0;
  return Math.max(1, (W - 3 * T) / 2 - 2);
}

export function resolveA1HeightMm(box: BoxModule): number {
  const fromBox = Number(box.alturaGaveta) || 0;
  if (fromBox > 0) return fromBox;
  return INNER_CABINET_A1_DEFAULT_HEIGHT_MM;
}

export function resolveA1DrawerCount(box: BoxModule): number {
  const n = Math.max(0, Math.floor(Number(box.gavetas) || 0));
  return Math.max(
    INNER_CABINET_A1_DEFAULT_DRAWER_COUNT,
    n || INNER_CABINET_A1_DEFAULT_DRAWER_COUNT
  );
}

export function computeA1Layout(box: BoxModule): A1Layout {
  const espessuraMm = Math.max(1, Number(box.espessura) || 19);
  const spanSepDivMm = resolveA1SpanSepDivMm(box);
  const hingeSide = resolveHingeCompensationSide(box);
  const compensationMm = HINGE_COMPENSATION_MM;
  const outerWidthMm = Math.max(1, spanSepDivMm - compensationMm);

  const heightMm = resolveA1HeightMm(box);
  const profundidadeExterna =
    Number(box.profundidadeExterna ?? box.dimensoes.profundidade) || 0;
  const depthMm = Math.max(
    0,
    getProfundidadeInternaUtilMm(
      {
        dimensoes: { profundidade: profundidadeExterna },
        espessura: box.espessura,
        portaTipo: box.portaTipo,
        doorsLayer: box.doorsLayer,
        drawersLayer: resolveActiveDrawersLayer(box),
        gavetas: resolveActiveGavetasCount(box),
        costaAtiva: box.costaAtiva,
      },
      resolveCostaThicknessMm(box)
    )
  );

  const lateralAlturaMm = Math.max(0, heightMm - 2 * espessuraMm);
  const drawerCount = resolveA1DrawerCount(box);
  const drawerZoneHeightMm = Math.max(1, Math.floor(lateralAlturaMm / drawerCount));

  return {
    espessuraMm,
    spanSepDivMm,
    outerWidthMm,
    heightMm,
    depthMm,
    lateralAlturaMm,
    lateralProfundidadeMm: depthMm,
    cimaLarguraMm: outerWidthMm,
    cimaProfundidadeMm: depthMm,
    fundoLarguraMm: outerWidthMm,
    fundoProfundidadeMm: depthMm,
    drawerCount,
    drawerZoneHeightMm,
    hingeSide,
    compensationMm,
  };
}
