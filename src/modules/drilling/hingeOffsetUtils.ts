import type { PanelDrillHole } from "../../core/types";
import type { RulesConfig } from "../../core/rules/rulesConfig";
import {
  getHingeYPositions,
  getNumDobradicas,
  MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM,
} from "../../core/rules/rulesConfig";
import { clampTopDownYMm } from "../../core/drilling/drillingService";
import { shouldTraceHingePiece } from "./hingeDrillingTrace";

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
  const fromAltura = getHingeYPositions(alturaMm, getNumDobradicas(alturaMm, rules), rules);
  if (fromAltura.length === 0) return offsets;

  const matchesLarguraPattern =
    offsets.length === fromLargura.length &&
    offsets.every((o, i) => Math.abs(o - fromLargura[i]!) < 1.5);
  if (matchesLarguraPattern) {
    return fromAltura;
  }

  /* Offset isolado (ex. oy=658 numa peça 598) que coincide com getHingeYPositions(largura). */
  let remappedAny = false;
  const perOffset = offsets.flatMap((o) => {
    const idx = fromLargura.findIndex((fl) => Math.abs(fl - o) < 1.5);
    if (idx >= 0 && fromAltura[idx] != null) {
      remappedAny = true;
      return [fromAltura[idx]!];
    }
    const margin = MIN_MARGEM_DOBRADICA_TOP_BOTTOM_MM;
    if (o > alturaMm - margin + 0.5) {
      remappedAny = true;
      return [];
    }
    return [o];
  });
  return remappedAny ? perOffset : offsets;
}

type HoleLocalLike = { x: number; y: number; holeType?: string; diameter?: number; depth?: number; topDrillable?: boolean };

/** Barreira antes de copyHolesLocalInvariant — remove só furos de dobradiça fora da peça. */
export function filterHingeHolesLocalBeforeInvariant<T extends HoleLocalLike>(
  holes: T[] | undefined,
  larguraMm: number,
  alturaMm: number,
  context: string,
  pieceId?: string
): T[] | undefined {
  if (!holes?.length) return undefined;
  const tol = HOLE_DRILLING_TOL_MM;
  const out: T[] = [];
  for (const h of holes) {
    const tipo = h.holeType ?? "";
    if (!HINGE_HOLE_TYPES.has(tipo)) {
      out.push(h);
      continue;
    }
    const x = Number(h.x);
    const y = Number(h.y);
    const inBounds =
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= -tol &&
      y >= -tol &&
      x <= larguraMm + tol &&
      y <= alturaMm + tol;
    if (inBounds) {
      out.push(h);
    } else if (shouldTraceHingePiece(larguraMm, alturaMm)) {
      console.warn(
        "[HINGE-DRILL-TRACE]",
        JSON.stringify({
          stage: "barrier_before_copyHolesLocalInvariant",
          context,
          pieceId,
          larguraMm,
          alturaMm,
          dropped: { x, y, tipo },
        })
      );
    }
  }
  return out.length > 0 ? out : undefined;
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
