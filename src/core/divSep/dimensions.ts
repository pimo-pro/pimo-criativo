import { getProfundidadeInternaUtilMm } from "../box/boxDepthHelpers";
import { resolveCostaThicknessMm } from "../materials/materials.api";
import {
  isPartialSepCavilhaOnly,
  partialSepSideFromId,
  resolvePartialSepLeftXAbsMm,
} from "../wardrobe/partialSepToDiv";
import { getDivSepRules } from "./cavilhaRules";
import {
  resolveDivisorLinkedHeightMm,
  resolveEffectiveLinkedSeparador,
} from "./coupling";
import type { DivisorItem, DivSepBoxLike, SeparadorItem } from "./types";
import { resolveAncoraHorizontal } from "./types";

const SHELF_WIDTH_CLEARANCE_MM = 2;
const SHELF_DEPTH_CLEARANCE_MM = 5;

export type DivSepInternalDims = {
  larguraInterna: number;
  alturaInterna: number;
  profundidadeInterna: number;
  espessura: number;
};

export function getDivSepInternalDims(box: DivSepBoxLike): DivSepInternalDims {
  const espessura = Math.max(1, Number(box.espessura) || 19);
  const largura = Number(box.dimensoes.largura) || 0;
  const altura = Number(box.dimensoes.altura) || 0;
  const profundidadeExterna = Number(box.profundidadeExterna ?? box.dimensoes.profundidade) || 0;
  const espessuraCostaMm = resolveCostaThicknessMm(box as Parameters<typeof resolveCostaThicknessMm>[0]);
  const profundidadeInterna = getProfundidadeInternaUtilMm(
    {
      dimensoes: { profundidade: profundidadeExterna },
      espessura,
      portaTipo: box.portaTipo as "sem_porta" | "porta_simples" | "porta_dupla" | "porta_correr" | undefined,
      doorsLayer: box.doorsLayer as { width?: number }[] | undefined,
      drawersLayer: box.drawersLayer as { frontThickness?: number }[] | undefined,
      gavetas: box.gavetas,
      costaAtiva: box.costaAtiva,
    },
    espessuraCostaMm
  );
  return {
    larguraInterna: Math.max(0, largura - espessura * 2),
    alturaInterna: Math.max(0, altura - espessura * 2),
    profundidadeInterna: Math.max(0, profundidadeInterna),
    espessura,
  };
}

/** Centro X do DIV sem depender de altura (evita ciclos com SEP parcial). */
function resolveDivisorCenterXLight(box: DivSepBoxLike, item: DivisorItem): number {
  const internal = getDivSepInternalDims(box);
  const half = internal.espessura / 2;
  const pos = Math.max(0, Number(item.positionMm) || 0);
  const minX = internal.espessura + half;
  const maxX = internal.espessura + internal.larguraInterna - half;
  if (item.referenceEdge === "right") {
    const fromRight = internal.espessura + internal.larguraInterna - pos;
    return Math.min(maxX, Math.max(minX, fromRight));
  }
  const fromLeft = internal.espessura + pos;
  return Math.min(maxX, Math.max(minX, fromLeft));
}

/**
 * Largura SEP por âncora horizontal a partir dos DIV existentes.
 * Sem DIV: mesma largura que completo (não inventa meio vão).
 */
function resolveAncloredSeparadorWidthMm(
  box: DivSepBoxLike,
  ancora: "esquerda" | "direita"
): number {
  const internal = getDivSepInternalDims(box);
  const clear = SHELF_WIDTH_CLEARANCE_MM;
  const divisores = box.divisores ?? [];
  if (divisores.length === 0) {
    return Math.max(1, internal.larguraInterna - clear);
  }

  const half = internal.espessura / 2;
  if (ancora === "direita") {
    let rightmost = resolveDivisorCenterXLight(box, divisores[0]!);
    for (let i = 1; i < divisores.length; i++) {
      const cx = resolveDivisorCenterXLight(box, divisores[i]!);
      if (cx > rightmost) rightmost = cx;
    }
    const divRight = rightmost + half;
    const innerRight = internal.espessura + internal.larguraInterna;
    return Math.max(1, innerRight - divRight - clear);
  }

  let leftmost = resolveDivisorCenterXLight(box, divisores[0]!);
  for (let i = 1; i < divisores.length; i++) {
    const cx = resolveDivisorCenterXLight(box, divisores[i]!);
    if (cx < leftmost) leftmost = cx;
  }
  const divLeft = leftmost - half;
  const innerLeft = internal.espessura;
  return Math.max(1, divLeft - innerLeft - clear);
}

export function resolveDivisorDimensions(
  box: DivSepBoxLike,
  item: DivisorItem
): { larguraMm: number; alturaMm: number; profundidadeMm: number } {
  const internal = getDivSepInternalDims(box);
  const linkedSep = getDivSepRules().enableDivSepCombinations
    ? resolveEffectiveLinkedSeparador(box, item)
    : undefined;
  let alturaMm: number;
  if (linkedSep) {
    const ancora = resolveAncoraHorizontal(linkedSep);
    // SEP parcial genérico (SEP 2 esq/dir): DIV altura completa — encaixe lateral na face do DIV.
    // Wardrobe parcial e SEP completo mantêm acoplamento vertical (rosto a rosto).
    if (ancora !== "completo" && !isPartialSepCavilhaOnly(linkedSep)) {
      alturaMm = item.alturaMm ?? internal.alturaInterna;
    } else {
      alturaMm = resolveDivisorLinkedHeightMm(box, item, linkedSep);
    }
  } else {
    alturaMm = item.alturaMm ?? internal.alturaInterna;
  }
  return {
    larguraMm: internal.espessura,
    alturaMm: Math.max(1, alturaMm),
    profundidadeMm: item.profundidadeMm ?? Math.max(1, internal.profundidadeInterna - SHELF_DEPTH_CLEARANCE_MM),
  };
}

export function resolveSeparadorDimensions(
  box: DivSepBoxLike,
  item: SeparadorItem
): { larguraMm: number; alturaMm: number; profundidadeMm: number } {
  const internal = getDivSepInternalDims(box);
  const ancora = resolveAncoraHorizontal(item);
  let larguraMm: number;
  if (item.larguraMm != null && item.larguraMm > 0) {
    larguraMm = item.larguraMm;
  } else if (ancora === "esquerda" || ancora === "direita") {
    larguraMm = resolveAncloredSeparadorWidthMm(box, ancora);
  } else {
    larguraMm = Math.max(1, internal.larguraInterna - SHELF_WIDTH_CLEARANCE_MM);
  }
  return {
    larguraMm: Math.max(1, larguraMm),
    alturaMm: internal.espessura,
    profundidadeMm: item.profundidadeMm ?? Math.max(1, internal.profundidadeInterna - SHELF_DEPTH_CLEARANCE_MM),
  };
}

/**
 * Aresta esquerda absoluta do SEP (mm).
 * Completo = centrado; esquerda/direita = encostado à LAT; wardrobe parcial = helper dedicado.
 */
export function resolveSeparadorLeftXAbsMm(box: DivSepBoxLike, item: SeparadorItem): number {
  if (isPartialSepCavilhaOnly(item)) {
    const side = partialSepSideFromId(String(item.id));
    return resolvePartialSepLeftXAbsMm(box, item, side);
  }
  const internal = getDivSepInternalDims(box);
  const dims = resolveSeparadorDimensions(box, item);
  const ancora = resolveAncoraHorizontal(item);
  if (ancora === "esquerda") return internal.espessura;
  if (ancora === "direita") {
    return internal.espessura + internal.larguraInterna - dims.larguraMm;
  }
  return internal.espessura + (internal.larguraInterna - dims.larguraMm) / 2;
}

/** Centro X absoluto do SEP (mm). */
export function resolveSeparadorCenterX(box: DivSepBoxLike, item: SeparadorItem): number {
  const dims = resolveSeparadorDimensions(box, item);
  return resolveSeparadorLeftXAbsMm(box, item) + dims.larguraMm / 2;
}

/** Centro X absoluto do divisório (mm, origem = canto inferior-esquerdo-frontal da caixa). */
export function resolveDivisorCenterX(box: DivSepBoxLike, item: DivisorItem): number {
  return resolveDivisorCenterXLight(box, item);
}

/** Centro Y absoluto do separador (mm, origem = base da caixa). */
export function resolveSeparadorCenterY(box: DivSepBoxLike, item: SeparadorItem): number {
  const internal = getDivSepInternalDims(box);
  const dims = resolveSeparadorDimensions(box, item);
  const pos = Math.max(0, Number(item.positionMm) || 0);
  const minY = internal.espessura + dims.alturaMm / 2;
  const maxY = internal.espessura + internal.alturaInterna - dims.alturaMm / 2;
  if (item.referenceEdge === "top") {
    const alturaTotal = Number(box.dimensoes.altura) || 0;
    const fromTop = alturaTotal - internal.espessura - pos;
    return Math.min(maxY, Math.max(minY, fromTop));
  }
  const fromBottom = internal.espessura + pos;
  return Math.min(maxY, Math.max(minY, fromBottom));
}

export function clampDivisorPosition(box: DivSepBoxLike, item: DivisorItem, positionMm: number): number {
  const internal = getDivSepInternalDims(box);
  const dims = resolveDivisorDimensions(box, item);
  const half = dims.larguraMm / 2;
  const minPos = half;
  const maxPos = internal.larguraInterna - half;
  return Math.min(maxPos, Math.max(minPos, positionMm));
}

export function clampSeparadorPosition(box: DivSepBoxLike, item: SeparadorItem, positionMm: number): number {
  const internal = getDivSepInternalDims(box);
  const dims = resolveSeparadorDimensions(box, item);
  const half = dims.alturaMm / 2;
  const minPos = half;
  const maxPos = internal.alturaInterna - half;
  return Math.min(maxPos, Math.max(minPos, positionMm));
}
