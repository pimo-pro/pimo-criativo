import { getDivSepRules } from "./cavilhaRules";
import {
  getDivSepInternalDims,
  resolveDivisorDimensions,
  resolveSeparadorCenterY,
  resolveSeparadorDimensions,
} from "./dimensions";
import type { DivisorItem, DivSepBoxLike, SeparadorItem } from "./types";
import { resolvePosicaoRelativaAoSep } from "./types";

export function findSeparadorById(
  box: DivSepBoxLike,
  separadorId: string | undefined
): SeparadorItem | undefined {
  if (!separadorId) return undefined;
  return (box.separadores ?? []).find((s) => s.id === separadorId);
}

export function isDivisorLinkedToSeparador(box: DivSepBoxLike, div: DivisorItem): boolean {
  return resolveEffectiveLinkedSeparador(box, div) != null;
}

/**
 * SEP efectivo para acoplamento geométrico.
 * Ligação explícita tem prioridade; DIV completo (altura livre) + SEP existentes
 * auto-converte para o SEP alvo (não atravessar o SEP).
 */
export function resolveEffectiveLinkedSeparador(
  box: DivSepBoxLike,
  div: DivisorItem
): SeparadorItem | undefined {
  const explicit = findSeparadorById(box, div.linkedSeparadorId);
  if (explicit) return explicit;
  if (!getDivSepRules().enableDivSepCombinations) return undefined;

  const seps = box.separadores ?? [];
  if (seps.length === 0) return undefined;

  const internal = getDivSepInternalDims(box);
  const isFullHeight =
    div.alturaMm == null || Number(div.alturaMm) >= internal.alturaInterna - 0.5;
  if (!isFullHeight) return undefined;

  return pickPreferredSeparadorForDiv(box, div, seps);
}

/** Preferir SEP cujo vão em X contém o centro do DIV; senão o primeiro. */
function pickPreferredSeparadorForDiv(
  box: DivSepBoxLike,
  div: DivisorItem,
  seps: SeparadorItem[]
): SeparadorItem {
  const internal = getDivSepInternalDims(box);
  const half = internal.espessura / 2;
  const pos = Math.max(0, Number(div.positionMm) || 0);
  const divCenterX =
    div.referenceEdge === "right"
      ? internal.espessura + internal.larguraInterna - pos
      : internal.espessura + pos;

  for (const sep of seps) {
    // Largura leve (sem resolveSeparadorDimensions) para evitar ciclo com dimensions.
    const larguraMm =
      sep.larguraMm != null && sep.larguraMm > 0
        ? sep.larguraMm
        : Math.max(1, internal.larguraInterna - 2);
    const leftX = resolveSepLeftXForPick(box, sep, larguraMm);
    const rightX = leftX + larguraMm;
    if (divCenterX >= leftX - half && divCenterX <= rightX + half) {
      return sep;
    }
  }
  return seps[0]!;
}

function resolveSepLeftXForPick(
  box: DivSepBoxLike,
  sep: SeparadorItem,
  larguraMm: number
): number {
  const internal = getDivSepInternalDims(box);
  const ancora = sep.ancoraHorizontal;
  if (ancora === "esquerda") return internal.espessura;
  if (ancora === "direita") {
    return internal.espessura + internal.larguraInterna - larguraMm;
  }
  return internal.espessura + (internal.larguraInterna - larguraMm) / 2;
}

/** Face inferior do SEP (mm absolutos, origem = base da caixa). */
export function resolveSeparadorBottomY(box: DivSepBoxLike, sep: SeparadorItem): number {
  const centerY = resolveSeparadorCenterY(box, sep);
  const dims = resolveSeparadorDimensions(box, sep);
  return centerY - dims.alturaMm / 2;
}

/** Face superior do SEP (mm absolutos, origem = base da caixa). */
export function resolveSeparadorTopY(box: DivSepBoxLike, sep: SeparadorItem): number {
  const dims = resolveSeparadorDimensions(box, sep);
  return resolveSeparadorBottomY(box, sep) + dims.alturaMm;
}

/**
 * Folga vertical DIV↔SEP (mm).
 * Encaixe industrial rosto a rosto: 0 (sem folga). Mantido como constante SSOT.
 */
export const DIV_SEP_VERTICAL_CLEARANCE_MM = 0;

/**
 * Altura do DIV ligado ao SEP (rosto a rosto).
 * - baixo: SEP.bottomY − FUNDO.topY
 * - cima: CIMA.bottomY − SEP.topY
 * Sem floor; aceita .5 quando T é ímpar.
 */
export function resolveDivisorLinkedHeightMm(
  box: DivSepBoxLike,
  div: DivisorItem,
  sep: SeparadorItem
): number {
  const internal = getDivSepInternalDims(box);
  if (resolvePosicaoRelativaAoSep(div) === "cima") {
    const sepTopY = resolveSeparadorTopY(box, sep);
    const cimaBottomY = internal.espessura + internal.alturaInterna;
    return Math.max(1, cimaBottomY - sepTopY);
  }
  const sepBottomY = resolveSeparadorBottomY(box, sep);
  const divBottomY = internal.espessura;
  return Math.max(1, sepBottomY - divBottomY);
}

/**
 * Y absoluto da base do DIV (topo do FUNDO ou topo do SEP se ligado acima).
 */
export function resolveDivisorBottomYAbs(box: DivSepBoxLike, div: DivisorItem): number {
  const internal = getDivSepInternalDims(box);
  const linkedSep = resolveEffectiveLinkedSeparador(box, div);
  if (linkedSep && resolvePosicaoRelativaAoSep(div) === "cima") {
    return resolveSeparadorTopY(box, linkedSep);
  }
  return internal.espessura;
}

/** Altura efetiva do DIV (acoplada ao SEP quando ligado / auto-convertido). */
export function resolveDivisorEffectiveHeightMm(box: DivSepBoxLike, div: DivisorItem): number {
  const linkedSep = resolveEffectiveLinkedSeparador(box, div);
  if (linkedSep) {
    return resolveDivisorLinkedHeightMm(box, div, linkedSep);
  }
  const dims = resolveDivisorDimensions(box, div);
  return dims.alturaMm;
}
