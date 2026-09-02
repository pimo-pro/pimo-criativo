/**
 * Regras de limites e snapping para aberturas (portas/janelas) na parede.
 * pimo-room v4 — controlos avançados de edição fina.
 */

const SNAP_THRESHOLD_MM = 80;
const GRID_SNAP_MM = 50;

export interface OpeningLike {
  id: string;
  widthMm: number;
  heightMm: number;
  floorOffsetMm: number;
  horizontalOffsetMm: number;
}

export type OpeningHorizontalAlign = "start" | "center" | "end";
export type OpeningVerticalAlign = "floor" | "middle" | "top";

/**
 * Regras rígidas: abertura nunca sai dos limites da parede, nunca abaixo do chão,
 * nunca acima da altura da parede. Sempre dentro do retângulo [0, wallLength] x [0, wallHeight].
 */
export function clampOpeningToWall(
  config: { widthMm: number; heightMm: number; floorOffsetMm: number; horizontalOffsetMm: number },
  wallLengthMm: number,
  wallHeightMm: number
): { horizontalOffsetMm: number; floorOffsetMm: number } {
  const maxH = Math.max(0, wallLengthMm - config.widthMm);
  const maxV = Math.max(0, wallHeightMm - config.heightMm);
  return {
    horizontalOffsetMm: Math.max(0, Math.min(maxH, config.horizontalOffsetMm)),
    floorOffsetMm: Math.max(0, Math.min(maxV, config.floorOffsetMm)),
  };
}

/**
 * Verifica se duas aberturas se sobrepõem (horizontal e vertical).
 */
function openingsOverlap(
  a: { horizontalOffsetMm: number; widthMm: number; floorOffsetMm: number; heightMm: number },
  b: { horizontalOffsetMm: number; widthMm: number; floorOffsetMm: number; heightMm: number }
): boolean {
  const aHStart = a.horizontalOffsetMm;
  const aHEnd = a.horizontalOffsetMm + a.widthMm;
  const bHStart = b.horizontalOffsetMm;
  const bHEnd = b.horizontalOffsetMm + b.widthMm;
  const overlapH = aHStart < bHEnd && bHStart < aHEnd;

  const aVStart = a.floorOffsetMm;
  const aVEnd = a.floorOffsetMm + a.heightMm;
  const bVStart = b.floorOffsetMm;
  const bVEnd = b.floorOffsetMm + b.heightMm;
  const overlapV = aVStart < bVEnd && bVStart < aVEnd;

  return overlapH && overlapV;
}

/**
 * Ajusta config para não sobrepor outras aberturas na mesma parede.
 * Se houver sobreposição, desloca horizontalmente para a direita da abertura mais próxima.
 */
export function clampOpeningNoOverlap(
  config: { widthMm: number; heightMm: number; floorOffsetMm: number; horizontalOffsetMm: number },
  openingId: string,
  openings: OpeningLike[],
  wallLengthMm: number,
  wallHeightMm: number
): { horizontalOffsetMm: number; floorOffsetMm: number } {
  const opening = clampOpeningToWall(config, wallLengthMm, wallHeightMm);
  let horizontalOffsetMm = opening.horizontalOffsetMm;
  const floorOffsetMm = opening.floorOffsetMm;
  const others = openings.filter((o) => o.id !== openingId);

  for (const other of others) {
    const candidate = {
      widthMm: config.widthMm,
      heightMm: config.heightMm,
      floorOffsetMm,
      horizontalOffsetMm,
    };
    if (openingsOverlap(candidate, other)) {
      const otherEnd = other.horizontalOffsetMm + other.widthMm;
      horizontalOffsetMm = Math.min(wallLengthMm - config.widthMm, otherEnd);
      horizontalOffsetMm = Math.max(0, horizontalOffsetMm);
    }
  }

  return clampOpeningToWall(
    { ...config, horizontalOffsetMm, floorOffsetMm },
    wallLengthMm,
    wallHeightMm
  );
}

/**
 * Snapping horizontal: centro da parede, início (0), fim (wallLengthMm - widthMm).
 * Se não encaixar nesses, opcionalmente snap em grid de GRID_SNAP_MM.
 */
export function snapHorizontalOffset(
  horizontalOffsetMm: number,
  widthMm: number,
  wallLengthMm: number,
  useGrid = true
): number {
  const start = 0;
  const center = (wallLengthMm - widthMm) / 2;
  const end = wallLengthMm - widthMm;

  const points = [start, center, end];
  for (const p of points) {
    if (Math.abs(horizontalOffsetMm - p) <= SNAP_THRESHOLD_MM) return p;
  }
  if (useGrid) {
    const snapped = Math.round(horizontalOffsetMm / GRID_SNAP_MM) * GRID_SNAP_MM;
    return Math.max(0, Math.min(wallLengthMm - widthMm, snapped));
  }
  return horizontalOffsetMm;
}

/**
 * Snapping vertical: piso (0), meio, topo (wallHeightMm - heightMm).
 * Grid opcional em GRID_SNAP_MM.
 */
export function snapVerticalOffset(
  floorOffsetMm: number,
  heightMm: number,
  wallHeightMm: number,
  useGrid = true
): number {
  const floor = 0;
  const middle = (wallHeightMm - heightMm) / 2;
  const top = wallHeightMm - heightMm;
  const points = [floor, middle, top];
  for (const p of points) {
    if (Math.abs(floorOffsetMm - p) <= SNAP_THRESHOLD_MM) return Math.max(0, p);
  }
  if (useGrid) {
    const snapped = Math.round(floorOffsetMm / GRID_SNAP_MM) * GRID_SNAP_MM;
    return Math.max(0, Math.min(Math.max(0, wallHeightMm - heightMm), snapped));
  }
  return floorOffsetMm;
}

export function alignOpeningHorizontal(
  align: OpeningHorizontalAlign,
  widthMm: number,
  wallLengthMm: number
): number {
  if (align === "start") return 0;
  if (align === "end") return Math.max(0, wallLengthMm - widthMm);
  return Math.max(0, (wallLengthMm - widthMm) / 2);
}

export function alignOpeningVertical(
  align: OpeningVerticalAlign,
  heightMm: number,
  wallHeightMm: number
): number {
  if (align === "floor") return 0;
  if (align === "top") return Math.max(0, wallHeightMm - heightMm);
  return Math.max(0, (wallHeightMm - heightMm) / 2);
}

/**
 * Aplica clamp + snap (se activo) a uma abertura na parede.
 */
export function refineOpeningPlacement(
  config: { widthMm: number; heightMm: number; floorOffsetMm: number; horizontalOffsetMm: number },
  wallLengthMm: number,
  wallHeightMm: number,
  options?: { snap?: boolean; openingId?: string; openings?: OpeningLike[] }
): { horizontalOffsetMm: number; floorOffsetMm: number } {
  const next = { ...config };
  if (options?.snap !== false) {
    next.horizontalOffsetMm = snapHorizontalOffset(
      next.horizontalOffsetMm,
      next.widthMm,
      wallLengthMm,
      true
    );
    next.floorOffsetMm = snapVerticalOffset(next.floorOffsetMm, next.heightMm, wallHeightMm, true);
  }
  if (options?.openingId && options.openings) {
    return clampOpeningNoOverlap(
      next,
      options.openingId,
      options.openings,
      wallLengthMm,
      wallHeightMm
    );
  }
  return clampOpeningToWall(next, wallLengthMm, wallHeightMm);
}

export const OPENING_SNAP_GRID_MM = GRID_SNAP_MM;
export const OPENING_SNAP_THRESHOLD_MM = SNAP_THRESHOLD_MM;
