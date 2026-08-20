import type { IViewerEventEngine } from "./events/EventEngineTypes";
import type { IViewerToolsEngine } from "./tools/ToolsEngineTypes";
import type { ViewerCoreDisplayOpsDeps } from "./ViewerCoreDisplayOps";
import type { ViewerCoreIndustrialModeDeps } from "./ViewerCoreIndustrialMode";
import { applyPanelVisibilityForAllBoxesImpl } from "./ViewerCoreIndustrialMode";
import type { ViewerCoreRoomGeometryDeps } from "./ViewerCoreRoomGeometry";
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
 * Passado via cast a partir de getEngineApisOpsDeps().
 */
export type ViewerCoreEngineApisOpsDeps = {
  [key: string]: any;
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
      setTransformAttachmentRefreshSuspended: (v) => host.setTransformAttachmentRefreshSuspended(v),
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

/** API EventsManager — alias estável do Bloco 3.7. */
export function getEventEngineApiFromHostImpl(host: ViewerCoreEngineApisOpsDeps): IViewerEventEngine {
  return buildEventEngineApiImpl(host);
}

/** API ViewerTools — alias estável do Bloco 3.7. */
export function getToolsEngineApiFromHostImpl(host: ViewerCoreEngineApisOpsDeps): IViewerToolsEngine {
  return buildToolsEngineApiImpl(host);
}
