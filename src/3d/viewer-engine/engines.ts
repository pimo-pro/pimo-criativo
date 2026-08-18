/**
 * Mapa A→E (Z-01.2.7) — fachadas extraídas do ViewerCore.
 * Ficheiros já unificados (MeasurementEngine, SnapEngine, LayoutEngine, ProjectLoader,
 * ViewerRuntimeLoop, ViewerState, MaterialEngine, RoomEngine Room 2.0) não são duplicados.
 */
export { SceneEngine } from "./scene/SceneEngine";
export { LightingEngine } from "./lighting/LightingEngine";
export { ComposerEngine } from "./lighting/ComposerEngine";
export { CameraEngine } from "./camera/CameraEngine";
export { SelectionEngine } from "./selection/SelectionEngine";
export { MeasurementEngine } from "./measurement/MeasurementEngine";
export { GizmoEngine } from "./tools/GizmoEngine";
export { BoxEngine } from "./box/BoxEngine";
export { ViewerRoomEngine } from "./room/ViewerRoomEngine";
export { DesignerEngine } from "./designer/DesignerEngine";
export { SnapEngine } from "./snapping/SnapEngine";
export { LayoutEngine } from "./layout/LayoutEngine";
export { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
export { ViewerState } from "./state/ViewerState";
export { ViewerFacade } from "./ViewerFacade";
export { ProjectLoader } from "../../core/viewer/formats/ProjectLoader";
export {
  createFinishSyncFlags,
  requestFinishSync,
  flushPendingFinishSync,
} from "./finish/ViewerFinishSync";
