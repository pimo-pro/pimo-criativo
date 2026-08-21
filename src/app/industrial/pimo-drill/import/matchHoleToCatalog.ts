import { HOLE_CATALOG, type HoleFaceKind, type HoleTypeId } from '@/core/drill/holeCatalog';

const DIAMETER_TOLERANCE_MM = 0.3;
const DEPTH_TOLERANCE_MM = 1.0;

/**
 * Procura no catálogo oficial (core/drill/holeCatalog) um tipo de furo compatível
 * com Ø/profundidade/face lidos de um XML importado. Sem forçar aproximação — só
 * devolve match dentro de tolerância; caso contrário null (o chamador cria uma
 * entrada local, ver pimoDrillTypes.LocalHoleType).
 */
export function matchHoleToCatalog(spec: {
  diameterMm: number;
  depthMm: number;
  face: HoleFaceKind;
}): HoleTypeId | null {
  const match = HOLE_CATALOG.find(
    (entry) =>
      entry.face === spec.face &&
      Math.abs(entry.diametroMm - spec.diameterMm) <= DIAMETER_TOLERANCE_MM &&
      Math.abs(entry.profundidadeMm - spec.depthMm) <= DEPTH_TOLERANCE_MM,
  );
  return match?.id ?? null;
}
