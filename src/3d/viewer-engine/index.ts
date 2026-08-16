/**
 * Viewer Engine — entrada modular do motor do Viewer.
 * Etapa 5 concluída: state, events, tools extraídos; ViewerCore como orquestrador.
 */
export { ViewerCore } from "./ViewerCore";
export type { ViewerOptions } from "./ViewerCore";
export { CameraManager } from "./camera";
export type { CameraOptions } from "./camera";
export { Controls } from "./controls";
export type { ControlsOptions } from "./controls";
export { Lights } from "./lighting";
export type { LightsOptions } from "./lighting";
export { SceneManager } from "./scene";
export type { SceneOptions } from "./scene";
export { RendererManager } from "./renderer";
export type { RendererOptions } from "./renderer";
export { HighlightManager } from "./highlight";
export { ViewerBoxManager } from "./box";
export { SnapshotRenderer } from "./snapshot";
export type { SnapshotRendererHost } from "./snapshot";
export { addModelToBox, type GlbLoaderAddOptions } from "./loader";
export type { ViewerBoxEntry } from "./types";
export { createGround, createGrid } from "./environment";
export type { EnvironmentOptions } from "./environment";
export { getPointerNdc } from "./utils";
export { EventsManager } from "./events";
export type { IViewerEventEngine } from "./events";
export { ViewerState } from "./state";
export type { TransformMode, PlacementMode, ViewerRenderMode } from "./state";
export type { InternalSelectionHit, InternalSelectionState } from "./selection";
export { ViewerTools } from "./tools";
export type { IViewerToolsEngine } from "./tools";
export type { InternalRulerFacade } from "./measurement/internalRulerFacade";
export { DimensionsOverlayController } from "./overlays/DimensionsOverlayController";
export { SelectionOutlineController } from "./overlays/SelectionOutlineController";
export { WallSelectionOutlineController } from "./overlays/WallSelectionOutlineController";
export { PointerPickingFacade } from "./input/PointerPickingFacade";
export { clearCompetingSelectionsFor } from "./input/neutralSelection";
export {
  applyAdminSnappingRules,
  registerAdminSnappingRules,
} from "./snapping/adminSnappingRules";
export { createSmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
export { createDisabledSmartLayoutDeps } from "./snapping/smartLayoutDepsFactory";
export type { SnappingFacade } from "./snapping/snappingFacade";
export type {
  ViewerIndustrialSurface,
  ViewerMaterialSyncSurface,
  ViewerMcDimensionsSurface,
} from "./integration/viewerIndustrialSurface";
export { createMaterialPipelineFacade } from "./materials/materialPipelineFacade";
export type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
export { DisplayMaterialController } from "./materials/displayMaterialController";
export { createTextureLoaderFacade } from "./loaders/textureLoaderFacade";
export type { TextureLoaderFacade } from "./loaders/textureLoaderFacade";
export { TampoPieceVisualizer, isTampoVisualPiece } from "./remate/TampoPieceVisualizer";
export {
  createTampoPostformingGeometry,
  TAMPO_POSTFORM_RADIUS_MM,
} from "./remate/tampoPostformingGeometry";
export {
  TampoCutoutVisualizer,
  buildTampoGeometryWithCutouts,
  createTampoCutoutCutterMesh,
} from "./remate/TampoCutoutVisualizer";
export {
  TampoUnionVisualizer,
  applyTampoUnion,
  createTampoUnionCutterMesh,
} from "./remate/TampoUnionVisualizer";
export { buildTampoAngleShape, getTampoAnglePlanVerticesMm } from "./remate/tampoAngleGeometry";
export { createTampoPostformingGeometryFromShape } from "./remate/tampoPostformingGeometry";
