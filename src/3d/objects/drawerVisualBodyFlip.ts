/**
 * Viewer-only — inversão controlada do desnível vertical corpo ↔ frente.
 *
 * Industrial (SSOT, intocado):
 *   lowest/single elev = 16,5 mm · middle/highest = 48 mm
 *
 * Visual (esta camada, quando activa):
 *   folga pequena na base · elevação industrial no topo
 *
 * Remover / pôr `DRAWER_VIEWER_BODY_VERTICAL_FLIP = false` na revisão industrial futura.
 * Não altera cutlist, XML, furos nem DrawerParametrics.
 */

export const DRAWER_VIEWER_BODY_VERTICAL_FLIP = true;

/**
 * Elevação visual da base do corpo acima da base da frente (mm).
 * Com flip: troca a elevação industrial pela folga que estava no topo.
 */
export function resolveDrawerVisualBaseElevationMm(
  frontHeightMm: number,
  bodyHeightMm: number,
  industrialBaseElevationMm: number
): number {
  const elev = Number(industrialBaseElevationMm);
  if (!DRAWER_VIEWER_BODY_VERTICAL_FLIP || !Number.isFinite(elev)) {
    return Number.isFinite(elev) ? elev : 0;
  }
  const frontH = Math.max(0, Number(frontHeightMm) || 0);
  const bodyH = Math.max(0, Number(bodyHeightMm) || 0);
  const delta = Math.max(0, frontH - bodyH);
  return Math.max(0, delta - elev);
}

/**
 * Offset Y do centro do corpo (mm), origem no centro da frente, Y+ = cima.
 * Equivalente a `resolveDrawerBodyCenterOffsetYMm` com elevação visual.
 */
export function resolveDrawerVisualBodyCenterOffsetYMm(
  frontHeightMm: number,
  bodyHeightMm: number,
  industrialBaseElevationMm: number
): number {
  const frontH = Math.max(0, Number(frontHeightMm) || 0);
  const bodyH = Math.max(0, Number(bodyHeightMm) || 0);
  const elev = resolveDrawerVisualBaseElevationMm(
    frontH,
    bodyH,
    industrialBaseElevationMm
  );
  return -(frontH - bodyH) / 2 + elev;
}
