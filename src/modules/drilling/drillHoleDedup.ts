import type { PanelDrillHole } from "../../core/types";

/** Tolerância industrial para considerar dois furos na mesma posição (mm). */
export const DRILL_HOLE_DEDUP_TOL_MM = 0.5;

type DrillHoleLike = {
  x: number;
  y: number;
  diameter?: number;
  holeType?: string;
  topDrillable?: boolean;
};

function sameDrillPlane(a: DrillHoleLike, b: DrillHoleLike): boolean {
  const aTop = a.topDrillable !== false;
  const bTop = b.topDrillable !== false;
  return aTop === bTop;
}

function isDuplicateDrillHole(a: DrillHoleLike, b: DrillHoleLike, tolMm: number): boolean {
  if (Math.abs(a.x - b.x) > tolMm || Math.abs(a.y - b.y) > tolMm) return false;
  if (!sameDrillPlane(a, b)) return false;
  const dA = Number(a.diameter);
  const dB = Number(b.diameter);
  if (Number.isFinite(dA) && dA > 0 && Number.isFinite(dB) && dB > 0 && Math.abs(dA - dB) > tolMm) {
    return false;
  }
  return true;
}

/** Prioridade: mantém furo mais específico quando há colisão no mesmo plano. */
const HOLE_TYPE_PRIORITY: Record<string, number> = {
  dobradica: 100,
  dobradica_fixacao: 95,
  dobradica_parafuso_uniao: 90,
  cavilha: 80,
  parafuso: 70,
  prateleira: 50,
  corredica: 50,
};

function holeTypePriority(holeType?: string): number {
  if (!holeType) return 0;
  return HOLE_TYPE_PRIORITY[holeType] ?? 10;
}

function shouldReplaceWithCandidate(existing: DrillHoleLike, candidate: DrillHoleLike): boolean {
  return holeTypePriority(candidate.holeType) > holeTypePriority(existing.holeType);
}

/**
 * Remove furos duplicados (posição + plano de furação).
 * Em conflito no mesmo (x,y), mantém o tipo com maior prioridade industrial.
 */
export function dedupeDrillHoles<T extends DrillHoleLike>(
  holes: T[] | undefined,
  options?: { tolMm?: number }
): T[] {
  if (!holes?.length) return [];
  const tolMm = options?.tolMm ?? DRILL_HOLE_DEDUP_TOL_MM;
  const out: T[] = [];

  for (const hole of holes) {
    const dupIndex = out.findIndex((h) => isDuplicateDrillHole(h, hole, tolMm));
    if (dupIndex < 0) {
      out.push(hole);
      continue;
    }
    if (shouldReplaceWithCandidate(out[dupIndex]!, hole)) {
      out[dupIndex] = hole;
    }
  }

  return out;
}

/** Alias compatível com corner cabinet / TXML. */
export function dedupePanelDrillHoles(holes: PanelDrillHole[]): PanelDrillHole[] {
  return dedupeDrillHoles(holes);
}
