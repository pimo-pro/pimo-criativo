import type { PanelDrillHole } from "../../core/types";
import type { RulesConfig } from "../../core/rules/rulesConfig";
import {
  getHingeYPositions,
  getNumDobradicas,
  MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM,
} from "../../core/rules/rulesConfig";
import { clampTopDownYMm } from "../../core/drilling/drillingService";

const HOLE_DRILLING_TOL_MM = 0.2;

const HINGE_HOLE_TYPES = new Set([
  "dobradica",
  "dobradica_fixacao",
  "dobradica_parafuso_uniao",
]);

/**
 * Offsets globais (mm desde a base do vão) → offsets locais da peça (mm desde a base da peça).
 * Descarta posições fora da altura real do painel.
 */
export function lateralLocalOffsetsFromOpeningGlobal(
  globalOffsets: number[] | undefined,
  pieceAlturaMm: number,
  pieceBottomFromOpeningMm = 0
): number[] {
  if (!Array.isArray(globalOffsets) || !Number.isFinite(pieceAlturaMm) || pieceAlturaMm <= 0) return [];
  const margin = MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM;
  const minO = margin;
  const maxO = Math.max(minO, pieceAlturaMm - margin);
  return globalOffsets
    .map((g) => Number(g) - pieceBottomFromOpeningMm)
    .filter((oy) => Number.isFinite(oy) && oy >= minO && oy <= maxO);
}

/**
 * Detecta offsets calculados com largura (profundidade) em vez de altura — ex. getHingeYPositions(758) → 658 numa peça 598 mm.
 */
export function remapHingeOffsetsIfLarguraHeightConfusion(
  offsets: number[],
  larguraMm: number,
  alturaMm: number,
  rules: RulesConfig
): number[] {
  if (!offsets.length || !Number.isFinite(larguraMm) || !Number.isFinite(alturaMm) || larguraMm === alturaMm) {
    return offsets;
  }
  const fromLargura = getHingeYPositions(larguraMm, getNumDobradicas(larguraMm, rules), rules);
  if (fromLargura.length === 0) return offsets;
  const matchesLarguraPattern =
    offsets.length === fromLargura.length &&
    offsets.every((o, i) => Math.abs(o - fromLargura[i]!) < 1.5);
  if (!matchesLarguraPattern) return offsets;
  const fromAltura = getHingeYPositions(alturaMm, getNumDobradicas(alturaMm, rules), rules);
  return fromAltura.length > 0 ? fromAltura : offsets;
}

/** Última barreira: remove furos de dobradiça fora dos limites da peça. */
export function filterHingePanelDrillHolesToPieceBounds(
  holes: PanelDrillHole[] | undefined,
  larguraMm: number,
  alturaMm: number,
  tolMm = HOLE_DRILLING_TOL_MM
): PanelDrillHole[] {
  if (!holes?.length) return [];
  return holes.filter((h) => {
    const x = Number(h.x);
    const y = Number(h.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < -tolMm || y < -tolMm || x > larguraMm + tolMm || y > alturaMm + tolMm) {
      return !HINGE_HOLE_TYPES.has(h.holeType ?? "");
    }
    return true;
  });
}

export function offsetFromBaseToTopDownY(
  oyFromBaseMm: number,
  alturaMm: number,
  diameter = 5
): number {
  return clampTopDownYMm(alturaMm - oyFromBaseMm, alturaMm, diameter);
}
