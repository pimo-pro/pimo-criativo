/**
 * Regras de limites e snapping para aberturas (portas/janelas) na parede.
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
  let { horizontalOffsetMm, floorOffsetMm } = clampOpeningToWall(config, wallLengthMm, wallHeightMm);
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
