import type { PanelDrillHole } from "../../core/types";
import { isIndustrialDoorPanelTipo } from "../../core/doors/industrialDoorPanels";
import { shouldTraceDoorPiece, traceDoorDrilling } from "./doorDrillingTrace";

const HOLE_DRILLING_TOL_MM = 0.2;

/** Tipos permitidos em painéis de porta (industrial). */
const DOOR_ALLOWED_HOLE_TYPES = new Set([
  "dobradica",
  "dobradica_fixacao",
  "dobradica_parafuso_uniao",
  "puxador",
  "fixacao_metalica",
]);

type HoleLocalLike = {
  x: number;
  y: number;
  holeType?: string;
  diameter?: number;
  depth?: number;
  topDrillable?: boolean;
};

function holeInPieceBounds(
  x: number,
  y: number,
  larguraMm: number,
  alturaMm: number,
  tolMm = HOLE_DRILLING_TOL_MM
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= -tolMm &&
    y >= -tolMm &&
    x <= larguraMm + tolMm &&
    y <= alturaMm + tolMm
  );
}

/**
 * Remove furos que não pertencem a portas (ex. prateleira/corredica herdados de lateral)
 * e garante 0 ≤ yLocal ≤ alturaMm + tol.
 */
export function sanitizeDoorPanelDrillHoles(
  holes: PanelDrillHole[] | undefined,
  larguraMm: number,
  alturaMm: number,
  context: string,
  pieceId?: string
): PanelDrillHole[] {
  if (!holes?.length) return [];
  const trace = shouldTraceDoorPiece(larguraMm, alturaMm);
  const kept: PanelDrillHole[] = [];
  const dropped: Array<{ x: number; y: number; tipo?: string; reason: string }> = [];

  for (const h of holes) {
    const tipo = h.holeType ?? "";
    const x = Number(h.x);
    const y = Number(h.y);
    if (!DOOR_ALLOWED_HOLE_TYPES.has(tipo)) {
      dropped.push({ x, y, tipo, reason: "tipo_nao_porta" });
      continue;
    }
    if (!holeInPieceBounds(x, y, larguraMm, alturaMm)) {
      dropped.push({ x, y, tipo, reason: "fora_bounds" });
      continue;
    }
    kept.push(h);
  }

  if (trace && (dropped.length > 0 || kept.length > 0)) {
    traceDoorDrilling({
      stage: "sanitizeDoorPanelDrillHoles",
      context,
      pieceId,
      larguraMm,
      alturaMm,
      holesIn: holes.map((h) => ({ x: h.x, y: h.y, tipo: h.holeType })),
      holesOut: kept.map((h) => ({ x: h.x, y: h.y, tipo: h.holeType })),
      dropped,
    });
  }

  return kept;
}

/** Barreira antes de copyHolesLocalInvariant — só portas; remove tipos ilegais e fora de bounds. */
export function filterDoorHolesLocalBeforeInvariant<T extends HoleLocalLike>(
  holes: T[] | undefined,
  larguraMm: number,
  alturaMm: number,
  pieceTipo: string | undefined,
  context: string,
  pieceId?: string
): T[] | undefined {
  if (!holes?.length || !isIndustrialDoorPanelTipo(pieceTipo ?? "")) return holes;
  const out: T[] = [];
  const dropped: Array<{ x: number; y: number; tipo?: string; reason: string }> = [];

  for (const h of holes) {
    const tipo = h.holeType ?? "";
    const x = Number(h.x);
    const y = Number(h.y);
    if (!DOOR_ALLOWED_HOLE_TYPES.has(tipo)) {
      dropped.push({ x, y, tipo, reason: "tipo_nao_porta" });
      continue;
    }
    if (!holeInPieceBounds(x, y, larguraMm, alturaMm)) {
      dropped.push({ x, y, tipo, reason: "fora_bounds" });
      continue;
    }
    out.push(h);
  }

  if (shouldTraceDoorPiece(larguraMm, alturaMm) && dropped.length > 0) {
    traceDoorDrilling({
      stage: "barrier_before_copyHolesLocalInvariant",
      context,
      pieceId,
      larguraMm,
      alturaMm,
      holesIn: holes.map((h) => ({ x: h.x, y: h.y, tipo: h.holeType })),
      holesOut: out.map((h) => ({ x: h.x, y: h.y, tipo: h.holeType })),
      dropped,
    });
  }

  return out.length > 0 ? out : undefined;
}
