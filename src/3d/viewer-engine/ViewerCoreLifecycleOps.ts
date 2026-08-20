import type * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { EdgeOutlineSystem } from "../outline";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { SnapDebugOverlay } from "../../debug/SnapDebugOverlay";
import type { RoomManager } from "../room/RoomManager";
import type { SnapshotRenderer } from "./snapshot";
import type { HighlightManager } from "./highlight";
import type { InternalSelectionOutline, InternalSelectionState } from "./selection";
import type { MultiSelectionOutline } from "./selection/MultiSelectionOutline";
import type { Controls } from "./controls";
import type { EventsManager } from "./events";
import type { OrlaVisualizer } from "./orla/OrlaVisualizer";
import type { RematePieceVisualBridge, RematePieceVisualizer } from "./remate/RematePieceVisualizer";
import type { TampoPieceVisualizer } from "./remate/TampoPieceVisualizer";
import type { HematiVisualizer } from "./hemati/HematiVisualizer";
import type { RodapeVisualBridge, RodapeVisualizer } from "./rodape/RodapeVisualizer";
import type { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import type { DimensionsOverlayController } from "./overlays/DimensionsOverlayController";
import type { MeasurementEngine } from "./measurement/MeasurementEngine";
import type { SmartSnapping } from "./snapping/SmartSnapping";
import type { RemateSmartSnapping } from "./snapping/RemateSmartSnapping";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { DisplayMaterialController } from "./materials/displayMaterialController";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { SceneManager } from "./scene/SceneManager";
import type { RendererManager } from "./renderer";
import type { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
import type { LayoutEngine } from "./layout/LayoutEngine";
import type { ViewerCoreSelectionOpsDeps } from "./ViewerCoreSelectionOps";
import { disposeSelectionSystemsImpl } from "./ViewerCoreSelectionOps";

export type ViewerCoreLifecycleOpsDeps = {
  runtimeLoop: ViewerRuntimeLoop;
  getUnregisterWindowEvents: () => (() => void) | null;
  setUnregisterWindowEvents: (value: (() => void) | null) => void;
  disposeComposer: () => void;
  disposeMainComposer: () => void;
  getControls: () => Controls | null;
  getTransformControls: () => TransformControls | null;
  setTransformControls: (value: TransformControls | null) => void;
  getTransformControlsHelper: () => THREE.Object3D | null;
  setTransformControlsHelper: (value: THREE.Object3D | null) => void;
  sceneManager: SceneManager;
  layoutEngine: LayoutEngine | null;
  orlaVisualizer: OrlaVisualizer;
  setRemateVisualBridge: (value: RematePieceVisualBridge | null) => void;
  remateVisualizer: RematePieceVisualizer;
  tampoVisualizer: TampoPieceVisualizer;
  hematiVisualizer: HematiVisualizer;
  setRodapeVisualBridge: (value: RodapeVisualBridge | null) => void;
  rodapeVisualizer: RodapeVisualizer;
  overlayCoordinator: ViewerOverlayCoordinator;
  setOnBoxTransform: (
    value: ((
      _boxId: string,
      _position: { x: number; y: number; z: number },
      _rotation: { x: number; y: number; z: number }
    ) => void) | null
  ) => void;
  setOnBoxSelected: (value: ((_id: string | null) => void) | null) => void;
  setOnMultiSelectToggle: (value: ((_encodedId: string) => void) | null) => void;
  setOnInternalSurfaceSelected: (
    value: ((_hit: InternalSelectionState) => void) | null
  ) => void;
  setOnInternalEdgeSelected: (
    value: ((_hit: InternalSelectionState) => void) | null
  ) => void;
  setOnInternalPointSelected: (
    value: ((_hit: InternalSelectionState) => void) | null
  ) => void;
  setOnDoorLayerDoubleClick: (
    value: ((_boxId: string, _doorLayerId: string) => void) | null
  ) => void;
  setOnDrawerLayerDoubleClick: (
    value: ((_boxId: string, _drawerLayerId: string) => void) | null
  ) => void;
  setOnDrawerLayerClick: (
    value: ((_boxId: string, _drawerLayerId: string) => void) | null
  ) => void;
  setOnBoxDoubleClick: (value: ((_boxId: string) => void) | null) => void;
  setOnModelLoaded: (
    value: ((_boxId: string, _modelId: string, _object: THREE.Object3D) => void) | null
  ) => void;
  getEventsManager: () => EventsManager | null;
  setEventsManager: (value: EventsManager | null) => void;
  getWallGizmo: () => WallGizmo | null;
  setWallGizmo: (value: WallGizmo | null) => void;
  getSnapDebugOverlay: () => SnapDebugOverlay | null;
  setSnapDebugOverlay: (value: SnapDebugOverlay | null) => void;
  getRoomManager: () => RoomManager | null;
  setRoomManager: (value: RoomManager | null) => void;
  setSnapshotRenderer: (value: SnapshotRenderer | null) => void;
  selectedBoxChangeListeners: Set<(id: string | null) => void>;
  getSelectionOpsDeps: () => ViewerCoreSelectionOpsDeps;
  setMultiSelectionOutline: (value: MultiSelectionOutline | null) => void;
  setHighlightManager: (value: HighlightManager | null) => void;
  setEdgeOutlineSystem: (value: EdgeOutlineSystem | null) => void;
  setInternalSelectionOutline: (value: InternalSelectionOutline | null) => void;
  dimensionsOverlay: DimensionsOverlayController;
  measurementEngine: MeasurementEngine;
  getUnregisterAdminSnappingRules: () => (() => void) | null;
  setUnregisterAdminSnappingRules: (value: (() => void) | null) => void;
  smartSnappingEngine: SmartSnapping;
  smartAlignOverlay: SmartAlignOverlayFacade;
  remateSmartSnapping: RemateSmartSnapping;
  clearBoxes: () => void;
  roomBuilder: RoomBuilder;
  displayMaterials: DisplayMaterialController;
  materialPipeline: MaterialPipelineFacade;
  rendererManager: RendererManager;
};

/** Teardown completo do Viewer — ordem idêntica ao dispose original. */
export function disposeImpl(deps: ViewerCoreLifecycleOpsDeps): void {
  deps.runtimeLoop.stop();
  deps.getUnregisterWindowEvents()?.();
  deps.setUnregisterWindowEvents(null);
  deps.disposeComposer();
  deps.disposeMainComposer();
  deps.getControls()?.dispose();
  const transformControls = deps.getTransformControls();
  if (transformControls) {
    transformControls.detach();
    const helper = deps.getTransformControlsHelper();
    if (helper) {
      deps.sceneManager.scene.remove(helper);
      deps.setTransformControlsHelper(null);
    }
    transformControls.dispose();
    deps.setTransformControls(null);
  }
  deps.layoutEngine?.bindBridge(null);
  deps.orlaVisualizer.bindBridge(null);
  deps.orlaVisualizer.dispose();
  deps.setRemateVisualBridge(null);
  deps.remateVisualizer.bindBridge(null);
  deps.remateVisualizer.dispose();
  deps.tampoVisualizer.bindBridge(null);
  deps.tampoVisualizer.dispose();
  deps.hematiVisualizer.bindBridge(null);
  deps.hematiVisualizer.dispose();
  deps.setRodapeVisualBridge(null);
  deps.rodapeVisualizer.bindBridge(null);
  deps.rodapeVisualizer.dispose();
  deps.overlayCoordinator.dispose();
  deps.setOnBoxTransform(null);
  deps.setOnBoxSelected(null);
  deps.setOnMultiSelectToggle(null);
  deps.setOnInternalSurfaceSelected(null);
  deps.setOnInternalEdgeSelected(null);
  deps.setOnInternalPointSelected(null);
  deps.setOnDoorLayerDoubleClick(null);
  deps.setOnDrawerLayerDoubleClick(null);
  deps.setOnDrawerLayerClick(null);
  deps.setOnBoxDoubleClick(null);
  deps.setOnModelLoaded(null);
  deps.getEventsManager()?.unregister();
  deps.setEventsManager(null);
  const wallGizmo = deps.getWallGizmo();
  if (wallGizmo) {
    wallGizmo.dispose();
    deps.sceneManager.scene.remove(wallGizmo.group);
    deps.setWallGizmo(null);
  }
  const snapDebugOverlay = deps.getSnapDebugOverlay();
  if (snapDebugOverlay) {
    snapDebugOverlay.dispose();
    deps.setSnapDebugOverlay(null);
  }
  const roomManager = deps.getRoomManager();
  if (roomManager) {
    roomManager.removeRoom();
    deps.setRoomManager(null);
  }
  deps.setSnapshotRenderer(null);
  deps.selectedBoxChangeListeners.clear();
  disposeSelectionSystemsImpl(deps.getSelectionOpsDeps());
  deps.setMultiSelectionOutline(null);
  deps.setHighlightManager(null);
  deps.setEdgeOutlineSystem(null);
  deps.setInternalSelectionOutline(null);
  deps.dimensionsOverlay.dispose();
  deps.measurementEngine.dispose();
  deps.getUnregisterAdminSnappingRules()?.();
  deps.setUnregisterAdminSnappingRules(null);
  deps.smartSnappingEngine.dispose();
  deps.smartAlignOverlay.dispose();
  deps.remateSmartSnapping.dispose();
  // Limpar todos os caixotes corretamente
  deps.clearBoxes();
  deps.roomBuilder.clearRoom();
  deps.displayMaterials.dispose();
  deps.materialPipeline.disposeSharedPanelEdgeMaterial();

  deps.sceneManager.dispose();
  deps.rendererManager.dispose();
}
