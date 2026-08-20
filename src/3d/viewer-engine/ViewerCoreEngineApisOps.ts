import type * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type {
  UltraPerformanceModeOptions,
  ViewerBackgroundMode,
  ViewerMaterialQuality,
} from "../../context/projectTypes";
import type { SnapDebugData } from "../snapping/ModelWallSnap";
import type { SnapDebugOverlay } from "../../debug/SnapDebugOverlay";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { RoomManager } from "../room/RoomManager";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { CameraManager } from "./camera";
import type { Controls } from "./controls";
import type { MouseInputPreset } from "./controls/MouseInputMapper";
import type { RendererManager } from "./renderer";
import type { SceneEngine } from "./scene/SceneEngine";
import type { SceneManager } from "./scene/SceneManager";
import type { Lights } from "./lighting";
import type { LightingEngine } from "./lighting/LightingEngine";
import type { ComposerEngine } from "./lighting/ComposerEngine";
import type { DisplayMaterialController } from "./materials/displayMaterialController";
import type { UltraMaterialController } from "./materials/ultraMaterialController";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { HighlightManager } from "./highlight";
import type { EdgeOutlineSystem } from "../outline";
import type { InternalSelectionOutline } from "./selection";
import type { MultiSelectionOutline } from "./selection/MultiSelectionOutline";
import type { SelectionOutlineController } from "./overlays/SelectionOutlineController";
import type { WallSelectionOutlineController } from "./overlays/WallSelectionOutlineController";
import type { IndustrialDesignViewerOverlay } from "./overlays/IndustrialDesignViewerOverlay";
import type { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import type { ViewerPanelVisibility } from "./panels/ViewerPanelVisibility";
import type { IndustrialDesignWorkspaceMode } from "./modes/IndustrialDesignWorkspaceMode";
import type { BoxSceneController } from "./box/BoxSceneController";
import type { ViewerBoundsCache } from "./cache/ViewerBoundsCache";
import type { TransformConstraints } from "./constraints/TransformConstraints";
import type { SnapEngine } from "./snapping/SnapEngine";
import type { SmartSnapping } from "./snapping/SmartSnapping";
import type { RemateSmartSnapping } from "./snapping/RemateSmartSnapping";
import type { SmartAlignSnapEngine } from "./snapping/SmartAlignSnapEngine";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import type { MeasurementEngine } from "./measurement/MeasurementEngine";
import type { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
import type { ViewerTools } from "./tools";
import type { GroupGizmo } from "./tools/GroupGizmo";
import type { GizmoEngine } from "./tools/GizmoEngine";
import type { PointerPickingFacade } from "./input/PointerPickingFacade";
import type { OrlaVisualizer } from "./orla/OrlaVisualizer";
import type { RematePieceVisualizer, RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import type { TampoPieceVisualizer } from "./remate/TampoPieceVisualizer";
import type { HematiVisualizer } from "./hemati/HematiVisualizer";
import type { RodapeVisualizer, RodapeVisualBridge } from "./rodape/RodapeVisualizer";
import type { DivSepVisualBridge } from "./divSep/DivSepVisualBridge";
import type { FinishSyncFlags } from "./finish/ViewerFinishSync";
import type { ViewerBoxEntry } from "./types";
import type { ViewerState } from "./state/ViewerState";
import type { IViewerEventEngine } from "./events/EventEngineTypes";
import type { IViewerToolsEngine } from "./tools/ToolsEngineTypes";
import type { ViewerCoreDisplayOpsDeps, UltraRenderStateSnapshot } from "./ViewerCoreDisplayOps";
import type {
  IndustrialDesignCallbacksState,
  ViewerCoreIndustrialModeDeps,
} from "./ViewerCoreIndustrialMode";
import { applyPanelVisibilityForAllBoxesImpl } from "./ViewerCoreIndustrialMode";
import type {
  ViewerCoreRoomGeometryDeps,
  ViewerCoreRoomWallEntry,
} from "./ViewerCoreRoomGeometry";
import type { ViewerCoreRoomBounds } from "./ViewerCoreRoomUtils";
import type { RoomFloorMode } from "./room/roomEngineTypes";
import type { ViewerCoreSelectionOpsDeps } from "./ViewerCoreSelectionOps";
import { updateSelectionOverlaysFrameImpl } from "./ViewerCoreSelectionOps";
import type { ViewerCoreFinishOpsDeps } from "./ViewerCoreFinishOps";
import type { ViewerCoreTransformOpsDeps } from "./ViewerCoreTransformOps";
import type { ViewerCoreEventOpsDeps } from "./ViewerCoreEventOps";
import { getEventEngineApiImpl } from "./ViewerCoreEventOps";
import type { ViewerCoreToolsOpsDeps } from "./ViewerCoreToolsOps";
import { getToolsEngineApiImpl } from "./ViewerCoreToolsOps";
import type { ViewerCoreSnappingOpsDeps } from "./ViewerCoreSnappingOps";
import type { ViewerCoreRuntimeOpsDeps } from "./ViewerCoreRuntimeOps";

/**
 * Host do ViewerCore para construção das APIs/deps internas dos engines.
 * Passado via cast a partir de getEngineApisOpsDeps() — campos mutáveis
 * (o host escreve estado no ViewerCore em runtime).
 */
export type ViewerCoreEngineApisOpsDeps = {
  viewerState: ViewerState;
  turntableEnabled: boolean;
  isMobile: boolean;
  lights: Lights;
  lightingEngine: LightingEngine | null;
  composerEngine: ComposerEngine | null;
  ultraPerformanceMode: boolean;
  ultraPerformanceModeOptions: UltraPerformanceModeOptions;
  ultraRenderState: UltraRenderStateSnapshot | null;
  materialQuality: ViewerMaterialQuality;
  reflectionsEnabled: boolean;
  photoModeEnabled: boolean;
  matteMode: boolean;
  backgroundMode: ViewerBackgroundMode;
  glossIntensity: number;
  reflectionUpdateIntervalFrames: number;
  reflectionFrameCounter: number;
  baseToneMappingExposure: number;
  defaultPixelRatio: number;
  rendererManager: RendererManager;
  cameraManager: CameraManager;
  sceneEngine: SceneEngine;
  sceneManager: SceneManager;
  roomBoxGroup: THREE.Group | null;
  roomBoxWalls: ViewerCoreRoomWallEntry[];
  roomBoxFloor: THREE.Mesh | null;
  roomBoxFloorOutline: THREE.LineLoop | null;
  roomBoxCeiling: THREE.Mesh | null;
  roomFloorRoot: THREE.Group | null;
  roomUtilitiesRoot: THREE.Group | null;
  roomBounds: ViewerCoreRoomBounds | null;
  roomCeilingVisible: boolean;
  roomFloorMode: RoomFloorMode;
  hiddenRoomWallIds: Set<number>;
  manualHiddenWallId: number | null;
  displayMaterials: DisplayMaterialController;
  ultraMaterials: UltraMaterialController;
  materialPipeline: MaterialPipelineFacade;
  boxes: Map<string, ViewerBoxEntry>;
  _boundingBox: THREE.Box3;
  _center: THREE.Vector3;
  _diagnosticsLogged: boolean;
  panelVisibility: ViewerPanelVisibility;
  industrialDesignMode: IndustrialDesignWorkspaceMode;
  industrialDesignViewerOverlay: IndustrialDesignViewerOverlay;
  industrialDesignCallbacks: IndustrialDesignCallbacksState;
  boxSceneController: BoxSceneController;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  pointerPicking: PointerPickingFacade;
  selectionOutline: SelectionOutlineController;
  wallSelectionOutline: WallSelectionOutlineController;
  highlightManager: HighlightManager | null;
  edgeOutlineSystem: EdgeOutlineSystem | null;
  internalSelectionOutline: InternalSelectionOutline | null;
  multiSelectionOutline: MultiSelectionOutline | null;
  selectedBoxChangeListeners: Set<(id: string | null) => void>;
  wallGizmo: WallGizmo | null;
  roomBuilder: RoomBuilder;
  roomManager: RoomManager | null;
  boundsCache: ViewerBoundsCache;
  defaultGroundSize: number;
  orlaVisualizer: OrlaVisualizer;
  remateVisualizer: RematePieceVisualizer;
  tampoVisualizer: TampoPieceVisualizer;
  hematiVisualizer: HematiVisualizer;
  rodapeVisualizer: RodapeVisualizer;
  remateVisualBridge: RematePieceVisualBridge | null;
  rodapeVisualBridge: RodapeVisualBridge | null;
  divSepVisualBridge: DivSepVisualBridge | null;
  pendingViewerVisualSync: FinishSyncFlags;
  lockEnabled: boolean;
  groupGizmo: GroupGizmo | null;
  constraints: TransformConstraints;
  snapEngine: SnapEngine;
  remateSmartSnapping: RemateSmartSnapping;
  smartSnappingEngine: SmartSnapping;
  smartAlignSnapEngine: SmartAlignSnapEngine;
  smartAlignOverlay: SmartAlignOverlayFacade;
  viewerTools: ViewerTools;
  overlayCoordinator: ViewerOverlayCoordinator;
  measurementEngine: MeasurementEngine;
  gizmoEngine: GizmoEngine;
  transformControls: TransformControls | null;
  transformControlsHelper: THREE.Object3D | null;
  controls: Controls | null;
  shiftKeyHeld: boolean;
  dragStartZForShiftLock: number | undefined;
  isApplyingTransformConstraints: boolean;
  transformDragEndStamp: number;
  transformDiagnosticsEnabled: boolean;
  boxesIntersectingWalls: Set<string>;
  mouseInputPreset: MouseInputPreset;
  settings: { enableSmartAlignSnap: boolean };
  snapDebugOverlay: SnapDebugOverlay | null;
  lastSnapDebugData: SnapDebugData | null;
  runtimeLoop: ViewerRuntimeLoop;

  onBoxSelected: ViewerCoreSelectionOpsDeps["onBoxSelected"];
  onMultiSelectToggle: ViewerCoreEventOpsDeps["onMultiSelectToggle"];
  onRemateSelected: ViewerCoreEventOpsDeps["onRemateSelected"];
  onRodapeSelected: ViewerCoreFinishOpsDeps["onRodapeSelected"];
  onInternalSurfaceSelected: ViewerCoreSelectionOpsDeps["onInternalSurfaceSelected"];
  onInternalEdgeSelected: ViewerCoreSelectionOpsDeps["onInternalEdgeSelected"];
  onInternalPointSelected: ViewerCoreSelectionOpsDeps["onInternalPointSelected"];
  onDoorLayerDoubleClick: ViewerCoreEventOpsDeps["onDoorLayerDoubleClick"];
  onDrawerLayerDoubleClick: ViewerCoreEventOpsDeps["onDrawerLayerDoubleClick"];
  onDrawerLayerClick: ViewerCoreEventOpsDeps["onDrawerLayerClick"];
  onBoxDoubleClick: ViewerCoreEventOpsDeps["onBoxDoubleClick"];
  onTransformDragEnd: ViewerCoreTransformOpsDeps["onTransformDragEnd"];
  onRoomElementPlaced: ViewerCoreEventOpsDeps["onRoomElementPlaced"];
  onRoomElementSelected: ViewerCoreEventOpsDeps["onRoomElementSelected"];
  onWallSelected: ViewerCoreSelectionOpsDeps["onWallSelected"];
  onWallTransform: ViewerCoreRoomGeometryDeps["onWallTransform"];
  onRoomElementTransform: ViewerCoreRoomGeometryDeps["onRoomElementTransform"];
  onRoomUtilitySelected: ViewerCoreEventOpsDeps["onRoomUtilitySelected"];
  onRoomUtilityTransform: ViewerCoreRoomGeometryDeps["onRoomUtilityTransform"];
  onBoxTransform: ViewerCoreTransformOpsDeps["onBoxTransform"];

  ensureLightingEngine: ViewerCoreDisplayOpsDeps["ensureLightingEngine"];
  ensureComposerEngine: ViewerCoreDisplayOpsDeps["ensureComposerEngine"];
  setMaterialMode: ViewerCoreDisplayOpsDeps["setMaterialMode"];
  updateCanvasSize: ViewerCoreDisplayOpsDeps["updateCanvasSize"];
  requestRender: ViewerCoreDisplayOpsDeps["requestRender"];
  disposeObject: ViewerCoreRoomGeometryDeps["disposeObject"];
  applyBackgroundMode: ViewerCoreRoomGeometryDeps["applyBackgroundMode"];
  refreshTransformControlsAttachment: ViewerCoreRoomGeometryDeps["refreshTransformControlsAttachment"];
  refreshOutlineTarget: ViewerCoreRoomGeometryDeps["refreshOutlineTarget"];
  getRemateMesh: ViewerCoreFinishOpsDeps["getRemateMesh"];
  applyPanelVisibilityForObject: ViewerCoreFinishOpsDeps["applyPanelVisibilityForObject"];
  refreshViewerAttachmentsAfterMeshMutation: ViewerCoreFinishOpsDeps["refreshViewerAttachmentsAfterMeshMutation"];
  syncRemateVisuals: ViewerCoreFinishOpsDeps["syncRemateVisuals"];
  resolveFinishCollisionAfterSync: ViewerCoreFinishOpsDeps["resolveFinishCollisionAfterSync"];
  applyFloorConstraint: ViewerCoreTransformOpsDeps["applyFloorConstraint"];
  applyRoomConstraint: ViewerCoreTransformOpsDeps["applyRoomConstraint"];
  isMeshInsideOrTouchingRoom: ViewerCoreTransformOpsDeps["isMeshInsideOrTouchingRoom"];
  clearSnapState: ViewerCoreTransformOpsDeps["clearSnapState"];
  shouldUseFeetLock: ViewerCoreTransformOpsDeps["shouldUseFeetLock"];
  getFixedYForCabinet: ViewerCoreTransformOpsDeps["getFixedYForCabinet"];
  updateBoxesIntersectingWalls: ViewerCoreTransformOpsDeps["updateBoxesIntersectingWalls"];
  applyDynamicAlignSnap: ViewerCoreTransformOpsDeps["applyDynamicAlignSnap"];
  applyFinishCollisionConstraint: ViewerCoreTransformOpsDeps["applyFinishCollisionConstraint"];
  applyMousePresetToControls: ViewerCoreTransformOpsDeps["applyMousePresetToControls"];
  notifyRemateTransform: ViewerCoreTransformOpsDeps["notifyRemateTransform"];
  notifyHematiTransform: ViewerCoreTransformOpsDeps["notifyHematiTransform"];
  notifyRodapeTransform: ViewerCoreTransformOpsDeps["notifyRodapeTransform"];
  notifyDivSepTransform: ViewerCoreTransformOpsDeps["notifyDivSepTransform"];
  notifyWallTransform: ViewerCoreTransformOpsDeps["notifyWallTransform"];
  notifyRoomElementTransform: ViewerCoreTransformOpsDeps["notifyRoomElementTransform"];
  notifyRoomUtilityTransform: ViewerCoreTransformOpsDeps["notifyRoomUtilityTransform"];
  getRoomUtilityById: ViewerCoreTransformOpsDeps["getRoomUtilityById"];
  flushDeferredBoxStructureUpdates: ViewerCoreTransformOpsDeps["flushDeferredBoxStructureUpdates"];
  flushDeferredViewerVisualSyncs: ViewerCoreTransformOpsDeps["flushDeferredViewerVisualSyncs"];
  getDivSepMesh: ViewerCoreTransformOpsDeps["getDivSepMesh"];
  setSelectedBox: ViewerCoreEventOpsDeps["setSelectedBox"];
  setHoveredBox: ViewerCoreEventOpsDeps["setHoveredBox"];
  setHoveredRemate: ViewerCoreEventOpsDeps["setHoveredRemate"];
  selectHemati: ViewerCoreEventOpsDeps["selectHemati"];
  selectRodape: ViewerCoreEventOpsDeps["selectRodape"];
  selectRemate: ViewerCoreEventOpsDeps["selectRemate"];
  selectDivSep: ViewerCoreEventOpsDeps["selectDivSep"];
  getDivSepHitAtPointer: ViewerCoreEventOpsDeps["getDivSepHitAtPointer"];
  getHematiIdAtPointer: ViewerCoreEventOpsDeps["getHematiIdAtPointer"];
  getRodapeIdAtPointer: ViewerCoreEventOpsDeps["getRodapeIdAtPointer"];
  getRemateIdAtPointer: ViewerCoreEventOpsDeps["getRemateIdAtPointer"];
  getPointerSelectionEncodedId: ViewerCoreEventOpsDeps["getPointerSelectionEncodedId"];
  getInternalSelectionHit: ViewerCoreEventOpsDeps["getInternalSelectionHit"];
  setInternalSelection: ViewerCoreEventOpsDeps["setInternalSelection"];
  getContextMenuLayerHit: ViewerCoreEventOpsDeps["getContextMenuLayerHit"];
  logTransformDiagnostic: ViewerCoreEventOpsDeps["logTransformDiagnostic"];
  getHematiMesh: ViewerCoreToolsOpsDeps["getHematiMesh"];
  getRodapeMesh: ViewerCoreToolsOpsDeps["getRodapeMesh"];
  applyTransformControlsMouseGuard: ViewerCoreToolsOpsDeps["applyTransformControlsMouseGuard"];
  setOutlineTarget: ViewerCoreToolsOpsDeps["setOutlineTarget"];
  clampTransform: ViewerCoreToolsOpsDeps["clampTransform"];
  resolveMemberMesh: ViewerCoreToolsOpsDeps["resolveMemberMesh"];
  applyGroupPivotTransform: ViewerCoreToolsOpsDeps["applyGroupPivotTransform"];
  notifyGroupTransform: ViewerCoreToolsOpsDeps["notifyGroupTransform"];
  clampGroupTransform: ViewerCoreToolsOpsDeps["clampGroupTransform"];
  getRoomOpeningsForSnapping: ViewerCoreSnappingOpsDeps["getRoomOpeningsForSnapping"];
  lerpLightsToTarget: ViewerCoreRuntimeOpsDeps["lerpLightsToTarget"];
  updateDimensionsOverlay: ViewerCoreRuntimeOpsDeps["updateDimensionsOverlay"];
  updateWallVisibilityBasedOnCamera: ViewerCoreRuntimeOpsDeps["updateWallVisibilityBasedOnCamera"];
  updateReflectionProbe: ViewerCoreRuntimeOpsDeps["updateReflectionProbe"];
  isObjectAttachedToScene: ViewerCoreSelectionOpsDeps["isObjectAttachedToScene"];
};

export function getDisplayEngineApiImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreDisplayOpsDeps {
    return {
      viewerState: host.viewerState,
      getTurntableEnabled: () => host.turntableEnabled,
      setTurntableEnabled: (enabled) => {
        host.turntableEnabled = enabled;
      },
      isMobile: host.isMobile,
      lights: host.lights,
      ensureLightingEngine: () => host.ensureLightingEngine(),
      getLightingEngine: () => host.lightingEngine,
      ensureComposerEngine: () => host.ensureComposerEngine(),
      getComposerEngine: () => host.composerEngine,
      getUltraPerformanceMode: () => host.ultraPerformanceMode,
      setUltraPerformanceModeFlag: (active) => {
        host.ultraPerformanceMode = active;
      },
      getUltraPerformanceModeOptions: () => host.ultraPerformanceModeOptions,
      setUltraPerformanceModeOptionsState: (options) => {
        host.ultraPerformanceModeOptions = options;
      },
      getUltraRenderState: () => host.ultraRenderState,
      setUltraRenderState: (state) => {
        host.ultraRenderState = state;
      },
      getMaterialQuality: () => host.materialQuality,
      setMaterialQualityState: (quality) => {
        host.materialQuality = quality;
      },
      getReflectionsEnabled: () => host.reflectionsEnabled,
      setReflectionsEnabledState: (enabled) => {
        host.reflectionsEnabled = enabled;
      },
      getPhotoModeEnabled: () => host.photoModeEnabled,
      setPhotoModeEnabledState: (enabled) => {
        host.photoModeEnabled = enabled;
      },
      getMatteMode: () => host.matteMode,
      setMatteModeState: (enabled) => {
        host.matteMode = enabled;
      },
      getBackgroundMode: () => host.backgroundMode,
      setBackgroundModeState: (mode) => {
        host.backgroundMode = mode;
      },
      getGlossIntensity: () => host.glossIntensity,
      setGlossIntensityState: (value) => {
        host.glossIntensity = value;
      },
      getReflectionUpdateIntervalFrames: () => host.reflectionUpdateIntervalFrames,
      setReflectionUpdateIntervalFrames: (frames) => {
        host.reflectionUpdateIntervalFrames = frames;
      },
      baseToneMappingExposure: host.baseToneMappingExposure,
      defaultPixelRatio: host.defaultPixelRatio,
      rendererManager: host.rendererManager,
      sceneEngine: host.sceneEngine,
      sceneManager: host.sceneManager,
      getRoomBoxFloor: () => host.roomBoxFloor,
      getRoomBoxFloorOutline: () => host.roomBoxFloorOutline,
      displayMaterials: host.displayMaterials,
      ultraMaterials: host.ultraMaterials,
      materialPipeline: host.materialPipeline,
      getRoomBounds: () => host.roomBounds,
      boxes: host.boxes,
      boundingBox: host._boundingBox,
      center: host._center,
      setMaterialMode: (mode) => host.setMaterialMode(mode),
      updateCanvasSize: () => host.updateCanvasSize(),
      requestRender: () => host.requestRender(),
    };
  }

export function getIndustrialEngineApiImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreIndustrialModeDeps {
    return {
      panelVisibility: host.panelVisibility,
      industrialDesignMode: host.industrialDesignMode,
      industrialDesignViewerOverlay: host.industrialDesignViewerOverlay,
      boxes: host.boxes,
      getIndustrialDesignCallbacks: () => host.industrialDesignCallbacks,
      setIndustrialDesignCallbacks: (callbacks) => {
        host.industrialDesignCallbacks = callbacks;
      },
      raycaster: host.raycaster,
      pointer: host.pointer,
      getCamera: () => host.cameraManager.camera,
      getCanvas: () => host.rendererManager.renderer.domElement,
      boxSceneController: host.boxSceneController,
    };
  }

export function getRoomEngineApiImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreRoomGeometryDeps {
    return {
      getRoomBoxGroup: () => host.roomBoxGroup,
      setRoomBoxGroup: (group) => {
        host.roomBoxGroup = group;
      },
      getRoomBoxWalls: () => host.roomBoxWalls,
      setRoomBoxWalls: (walls) => {
        host.roomBoxWalls = walls;
      },
      getRoomBoxFloor: () => host.roomBoxFloor,
      setRoomBoxFloor: (floor) => {
        host.roomBoxFloor = floor;
      },
      getRoomBoxFloorOutline: () => host.roomBoxFloorOutline,
      setRoomBoxFloorOutline: (outline) => {
        host.roomBoxFloorOutline = outline;
      },
      getRoomBoxCeiling: () => host.roomBoxCeiling,
      setRoomBoxCeiling: (ceiling) => {
        host.roomBoxCeiling = ceiling;
      },
      getRoomFloorRoot: () => host.roomFloorRoot,
      setRoomFloorRoot: (root) => {
        host.roomFloorRoot = root;
      },
      getRoomUtilitiesRoot: () => host.roomUtilitiesRoot,
      setRoomUtilitiesRoot: (root) => {
        host.roomUtilitiesRoot = root;
      },
      getRoomBounds: () => host.roomBounds,
      setRoomBounds: (bounds) => {
        host.roomBounds = bounds;
      },
      getRoomCeilingVisible: () => host.roomCeilingVisible,
      setRoomCeilingVisibleFlag: (visible) => {
        host.roomCeilingVisible = visible;
      },
      getRoomFloorMode: () => host.roomFloorMode,
      setRoomFloorModeState: (mode) => {
        host.roomFloorMode = mode;
      },
      getHiddenRoomWallIds: () => host.hiddenRoomWallIds,
      setHiddenRoomWallIds: (ids) => {
        host.hiddenRoomWallIds = ids;
      },
      getManualHiddenWallId: () => host.manualHiddenWallId,
      setManualHiddenWallId: (id) => {
        host.manualHiddenWallId = id;
      },
      sceneManager: host.sceneManager,
      materialPipeline: host.materialPipeline,
      boundsCache: host.boundsCache,
      roomBuilder: host.roomBuilder,
      wallGizmo: host.wallGizmo,
      viewerState: host.viewerState,
      getRoomManager: () => host.roomManager,
      defaultGroundSize: host.defaultGroundSize,
      getBackgroundMode: () => host.backgroundMode,
      disposeObject: (object) => host.disposeObject(object),
      applyBackgroundMode: () => host.applyBackgroundMode(),
      refreshTransformControlsAttachment: () => host.refreshTransformControlsAttachment(),
      refreshOutlineTarget: () => host.refreshOutlineTarget(),
      getWallIdInFrontOfCamera: () => host.pointerPicking.getWallIdInFrontOfCamera(),
      getCamera: () => host.cameraManager.camera,
      onWallTransform: host.onWallTransform,
      onRoomElementTransform: host.onRoomElementTransform,
      onRoomUtilityTransform: host.onRoomUtilityTransform,
    };
  }

export function getSelectionEngineApiImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreSelectionOpsDeps {
    return {
      viewerState: host.viewerState,
      getHighlightManager: () => host.highlightManager,
      updateOutline: () => host.viewerTools.updateOutline(),
      selectionOutline: host.selectionOutline,
      getMultiSelectionOutline: () => host.multiSelectionOutline,
      wallSelectionOutline: host.wallSelectionOutline,
      getEdgeOutlineSystem: () => host.edgeOutlineSystem,
      getInternalSelectionOutline: () => host.internalSelectionOutline,
      sceneManager: host.sceneManager,
      boxes: host.boxes,
      getRoomBoxWalls: () => host.roomBoxWalls,
      getCamera: () => host.cameraManager.camera,
      getRemateMesh: (remateId) => host.getRemateMesh(remateId),
      getRemateVisualBridge: () => host.remateVisualBridge,
      getRodapeVisualBridge: () => host.rodapeVisualBridge,
      rodapeVisualizer: host.rodapeVisualizer,
      wallGizmo: host.wallGizmo,
      refreshTransformControlsAttachment: () => host.refreshTransformControlsAttachment(),
      onWallSelected: host.onWallSelected,
      onBoxSelected: host.onBoxSelected,
      selectedBoxChangeListeners: host.selectedBoxChangeListeners,
      onMeasurementSelectionChanged: (boxId) => host.measurementEngine.onSelectionChanged(boxId),
      onInternalSurfaceSelected: host.onInternalSurfaceSelected,
      onInternalEdgeSelected: host.onInternalEdgeSelected,
      onInternalPointSelected: host.onInternalPointSelected,
      applyPanelVisibilityForAllBoxes: () =>
        applyPanelVisibilityForAllBoxesImpl(getIndustrialEngineApiImpl(host)),
      isObjectAttachedToScene: (object) => host.isObjectAttachedToScene(object),
    };
  }

export function getFinishOpsDepsImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreFinishOpsDeps {
    return {
      orlaVisualizer: host.orlaVisualizer,
      remateVisualizer: host.remateVisualizer,
      tampoVisualizer: host.tampoVisualizer,
      hematiVisualizer: host.hematiVisualizer,
      rodapeVisualizer: host.rodapeVisualizer,
      getRemateVisualBridge: () => host.remateVisualBridge,
      setRemateVisualBridge: (bridge) => {
        host.remateVisualBridge = bridge;
      },
      setRodapeVisualBridge: (bridge) => {
        host.rodapeVisualBridge = bridge;
      },
      setDivSepVisualBridge: (bridge) => {
        host.divSepVisualBridge = bridge;
      },
      boxes: host.boxes,
      pendingViewerVisualSync: host.pendingViewerVisualSync,
      isTransformDragging: () => host.viewerState.getTransformControlsDragging(),
      refreshViewerAttachmentsAfterMeshMutation: () => host.refreshViewerAttachmentsAfterMeshMutation(),
      applyPanelVisibilityForObject: (root) => host.applyPanelVisibilityForObject(root),
      viewerState: host.viewerState,
      onRemateSelected: host.onRemateSelected,
      onRodapeSelected: host.onRodapeSelected,
      refreshTransformControlsAttachment: () => host.refreshTransformControlsAttachment(),
      refreshOutlineTarget: () => host.refreshOutlineTarget(),
      notifyRemateTransform: () => host.notifyRemateTransform(),
      syncRemateVisuals: () => host.syncRemateVisuals(),
      lockEnabled: host.lockEnabled,
      resolveFinishCollisionAfterSync: (params) => host.resolveFinishCollisionAfterSync(params),
      getRemateMesh: (remateId) => host.getRemateMesh(remateId),
    };
  }

export function getTransformOpsDepsImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreTransformOpsDeps {
    return {
      viewerState: host.viewerState,
      boxes: host.boxes,
      groupGizmo: host.groupGizmo,
      constraints: host.constraints,
      snapEngine: host.snapEngine,
      remateSmartSnapping: host.remateSmartSnapping,
      smartSnappingEngine: host.smartSnappingEngine,
      smartAlignSnapEngine: host.smartAlignSnapEngine,
      viewerTools: host.viewerTools,
      overlayCoordinator: host.overlayCoordinator,
      measurementEngine: host.measurementEngine,
      roomBuilder: host.roomBuilder,
      boundingBox: host._boundingBox,
      getTransformControls: () => host.transformControls,
      getControls: () => host.controls,
      getLockEnabled: () => host.lockEnabled,
      getShiftKeyHeld: () => host.shiftKeyHeld,
      getDragStartZForShiftLock: () => host.dragStartZForShiftLock,
      setDragStartZForShiftLock: (value) => {
        host.dragStartZForShiftLock = value;
      },
      getIsApplyingTransformConstraints: () => host.isApplyingTransformConstraints,
      setIsApplyingTransformConstraints: (value) => {
        host.isApplyingTransformConstraints = value;
      },
      getTransformDragEndStamp: () => host.transformDragEndStamp,
      setTransformDragEndStamp: (stamp) => {
        host.transformDragEndStamp = stamp;
      },
      getTransformDiagnosticsEnabled: () => host.transformDiagnosticsEnabled,
      getSelectedDivSep: () => host.viewerState.getSelectedDivSep(),
      getDivSepMesh: (selection) => host.getDivSepMesh(selection),
      getDivSepVisualBridge: () => host.divSepVisualBridge,
      getRemateMesh: (remateId) => host.getRemateMesh(remateId),
      getRemateVisualBridge: () => host.remateVisualBridge,
      rodapeVisualizer: host.rodapeVisualizer,
      getRoomBounds: () => host.roomBounds,
      getRoomBoxWalls: () => host.roomBoxWalls,
      applyFloorConstraint: (mesh) => host.applyFloorConstraint(mesh),
      applyRoomConstraint: (obj, options) => host.applyRoomConstraint(obj, options),
      isMeshInsideOrTouchingRoom: (obj) => host.isMeshInsideOrTouchingRoom(obj),
      clearSnapState: (obj) => host.clearSnapState(obj),
      shouldUseFeetLock: (entry) => host.shouldUseFeetLock(entry),
      getFixedYForCabinet: (entry) => host.getFixedYForCabinet(entry),
      updateBoxesIntersectingWalls: () => host.updateBoxesIntersectingWalls(),
      setLastSnapDebugData: (data) => {
        host.lastSnapDebugData = data;
      },
      applyDynamicAlignSnap: (params) => host.applyDynamicAlignSnap(params),
      applyFinishCollisionConstraint: (mesh, excludeBoxId, excludeRemateId, excludeRodapeId) =>
        host.applyFinishCollisionConstraint(mesh, excludeBoxId, excludeRemateId, excludeRodapeId),
      refreshGizmoAttachment: () => host.gizmoEngine.refreshAttachment(),
      applyMousePresetToControls: () => host.applyMousePresetToControls(),
      onBoxTransform: host.onBoxTransform,
      notifyRemateTransform: () => host.notifyRemateTransform(),
      notifyHematiTransform: () => host.notifyHematiTransform(),
      notifyRodapeTransform: () => host.notifyRodapeTransform(),
      notifyDivSepTransform: () => host.notifyDivSepTransform(),
      notifyWallTransform: () => host.notifyWallTransform(),
      notifyRoomElementTransform: () => host.notifyRoomElementTransform(),
      notifyRoomUtilityTransform: () => host.notifyRoomUtilityTransform(),
      getRoomUtilityById: (utilityId) => host.getRoomUtilityById(utilityId),
      onTransformDragEnd: host.onTransformDragEnd,
      flushDeferredBoxStructureUpdates: () => host.flushDeferredBoxStructureUpdates(),
      flushDeferredViewerVisualSyncs: () => host.flushDeferredViewerVisualSyncs(),
      refreshViewerAttachmentsAfterMeshMutation: () => host.refreshViewerAttachmentsAfterMeshMutation(),
    };
  }

export function buildEventEngineApiImpl(host: ViewerCoreEngineApisOpsDeps): IViewerEventEngine {
    return getEventEngineApiImpl(getEventOpsDepsImpl(host));
  }

export function getEventOpsDepsImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreEventOpsDeps {
    return {
      viewerState: host.viewerState,
      rendererManager: host.rendererManager,
      cameraManager: host.cameraManager,
      pointerPicking: host.pointerPicking,
      pointer: host.pointer,
      raycaster: host.raycaster,
      getHighlightManager: () => host.highlightManager,
      roomBuilder: host.roomBuilder,
      getRoomBoxWalls: () => host.roomBoxWalls,
      getWallGizmo: () => host.wallGizmo,
      getControls: () => host.controls,
      getMouseInputPreset: () => host.mouseInputPreset,
      industrialDesignMode: host.industrialDesignMode,
      setSelectedBox: (id, options) => host.setSelectedBox(id, options),
      setHoveredBox: (id) => host.setHoveredBox(id),
      setHoveredRemate: (id) => host.setHoveredRemate(id),
      selectHemati: (id) => host.selectHemati(id),
      selectRodape: (id) => host.selectRodape(id),
      selectRemate: (id) => host.selectRemate(id),
      selectDivSep: (hit) => host.selectDivSep(hit),
      getDivSepHitAtPointer: (e) => host.getDivSepHitAtPointer(e),
      getHematiIdAtPointer: (e) => host.getHematiIdAtPointer(e),
      getRodapeIdAtPointer: (e) => host.getRodapeIdAtPointer(e),
      getRemateIdAtPointer: (e) => host.getRemateIdAtPointer(e),
      getPointerSelectionEncodedId: (e) => host.getPointerSelectionEncodedId(e),
      getInternalSelectionHit: (e) => host.getInternalSelectionHit(e),
      setInternalSelection: (selection) => host.setInternalSelection(selection),
      getContextMenuLayerHit: (e) => host.getContextMenuLayerHit(e),
      refreshTransformControlsAttachment: () => host.refreshTransformControlsAttachment(),
      refreshOutlineTarget: () => host.refreshOutlineTarget(),
      logTransformDiagnostic: (name, data) => host.logTransformDiagnostic(name, data),
      onRoomElementSelected: host.onRoomElementSelected,
      onRoomUtilitySelected: host.onRoomUtilitySelected,
      onWallSelected: host.onWallSelected,
      onBoxSelected: host.onBoxSelected,
      onMultiSelectToggle: host.onMultiSelectToggle,
      onRemateSelected: host.onRemateSelected,
      onRoomElementPlaced: host.onRoomElementPlaced,
      onDoorLayerDoubleClick: host.onDoorLayerDoubleClick,
      onDrawerLayerDoubleClick: host.onDrawerLayerDoubleClick,
      onDrawerLayerClick: host.onDrawerLayerClick,
      onBoxDoubleClick: host.onBoxDoubleClick,
      setShiftKeyHeld: (held) => {
        host.shiftKeyHeld = held;
      },
    };
  }

export function buildToolsEngineApiImpl(host: ViewerCoreEngineApisOpsDeps): IViewerToolsEngine {
    return getToolsEngineApiImpl(getToolsOpsDepsImpl(host));
  }

export function getToolsOpsDepsImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreToolsOpsDeps {
    return {
      viewerState: host.viewerState,
      boxes: host.boxes,
      roomBuilder: host.roomBuilder,
      selectionOutline: host.selectionOutline,
      boxesIntersectingWalls: host.boxesIntersectingWalls,
      getTransformControls: () => host.transformControls,
      getTransformControlsHelper: () => host.transformControlsHelper,
      setTransformHelperVisible: (visible) => {
        if (host.transformControlsHelper) host.transformControlsHelper.visible = visible;
      },
      getGroupGizmo: () => host.groupGizmo,
      getRoomBoxWalls: () => host.roomBoxWalls,
      getDivSepMesh: (selection) => host.getDivSepMesh(selection),
      getHematiMesh: (hematiId) => host.getHematiMesh(hematiId),
      getRodapeMesh: (rodapeId) => host.getRodapeMesh(rodapeId),
      getRemateMesh: (remateId) => host.getRemateMesh(remateId),
      getRoomUtilityById: (id) => host.getRoomUtilityById(id),
      applyTransformControlsMouseGuard: () => host.applyTransformControlsMouseGuard(),
      logTransformDiagnostic: (name, data) => host.logTransformDiagnostic(name, data),
      setOutlineTarget: (mesh, opacity, colorHex) => host.setOutlineTarget(mesh, opacity, colorHex),
      clampTransform: () => host.clampTransform(),
      resolveMemberMesh: (encoded) => host.resolveMemberMesh(encoded),
      applyGroupPivotTransform: () => host.applyGroupPivotTransform(),
      notifyGroupTransform: () => host.notifyGroupTransform(),
      clampGroupTransform: () => host.clampGroupTransform(),
    };
  }

export function getSnappingOpsDepsImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreSnappingOpsDeps {
    return {
      boxes: host.boxes,
      snapEngine: host.snapEngine,
      smartSnappingEngine: host.smartSnappingEngine,
      smartAlignSnapEngine: host.smartAlignSnapEngine,
      smartAlignOverlay: host.smartAlignOverlay,
      getEnableSmartAlignSnap: () => host.settings.enableSmartAlignSnap,
      getRoomBounds: () => host.roomBounds,
      getRoomOpeningsForSnapping: () => host.getRoomOpeningsForSnapping(),
      getRemateVisualBridge: () => host.remateVisualBridge,
      getRodapeVisualBridge: () => host.rodapeVisualBridge,
      getRemateMesh: (remateId) => host.getRemateMesh(remateId),
      rodapeVisualizer: host.rodapeVisualizer,
    };
  }

export function getRuntimeOpsDepsImpl(host: ViewerCoreEngineApisOpsDeps): ViewerCoreRuntimeOpsDeps {
    return {
      rendererManager: host.rendererManager,
      cameraManager: host.cameraManager,
      lights: host.lights,
      getControls: () => host.controls,
      getUltraPerformanceMode: () => host.ultraPerformanceMode,
      getReflectionsEnabled: () => host.reflectionsEnabled,
      getMaterialQuality: () => host.materialQuality,
      getDiagnosticsLogged: () => host._diagnosticsLogged,
      setDiagnosticsLogged: (logged) => {
        host._diagnosticsLogged = logged;
      },
      getReflectionFrameCounter: () => host.reflectionFrameCounter,
      setReflectionFrameCounter: (value) => {
        host.reflectionFrameCounter = value;
      },
      getReflectionUpdateIntervalFrames: () => host.reflectionUpdateIntervalFrames,
      getWallGizmo: () => host.wallGizmo,
      getSnapDebugOverlay: () => host.snapDebugOverlay,
      getLastSnapDebugData: () => host.lastSnapDebugData,
      overlayCoordinator: host.overlayCoordinator,
      runtimeLoop: host.runtimeLoop,
      measurementEngine: host.measurementEngine,
      smartSnappingEngine: host.smartSnappingEngine,
      smartAlignOverlay: host.smartAlignOverlay,
      lerpLightsToTarget: () => host.lerpLightsToTarget(),
      updateDimensionsOverlay: () => host.updateDimensionsOverlay(),
      updateWallVisibilityBasedOnCamera: () => host.updateWallVisibilityBasedOnCamera(),
      updateSelectionOverlaysFrame: () => updateSelectionOverlaysFrameImpl(getSelectionEngineApiImpl(host)),
      updateReflectionProbe: (force) => host.updateReflectionProbe(force),
    };
  }
