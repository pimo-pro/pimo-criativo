import type { TechnicalDrillHole } from "../../../core/types";

/**
 * Fonte única da matemática de posição de furos nos painéis (espaço local do mesh do painel).
 * Extraído de ViewerPanelVisibility para ser partilhado entre a renderização industrial
 * (contornos/círculos) e o serviço de snapping de medição (centros de furo).
 *
 * Visual-only: não altera coordenadas industriais — só a conversão mm → espaço local Three.js.
 */

export type HolePanelType = "top" | "bottom" | "left" | "right" | "front";
/** Aceite por `holeLocalB` (paridade com o tipo de painel da carcaça). */
export type HolePanelTypeExt = HolePanelType | "back";

/** Espessura industrial de caixaria (m) usada nos overlays de painel. */
export const PANEL_HOLE_THICKNESS_M = 0.019;
/** Afastamento mínimo do overlay em relação à face do painel (m). */
export const PANEL_HOLE_OVERLAY_INSET_M = 0.00015;

/**
 * Visual fix — origem Y no Viewer para overlays/snap (não altera dados de fabrico).
 *
 * Frente (gaveta/porta/frente-fixa):
 * - `cavilha` e `fixacao_estrutural` → BL (Y=0 na base), igual ao datum industrial `orient=BL`
 * - `puxador` e restantes → origem no topo (handlePlacement)
 *
 * Laterais: cavilha/parafuso/prateleira → base (inalterado).
 */
export function usesViewerBottomOriginY(
  panelType: HolePanelTypeExt,
  hole: Pick<TechnicalDrillHole, "tipo">
): boolean {
  if (panelType === "left" || panelType === "right") {
    return (
      hole.tipo === "cavilha" ||
      hole.tipo === "parafuso" ||
      hole.tipo === "prateleira"
    );
  }
  if (panelType === "front") {
    return hole.tipo === "cavilha" || hole.tipo === "fixacao_estrutural";
  }
  return false;
}

/**
 * Coordenada "b" (posição do furo no eixo secundário do painel), respeitando a origem
 * de Y conforme o tipo de furo (base vs topo).
 */
export function holeLocalB(
  panelType: HolePanelTypeExt,
  panelH: number,
  hole: TechnicalDrillHole
): number {
  const useBottomOriginY = usesViewerBottomOriginY(panelType, hole);
  return useBottomOriginY ? hole.y / 1000 - panelH / 2 : panelH / 2 - hole.y / 1000;
}

/**
 * Centro geométrico do furo no espaço local do mesh do painel (m).
 * Usa exactamente as mesmas fórmulas de `createHoleCircleGeometry`, sem construir a circunferência.
 * Multiplicar por `panelMesh.matrixWorld` para obter o ponto no mundo (snap target).
 */
export function holeCenterLocal(
  panelType: HolePanelType,
  width: number,
  height: number,
  depth: number,
  hole: TechnicalDrillHole,
  thickness: number = PANEL_HOLE_THICKNESS_M,
  inset: number = PANEL_HOLE_OVERLAY_INSET_M
): { x: number; y: number; z: number } {
  const t = thickness;
  const sideH = Math.max(0.001, height - 2 * t);
  const panelW = panelType === "left" || panelType === "right" ? depth : width;
  const panelH =
    panelType === "left" || panelType === "right"
      ? sideH
      : panelType === "top" || panelType === "bottom"
        ? depth
        : height;

  const a = hole.x / 1000 - panelW / 2;
  const b = holeLocalB(panelType, panelH, hole);

  if (panelType === "top") return { x: a, y: -t / 2 - inset, z: b };
  if (panelType === "bottom") return { x: a, y: t / 2 + inset, z: b };
  if (panelType === "left") return { x: t / 2 + inset, y: b, z: a };
  if (panelType === "right") return { x: -(t / 2 + inset), y: b, z: a };
  // front
  return { x: a, y: b, z: -depth / 2 - inset };
}
