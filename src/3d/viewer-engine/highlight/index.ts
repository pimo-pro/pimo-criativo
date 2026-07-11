export {
  PANEL_EDGE_OVERLAY_FLAG,
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  PAIRING_OVERLAY_FLAG,
  isAuthorizedHighlightOverlay,
} from "./viewerHighlightConstants";

export {
  auditMeshHighlightOverlays,
  auditMeshHighlightOverlaysIfEnabled,
  findForbiddenHighlightPatterns,
} from "./viewerHighlightGuard";

export {
  resolveViewerHighlightPieceContext,
  type ViewerHighlightPieceKind,
  type ViewerHighlightPieceContext,
} from "./viewerHighlightPieceKind";

export {
  auditAllBoxesHighlightVisuals,
  auditBoxHighlightVisuals,
  formatHighlightVisualAuditReport,
  registerHighlightVisualAuditOnWindow,
  type HighlightVisualAuditReport,
  type HighlightVisualAuditEntry,
} from "./viewerHighlightVisualAudit";

export { HighlightManager } from "./HighlightManager";
export { ViewerHighlightController } from "./ViewerHighlightController";
export type {
  ViewerHighlightBoxEntry,
  ViewerHighlightControllerDeps,
} from "./ViewerHighlightController";

export {
  createBoxWireframeContourGeometry,
  createHoleCircleGeometry,
  createPanelContourGeometry,
  DEFAULT_CARCASS_THICKNESS_M,
  holeMmToLocalMeters,
  outlineDimsFromMeshSize,
  resolveHoleDrillEntryFrame,
  type HoleDrillFrame,
  type PanelOutlineDims,
  type PanelOutlineKind,
} from "./viewerHighlightGeometry";

export {
  assertKnownPieceMesh,
  assertViewerHighlightInvariants,
  findSpuriousSegmentsInGeometry,
  isViewerHighlightInvariantEnabled,
  logViewerHighlightViolations,
  type ViewerHighlightInvariantViolation,
} from "./viewerHighlightInvariant";

export {
  isKnownPieceMesh,
  resolvePieceHighlightVisible,
  resolveViewerHighlightMode,
  shouldDrawHoleHighlights,
  shouldDrawPairingLines,
  shouldDrawPieceContour,
  type ViewerHighlightFlags,
  type ViewerHighlightMode,
} from "./viewerHighlightPolicy";
