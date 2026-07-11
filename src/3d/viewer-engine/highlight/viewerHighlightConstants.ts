/**
 * Constantes SSOT para overlays de highlight — única fonte de userData flags.
 */

/** Flag em overlays de contorno de peça. */
export const PANEL_EDGE_OVERLAY_FLAG = "isPanelEdgeOverlay" as const;

/** Flag em overlays de realce de furo. */
export const HOLE_HIGHLIGHT_OVERLAY_FLAG = "isIndustrialDesignHoleOverlay" as const;

/** Flag em pairing lines do modo design industrial. */
export const PAIRING_OVERLAY_FLAG = "isIndustrialDesignPairingOverlay" as const;

/** Marcador legado — overlays com esta flag são removidos pelo guard. */
export const LEGACY_EDGE_OUTLINE_FLAG = "isEdgeOutlineOverlay" as const;

export const VIEWER_HIGHLIGHT_OVERLAY_FLAGS = [
  PANEL_EDGE_OVERLAY_FLAG,
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  PAIRING_OVERLAY_FLAG,
] as const;

export type ViewerHighlightOverlayFlag = (typeof VIEWER_HIGHLIGHT_OVERLAY_FLAGS)[number];

export function isAuthorizedHighlightOverlay(userData: Record<string, unknown> | undefined): boolean {
  if (!userData) return false;
  return (
    userData[PANEL_EDGE_OVERLAY_FLAG] === true ||
    userData[HOLE_HIGHLIGHT_OVERLAY_FLAG] === true ||
    userData[PAIRING_OVERLAY_FLAG] === true
  );
}

export function isLegacyOutlineOverlay(userData: Record<string, unknown> | undefined): boolean {
  return userData?.[LEGACY_EDGE_OUTLINE_FLAG] === true;
}
