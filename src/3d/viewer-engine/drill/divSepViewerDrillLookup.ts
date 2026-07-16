import type { TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../../core/types";
import type { DivisorPrateleiraLado } from "../../../core/divSep/types";
import type { PanelType } from "../../objects/PanelFactory";

/**
 * Resolve o panelId de fabrico do DIV (mesma regra que cutlist / shelfDrilling):
 * panelIds.divisores[i] → fallback divisorio-${i+1}.
 */
export function resolveDivisorManufacturingPanelId(
  panelIds: { divisores?: string[] } | undefined,
  index: number
): string {
  const fromBox = panelIds?.divisores?.[index];
  if (typeof fromBox === "string" && fromBox.length > 0) return fromBox;
  return `divisorio-${index + 1}`;
}

/**
 * Lookup dos furos do DIV no mapa do Viewer.
 * Tenta: panelId industrial (cutlist) → div.id (mesh divsep-div-*).
 */
export function resolveDivisorViewerDrillHoles(
  divisoresById: ViewerDrillMarkersByPanel["divisoresById"],
  opts: {
    divItemId: string;
    divIndex: number;
    panelIds?: { divisores?: string[] };
  }
): TechnicalDrillHole[] {
  if (!divisoresById) return [];
  const manufacturingId = resolveDivisorManufacturingPanelId(opts.panelIds, opts.divIndex);
  const byManufacturing = divisoresById[manufacturingId];
  if (byManufacturing?.length) return byManufacturing;
  const byMeshId = divisoresById[opts.divItemId];
  if (byMeshId?.length) return byMeshId;
  return [];
}

/**
 * Viewer DIV: só marcadores de prateleira (sem cavilhas de união SEP/DIV).
 * Sem prateleiras → lista vazia → DIV sem furos visuais.
 */
export function filterDivisorViewerShelfHoles(
  holes: TechnicalDrillHole[] | undefined | null
): TechnicalDrillHole[] {
  if (!holes?.length) return [];
  return holes.filter((h) => h.tipo === "prateleira");
}

/**
 * Painel vertical no CSG: prateleiras à direita do DIV → face +X (como lateral esquerda);
 * prateleiras à esquerda → face −X (como lateral direita).
 */
export function resolveDivisorViewerPanelType(
  lado: DivisorPrateleiraLado | undefined
): PanelType {
  return (lado ?? "direita") === "direita" ? "left" : "right";
}
