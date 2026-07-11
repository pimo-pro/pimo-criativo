/**
 * Política unificada de visibilidade e modo do highlight de peças/furos.
 * Separada de highlightEnabled (emissive mesh / HighlightManager).
 */

import type * as THREE from "three";

/** Modo SSOT do highlight visual de peças/furos (Fase 3). */
export type ViewerHighlightMode =
  | "off"
  | "holes-only"
  | "edges-and-holes"
  | "industrial-design";

export type ViewerHighlightFlags = {
  panelEdgesVisible: boolean;
  panelRenderingEnabled: boolean;
  industrialDesignActive?: boolean;
  /** Override explícito — quando omitido, deriva dos booleans legacy. */
  modeOverride?: ViewerHighlightMode;
};

export function resolveViewerHighlightMode(flags: ViewerHighlightFlags): ViewerHighlightMode {
  if (flags.modeOverride) return flags.modeOverride;
  if (!flags.panelEdgesVisible && !flags.panelRenderingEnabled) return "off";
  if (flags.industrialDesignActive && flags.panelRenderingEnabled) return "industrial-design";
  if (flags.panelRenderingEnabled && !flags.panelEdgesVisible) return "holes-only";
  return "edges-and-holes";
}

export function shouldDrawPieceContour(mode: ViewerHighlightMode): boolean {
  return mode === "edges-and-holes" || mode === "industrial-design";
}

export function shouldDrawHoleHighlights(mode: ViewerHighlightMode, holeCount: number): boolean {
  if (holeCount <= 0) return false;
  return mode === "holes-only" || mode === "edges-and-holes" || mode === "industrial-design";
}

export function shouldDrawPairingLines(mode: ViewerHighlightMode): boolean {
  return mode === "industrial-design";
}

export function resolvePieceHighlightVisible(
  pieceVisible: boolean,
  flags: ViewerHighlightFlags
): boolean {
  if (!pieceVisible) return false;
  return resolveViewerHighlightMode(flags) !== "off";
}

/** Peça reconhecida pelo viewer — evita highlight em proxies/layout. */
export function isKnownPieceMesh(mesh: THREE.Mesh): boolean {
  const ud = mesh.userData ?? {};
  if (ud.isPanelMesh === true) return true;
  if (ud.panelType != null) return true;
  if (ud.doorLayerId != null) return true;
  if (ud.drawerPart != null) return true;
  if (ud.divSepKind === "sep" || ud.divSepKind === "div") return true;
  if (ud.isRematePiece === true) return true;
  if (ud.shelfIndex != null) return true;
  const name = typeof mesh.name === "string" ? mesh.name : "";
  if (name === "frente-fixa") return true;
  if (name.startsWith("door-leaf-")) return true;
  if (name.startsWith("shelf-")) return true;
  if (name.startsWith("drawer-")) return true;
  if (name.startsWith("divsep-")) return true;
  return false;
}
