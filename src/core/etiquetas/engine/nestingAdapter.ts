import type { LabelSheetPlacement } from "../qr/etiquetaCodeV5";

/** Placement mínimo do Cut Layout PRO (nesting industrial). */
export type CutLayoutPlacementLike = {
  partName: string;
  boxId: string;
  sheetIndex: number;
  x_mm: number;
  y_mm: number;
};

/**
 * Normaliza placements do nesting industrial para o UEE.
 * Preserva a ordem real dentro de cada painel (placementIndex).
 */
export function normalizeCutLayoutPlacements(
  placements?: CutLayoutPlacementLike[]
): LabelSheetPlacement[] | undefined {
  if (!placements || placements.length === 0) return undefined;

  const perSheetCounter = new Map<number, number>();

  return placements.map((p, globalIndex) => {
    const sheetIndex = p.sheetIndex ?? 0;
    const placementIndex = perSheetCounter.get(sheetIndex) ?? 0;
    perSheetCounter.set(sheetIndex, placementIndex + 1);

    return {
      partName: p.partName,
      boxId: p.boxId,
      sheetIndex,
      x_mm: p.x_mm ?? 0,
      y_mm: p.y_mm ?? 0,
      placementIndex,
      globalPlacementIndex: globalIndex,
    };
  });
}
