import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import { SceneManager } from "./scene";
import { SceneEngine } from "./scene/SceneEngine";
import { CameraManager } from "./camera";
import { CameraEngine } from "./camera/CameraEngine";
import { RendererManager } from "./renderer";
import { Lights } from "./lighting";
import { LightingEngine } from "./lighting/LightingEngine";
import { ensureViewerLightingEngine } from "./engines/LightingEngine";
import { ComposerEngine } from "./lighting/ComposerEngine";
import { ensureViewerComposerEngine } from "./engines/ComposerEngine";
import type { SelectionEngine } from "./selection/SelectionEngine";
import { createViewerGizmoEngine } from "./engines/GizmoEngine";
import type { BoxEngine } from "./box/BoxEngine";
import { ensureViewerBoxEngine } from "./engines/BoxEngine";
import { ViewerRoomEngine } from "./room/ViewerRoomEngine";
import { ensureViewerRoomEngine as ensureViewerRoomEngineFactory } from "./engines/ViewerRoomEngine";
import { ensureViewerDesignerEngine } from "./engines/DesignerEngine";
import { createFinishSyncFlags, flushPendingFinishSync } from "./finish/ViewerFinishSync";
import { Controls } from "./controls";
import {
  applyMouseInputMappingToOrbitControls,
  getMouseInputMapping,
  normalizeMouseInputPreset,
  type MouseInputPreset,
} from "./controls/MouseInputMapper";
import { BoxSceneController } from "./box/BoxSceneController";
import { ViewerBoxManager } from "./box";
import { SnapshotRenderer } from "./snapshot";
import type { HighlightManager } from "./highlight";
import type { EdgeOutlineSystem } from "../outline";
import { ViewerRaycastSystem } from "./raycast/ViewerRaycastSystem";
import { ViewerState } from "./state";
import { EventsManager } from "./events";
import type { IViewerEventEngine } from "./events/EventEngineTypes";
import { ViewerTools } from "./tools";
import { GroupGizmo } from "./tools/GroupGizmo";
import type { IViewerToolsEngine } from "./tools/ToolsEngineTypes";

import type { MaterialSet } from "../materials/MaterialLibrary";
import type { LoadedWoodMaterial } from "../materials/WoodMaterial";
import type { MaterialMode } from "./materials";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { DisplayMaterialController } from "./materials/displayMaterialController";
import type { UltraMaterialController } from "./materials/ultraMaterialController";
import {
  mergeViewerMaterialSet,
} from "./materials/materialSetState";
import {
  disposeLoadedWoodMaterial,
  isDoorOrDrawerFrontNode,
  isDrawerClickTargetGhost,
  isKitchenFeetNode,
} from "./materials/boxMaterialHelpers";
import { createClonedMaterialWithDetailMaps, ensureMaterialEngine } from "./materials/MaterialEngine";
import {
  describeMeshMaterial,
  isDrawerFrontExteriorMesh,
  traceDrawerFrontMaterial,
} from "./materials/drawerFrontMaterialTrace";
import { applyMeshGrainOrientation } from "./materials/viewerGrainOrientation";
import type { BoxOptions } from "../objects/BoxBuilder";
import type { ViewerBoxEntry } from "./types";
import type { BoxPanelIds, TechnicalDrillHole } from "../../core/types";
import { createDoorObject, getDoorSpecFromGroup } from "../objects/BoxBuilder";
import {
  createDrawerObject,
  getDrawerSpecFromGroup,
  buildDrawerSpecs,
} from "../objects/DrawerFactory";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import { filterTechnicalDrillHolesForViewerMesh, filterViewerDrillMarkersForMesh } from "./drill/viewerCncDrillFilter";
import {
  expandBox3ByObjectExcludingLayoutProxy,
  runWithAllLayoutBoundsProxiesVisible,
  runWithLayoutBoundsProxiesVisible,
  setBox3FromObjectExcludingLayoutProxy,
} from "./box/boxAabbUtils";
import { SYSTEM_BACK_MM } from "../../core/baseCabinets";
import type { ViewerOptions } from "@/viewer/core/viewerTypes";
export type { ViewerOptions } from "@/viewer/core/viewerTypes";
import { RoomBuilder } from "../room/RoomBuilder";
import type { ViewerCoreCameraOpsDeps } from "./ViewerCoreCameraOps";
import {
  adjustCameraPositionToIncludeBoxImpl,
  getBoxBoundingBoxCenterImpl,
  isBoxInCameraFrameImpl,
  syncCameraTargetImpl,
  updateCameraTargetImpl,
} from "./ViewerCoreCameraOps";
import type { ViewerCoreFeetOpsDeps } from "./ViewerCoreFeetOps";
import {
  getFixedYForCabinetImpl,
  shouldUseFeetLockImpl,
  syncFeetVisualForBoxImpl,
} from "./ViewerCoreFeetOps";
import type { ViewerCoreRoomUtilsDeps } from "./ViewerCoreRoomUtils";
import {
  applyRoomConstraintImpl,
  getRoomBoundsMmForAutoLayoutImpl,
  getRoomOpeningsForSnappingImpl,
  getRoomOpeningsMmForAutoLayoutImpl,
  isMeshInsideOrTouchingRoomImpl,
} from "./ViewerCoreRoomUtils";
import type { ViewerCoreDisplayOpsDeps } from "./ViewerCoreDisplayOps";
import {
  applyBackgroundModeImpl,
  getBackgroundModeImpl,
  getCurrentModeImpl,
  getGlobalLightIntensityImpl,
  getGlossIntensityImpl,
  getMaterialQualityImpl,
  getMatteModeImpl,
  getPhotoModeEnabledImpl,
  getReflectionsEnabledImpl,
  getShadowIntensityImpl,
  getShowcaseModeImpl,
  getUltraPerformanceModeImpl,
  getUltraPerformanceModeOptionsImpl,
  lerpLightsToTargetImpl,
  reapplyDisplayMaterialsImpl,
  setBackgroundModeImpl,
  setGlobalLightIntensityImpl,
  setGlossIntensityImpl,
  setMaterialQualityImpl,
  setMatteModeImpl,
  setModeImpl,
  setPhotoModeEnabledImpl,
  setReflectionsEnabledImpl,
  setShowcaseModeImpl,
  setUltraPerformanceModeImpl,
  setUltraPerformanceModeOptionsImpl,
  updateReflectionProbeImpl,
  updateShadowIntensityImpl,
} from "./ViewerCoreDisplayOps";
import type {
  IndustrialDesignCallbacksState,
  ViewerCoreIndustrialModeDeps,
} from "./ViewerCoreIndustrialMode";
import {
  applyExplodedViewForObjectImpl,
  applyPanelIdsToBoxImpl,
  applyPanelVisibilityForObjectImpl,
  applyViewerDrillHoleSceneRulesImpl,
    getExplodedViewEnabledImpl,
  getExplodedViewIntensityImpl,
  getHiddenPanelsImpl,
  getIndustrialDesignActiveHoleTypeImpl,
  getIndustrialDesignBoxImpl,
  getIndustrialDesignSelectedPanelIdImpl,
  getIndustrialDesignValidationIssuesImpl,
  getIndustrialDesignWorkspaceEnabledImpl,
  getPanelRenderingEnabledImpl,
  refreshIndustrialDesignValidationImpl,
  setAllPanelsHiddenImpl,
  setExplodedViewEnabledImpl,
  setExplodedViewIntensityImpl,
  setHiddenPanelsImpl,
  setIndustrialDesignActiveHoleTypeImpl,
  setIndustrialDesignBoxImpl,
  setIndustrialDesignSelectionHighlightImpl,
  setIndustrialDesignValidationHighlightImpl,
  setIndustrialDesignWorkspaceEnabledImpl,
  setOnIndustrialDesignChangedImpl,
  setOnIndustrialDesignHolePlacedImpl,
  setOnIndustrialDesignPanelSelectedImpl,
  setOnIndustrialDesignValidationChangedImpl,
  setOnIndustrialDesignValidationFailedImpl,
  setPanelEdgesVisibleImpl,
  setPanelHiddenImpl,
  setPanelRenderingEnabledImpl,
    } from "./ViewerCoreIndustrialMode";
import type { ViewerCoreRoomGeometryDeps } from "./ViewerCoreRoomGeometry";
import {
  clearRoomBoundsImpl,
  clearRoomFromManagerImpl,
  getManualWallHiddenImpl,
  getRoomUtilityByIdImpl,
  notifyRoomElementTransformImpl,
  notifyRoomUtilityTransformImpl,
  notifyWallTransformImpl,
  setManualWallHiddenImpl,
  setRoomBoundsImpl,
  setRoomCeilingVisibleImpl,
  setRoomFloorModeImpl,
  setRoomFromManagerImpl,
  setRoomHiddenWallsImpl,
  setRoomUtilitiesImpl,
  setWallEditModeImpl,
  updateWallVisibilityBasedOnCameraImpl,
} from "./ViewerCoreRoomGeometry";
import type { ViewerCoreSelectionOpsDeps } from "./ViewerCoreSelectionOps";
import {
  disposeSelectionSystemsImpl,
  getSelectionIdsInScreenRectImpl,
  refreshOutlineTargetImpl,
  resolveMemberMeshImpl,
    sanitizeSelectionOutlineStaleTargetImpl,
  selectRoomElementByIdImpl,
  selectRoomUtilityByIdImpl,
  selectWallByIndexImpl,
  setHighlightEnabledImpl,
  setHoveredBoxImpl,
  setHoveredRemateImpl,
  setInternalSelectionImpl,
  setOutlineTargetImpl,
  setSelectedBoxImpl,
  syncEdgeOutlineRootImpl,
} from "./ViewerCoreSelectionOps";
import type { ViewerCoreTransformOpsDeps } from "./ViewerCoreTransformOps";
import {
  applyGroupPivotTransformImpl,
  applySmartSnapForGroupImpl,
  applyTransformControlsMouseGuardImpl,
  clampGroupTransformImpl,
  clampTransformImpl,
  finishTransformDragImpl,
  handleTransformObjectChangeImpl,
  logTransformDiagnosticImpl,
  notifyGroupTransformImpl,
  refreshTransformControlsAttachmentImpl,
  setTransformAttachmentRefreshSuspendedImpl,
  setTransformModeImpl,
} from "./ViewerCoreTransformOps";
import type { ViewerCoreEventOpsDeps } from "./ViewerCoreEventOps";
import {
  getBoxIdAtPointerImpl,
  getBoxIdByMeshImpl,
  handleShiftKeyDownImpl,
  handleShiftKeyUpImpl,
} from "./ViewerCoreEventOps";
import type { ViewerCoreToolsOpsDeps } from "./ViewerCoreToolsOps";
import type { ViewerCoreRuntimeOpsDeps } from "./ViewerCoreRuntimeOps";
import {
  onBeforeRenderTickImpl,
  requestRenderImpl,
  startRuntimeImpl,
  updateCanvasSizeImpl,
} from "./ViewerCoreRuntimeOps";
import type { ViewerCoreSnappingOpsDeps } from "./ViewerCoreSnappingOps";
import {
  applyDynamicAlignSnapImpl,
  buildDisabledSmartSnapContextImpl,
  buildSmartAlignSnapContextForDragImpl,
  clearSmartAlignSnapOverlayImpl,
  clearSnapStateImpl,
  syncSmartAlignSnapOverlayFromEngineImpl,
} from "./ViewerCoreSnappingOps";
import type { ViewerCoreConstructorOpsDeps } from "./ViewerCoreConstructorOps";
import { wireViewerCoreConstructorImpl } from "./ViewerCoreConstructorOps";
import type { ViewerCoreEngineApisOpsDeps } from "./ViewerCoreEngineApisOps";
import {
  buildEventEngineApiImpl,
  buildToolsEngineApiImpl,
  getDisplayEngineApiImpl,
  getFinishOpsDepsImpl,
  getIndustrialEngineApiImpl,
  getRoomEngineApiImpl,
  getRuntimeOpsDepsImpl,
  getSelectionEngineApiImpl,
  getSnappingOpsDepsImpl,
  getTransformOpsDepsImpl,
  getEventOpsDepsImpl,
  getToolsOpsDepsImpl,
} from "./ViewerCoreEngineApisOps";
import type { ViewerCoreFinishOpsDeps } from "./ViewerCoreFinishOps";
import {
  applyRemateKeyboardTransformImpl,
  bindDivSepBridgeImpl,
  bindHematiBridgeImpl,
  bindOrlaBridgeImpl,
  bindRemateBridgeImpl,
  bindRodapeBridgeImpl,
  getDivSepMeshImpl,
  getHematiMeshImpl,
  getRemateMeshImpl,
  getRodapeMeshImpl,
  selectDivSepImpl,
  selectHematiImpl,
  selectRemateImpl,
  selectRodapeImpl,
  syncHematiVisualsImpl,
  syncOrlaForBoxImpl,
  syncOrlaVisualsImpl,
  syncRemateForBoxImpl,
  syncRemateVisualsImpl,
  syncRodapeVisualsImpl,
} from "./ViewerCoreFinishOps";
import type { RoomConfig, DoorWindowConfig } from "../room/types";
import {
  RoomManager,
  type RoomBounds,
  type WallEntryForViewer,
} from "../room/RoomManager";
import type {
  UltraPerformanceModeOptions,
  ViewerBackgroundMode,
  ViewerMaterialQuality,
  ViewerMousePreset,
  ViewerRenderOptions,
  ViewerRenderResult,
} from "../../context/projectTypes";
import { ProjectLoader } from "../../core/viewer/formats/ProjectLoader";
import type { ProjectLoadInput, ProjectLoadResult } from "../../core/viewer/formats/normalizedProject";
import type { ProjectRoomUtility, RoomFloorMode } from "./room/roomEngineTypes";
import { devLogger } from "../../utils/devLogger";
import { WallGizmo } from "../gizmos/WallGizmo";
import type { SnapDebugData } from "../snapping/ModelWallSnap";
import { SnapDebugOverlay } from "../../debug/SnapDebugOverlay";
import { ViewerRenderExporter } from "./export/ViewerRenderExporter";
import { TransformConstraints } from "./constraints/TransformConstraints";
import { SnapEngine, type SnapAlignTarget } from "./snapping/SnapEngine";
import { applyFinishMovementConstraints } from "./constraints/finishCollision";
import { MeasurementEngine } from "./measurement/MeasurementEngine";
import type { RulerMeasurementHit, UnifiedMeasurement } from "./measurement/unifiedMeasurementTypes";
import type { InternalRulerFacade } from "./measurement/internalRulerFacade";
import type { InternalCavityMeasurements } from "./measurement/internalRulerOverlayTypes";
import { computeInternalCavityMeasurements } from "./selection/boxCavityBounds";
import {
  computeDistanceToFloor as computeParametricDistanceToFloor,
  computeDistanceToNearestBox as computeParametricDistanceToNearestBox,
  computeDistanceToNearestWall as computeParametricDistanceToNearestWall,
} from "./measurement/parametricRulerDistances";
import { pickMeasurementSnap } from "./measurement/measurementSnapService";
import {
  createMeasurementAnchorFromSnap,
  createMeasurementAnchorFromWorldHit,
  syncMeasurementAnchorsToVisualizer,
} from "./measurement/measurementAnchorsBridge";
import {
  type InternalSelectionOutline,
  type InternalSelectionHit,
  type InternalSelectionState,
  cloneInternalSelectionState,
} from "./selection";
import type { MultiSelectionOutline } from "./selection/MultiSelectionOutline";
import { MeasurementAnchorsVisualizer } from "./measurement/MeasurementAnchorsVisualizer";
import type { MeasurementAnchorEntry } from "../../core/viewer/measurementAnchors";
import { SmartSnapping } from "./snapping/SmartSnapping";
import type { SnappingFacade } from "./snapping/snappingFacade";
import { RemateSmartSnapping } from "./snapping/RemateSmartSnapping";
import { SmartAlignSnapOverlay } from "./snapping/smartAlignSnapOverlay";
import { SmartAlignSnapEngine } from "./snapping/SmartAlignSnapEngine";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import type { AutoLayoutBridge, AutoLayoutOpeningMm, AutoLayoutRoomBoundsMm, AutoStackShelvesOptions } from "./autoLayout/autoLayoutTypes";
import { LayoutEngine } from "./layout/LayoutEngine";
import { buildPredictiveLayoutResult } from "./snapping/predictiveLayoutEngine";
import type { IntelligentDesignerEngine } from "./snapping/intelligentDesignerEngine";
import { ConversationalDesignerEngine } from "./snapping/conversationalDesignerEngine";
import { DesignConversationState } from "./snapping/designConversationState";
import type { ConversationTurnResult } from "./snapping/conversationalDesignerEngine";
import type { ConversationEntry } from "./snapping/designConversationState";
import type { DesignVariantId, EnvironmentStyleId } from "./snapping/intelligentDesignerTypes";
import { isEnvironmentStyleId } from "./snapping/styleProfileEngine";
import { ManufacturingReportEngine } from "./snapping/manufacturingReportEngine";
import type { ManufacturingFullReport, ManufacturingUiReport } from "./snapping/manufacturingTypes";
import { CostReportEngine } from "./snapping/costReportEngine";
import type { CostChangeInput, CostFullReport, CostUiSummary, CostSuggestion } from "./snapping/costTypes";
import type { SmartLayoutBridge } from "./snapping/smartLayoutTypes";
import { OrlaVisualizer, type OrlaVisualBridge } from "./orla/OrlaVisualizer";
import { RematePieceVisualizer, type RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import { TampoPieceVisualizer } from "./remate/TampoPieceVisualizer";
import {
  listRemateIdsInSameLComposite,
  resolveRemateTransformRoot,
} from "./remate/remateLCompositeVisual";
import { isLRematePiece } from "../../core/remate/remateLGeometry";
import { isTampoAngularConfig } from "../../core/remate/tampoAngle";
import { HematiVisualizer, type HematiVisualBridge } from "./hemati/HematiVisualizer";
import { RodapeVisualizer, type RodapeVisualBridge } from "./rodape/RodapeVisualizer";
import { ViewerPanelVisibility } from "./panels/ViewerPanelVisibility";
import { IndustrialDesignViewerOverlay } from "./overlays/IndustrialDesignViewerOverlay";
import { IndustrialDesignWorkspaceMode } from "./modes/IndustrialDesignWorkspaceMode";
import type { HoleTypeId } from "../../core/drill/holeCatalog";
import type { DesignDrillHole, IndustrialDesignBox } from "../../core/industrialDesigner/types";
import type { DesignValidationIssue } from "../../core/industrialDesigner/geometryValidation";
import { DesignValidationError } from "../../core/industrialDesigner/geometryValidation";
import { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
import { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import type { ViewerVisualFacade } from "./overlays/viewerVisualFacades";
import { PointerPickingFacade } from "./input/PointerPickingFacade";
import {
  type AlignmentType,
  type AlignableObject,
} from "./commands/alignmentCommands";
import {
  type BoxBoundsInput,
  type DimensionOverlayDataEntry,
  type PrintReadyDimensions,
} from "./overlays/boxDimensionsOverlay";
import { DimensionsOverlayController } from "./overlays/DimensionsOverlayController";
import type { SelectionOutlineController } from "./overlays/SelectionOutlineController";
import type { WallSelectionOutlineController } from "./overlays/WallSelectionOutlineController";
import { ViewerBoundsCache } from "./cache/ViewerBoundsCache";
import type { MouseMenuTarget } from "../../ui/context-menu/ContextMenuEngine";
import type { DivSepVisualBridge } from "./divSep/DivSepVisualBridge";
import {
  divisorLocalXToPositionMm,
  separadorLocalYToPositionMm,
} from "../../core/divSep/dragCoords";
import type { DivisorItem, SeparadorItem } from "../../core/divSep/types";
import type { SelectedDivSep } from "./state/ViewerState";

/**
 * ViewerCore: orquestrador do motor 3D.
 * Coordena ViewerState (seleção, hover, tool), EventsManager (canvas/pointer) e ViewerTools (TransformControls, outline, clamp).
 * Não contém lógica de eventos nem de ferramentas; delega para os módulos viewer-engine/state, events e tools.
 *
 * API multi-box: addBox, removeBox, updateBox, setBoxIndex, addModelToBox, selectBox, etc.
 */

export class ViewerCore {
  private container: HTMLElement;
  private sceneManager: SceneManager;
  private cameraManager: CameraManager;
  private rendererManager: RendererManager;
  private controls: Controls | null;
  private readonly boxManager = new ViewerBoxManager();
  private readonly boxSceneController = new BoxSceneController();
  private boxEngine: BoxEngine | null = null;
  private sceneEngine!: SceneEngine;
  private lightingEngine: LightingEngine | null = null;
  private composerEngine: ComposerEngine | null = null;
  private cameraEngine!: CameraEngine;
  private selectionEngine!: SelectionEngine;
  private readonly designerEngine = ensureViewerDesignerEngine(null);
  private viewerRoomEngine: ViewerRoomEngine | null = null;
  get boxes(): Map<string, ViewerBoxEntry> {
    return this.boxManager.getBoxes();
  }
  private materialSet: MaterialSet;
  private defaultMaterialName = "mdf_branco";
  private boxGap = 0;
  private modelCounter = 0;
  private roomBuilder: RoomBuilder;
  private roomBoxGroup: THREE.Group | null = null;
  private roomBoxWalls: Array<{ id: number; normal: THREE.Vector3; mesh: THREE.Mesh }> = [];
  private roomBoxFloor: THREE.Mesh | null = null;
  private roomBoxFloorOutline: THREE.LineLoop | null = null;
  private roomBoxCeiling: THREE.Mesh | null = null;
  private roomFloorRoot: THREE.Group | null = null;
  private roomUtilitiesRoot: THREE.Group | null = null;
  private roomBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY: number;
    maxY: number;
    centerX: number;
    centerZ: number;
  } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private readonly raycastSystem: ViewerRaycastSystem;
  private readonly pointerPicking: PointerPickingFacade;
  private readonly viewerState = new ViewerState();
  private onBoxSelected: ((_id: string | null) => void) | null = null;
  private onMultiSelectToggle: ((_encodedId: string) => void) | null = null;
  private onRemateSelected: ((_remateId: string | null) => void) | null = null;
  private onRodapeSelected: ((_rodapeId: string | null) => void) | null = null;
  private onInternalSurfaceSelected: ((_hit: InternalSelectionState) => void) | null = null;
  private onInternalEdgeSelected: ((_hit: InternalSelectionState) => void) | null = null;
  private onInternalPointSelected: ((_hit: InternalSelectionState) => void) | null = null;
  private internalSelectionOutline: InternalSelectionOutline | null = null;
  private multiSelectionOutline: MultiSelectionOutline | null = null;
  private readonly selectedBoxChangeListeners = new Set<(_id: string | null) => void>();
  private onDoorLayerDoubleClick: ((_boxId: string, _doorLayerId: string) => void) | null = null;
  private onDrawerLayerDoubleClick: ((_boxId: string, _drawerLayerId: string) => void) | null = null;
  private onDrawerLayerClick: ((_boxId: string, _drawerLayerId: string) => void) | null = null;
  private onBoxDoubleClick: ((_boxId: string) => void) | null = null;
  private onModelLoaded: ((_boxId: string, _modelId: string, _object: THREE.Object3D) => void) | null = null;
  private onBoxTransform: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotation: { x: number; y: number; z: number }) => void) | null = null;
  private onRemateTransform: ((
    _remateId: string,
    _patch: import("../../core/remate/rematePieceTypes").UpdateRematePieceInput
  ) => void) | null = null;
  private onHematiTransform: ((
    _hematiId: string,
    _patch: { transform: { xMm: number; yMm: number; zMm: number; rotacaoXRad: number; rotacaoYRad: number; rotacaoZRad: number }; placementFree: boolean }
  ) => void) | null = null;
  private onRodapeTransform: ((
    _rodapeId: string,
    _patch: import("../../core/rodape/rodapeTypes").UpdateRodapeInput
  ) => void) | null = null;
  private onDivSepTransform: ((
    _params: { boxId: string; kind: "div" | "sep"; itemId: string; positionMm: number }
  ) => void) | null = null;
  private transformControls: TransformControls | null = null;
  /** Helper (Object3D) retornado por getHelper(); é o que é adicionado à cena e tem .visible. */
  private transformControlsHelper: THREE.Object3D | null = null;
  private groupGizmo: GroupGizmo | null = null;
  private measurementAnchorsVisualizer: MeasurementAnchorsVisualizer | null = null;
  private onTransformDragStart: (() => void) | null = null;
  private onTransformDragEnd: (() => void) | null = null;
  private readonly _boundingBox = new THREE.Box3();
  private readonly _center = new THREE.Vector3();
  private readonly _size = new THREE.Vector3();
  private readonly _boxSingle = new THREE.Box3();
  private readonly _frustum = new THREE.Frustum();
  private readonly _projScreenMatrix = new THREE.Matrix4();
  private readonly isMobile: boolean;
  private onRoomElementPlaced: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null = null;
  private onRoomElementSelected: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null = null;
  private onWallSelected: ((_wallId: number | null) => void) | null = null;
  private onWallTransform: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null = null;
  private onRoomElementTransform: ((_elementId: string, _config: DoorWindowConfig) => void) | null = null;
  private onRoomUtilitySelected: ((_data: { utilityId: string; wallId: number; config: ProjectRoomUtility } | null) => void) | null = null;
  private onRoomUtilityTransform: ((_utilityId: string, _patch: Pick<ProjectRoomUtility, "positionAlongWall" | "heightMm">) => void) | null = null;
  private roomCeilingVisible = true;
  private roomFloorMode: RoomFloorMode = "room";
  private hiddenRoomWallIds = new Set<number>();
  private mouseInputPreset: MouseInputPreset = "cad";
  private backgroundMode: ViewerBackgroundMode = "studio";
  private materialQuality: ViewerMaterialQuality = "standard";
  private reflectionsEnabled = false;
  private reflectionFrameCounter = 0;
  private reflectionUpdateIntervalFrames = 24;
  private photoModeEnabled = false;
  private readonly baseToneMappingExposure: number;
  private readonly baseLightIntensities: {
    ambient: number;
    hemisphere: number;
    key: number;
    fill: number;
    rim: number;
  };

  /** Configurações de exibição expostas ao exterior (ex.: `viewerCore.display.shadowIntensity`). */
  readonly display!: {
    get shadowIntensity(): number;
    set shadowIntensity(_value: number);
  };

  // Lock: impede colisoes entre caixas e respeita os limites da sala.
  private lockEnabled = true;
  // Shift-Lock: bloqueia movimento no eixo Z quando Shift esta pressionado.
  private shiftKeyHeld = false;
  /** Z do box ao iniciar o drag (para Shift-Lock); em metros. */
  private dragStartZForShiftLock: number | undefined = undefined;
  private boundShiftKeyDown = (e: KeyboardEvent) => {
    handleShiftKeyDownImpl(this.getEventOpsDeps(), e);
  };
  private boundShiftKeyUp = (e: KeyboardEvent) => {
    handleShiftKeyUpImpl(this.getEventOpsDeps(), e);
  };
  /** Quando lock desativado: caixas que intersectam paredes (para destaque vermelho). */
  private boxesIntersectingWalls = new Set<string>();
  /** Parede escondida manualmente (se existir). */
  private manualHiddenWallId: number | null = null;

  /** Overlay unificado de medidas do conjunto de caixas (visualização apenas). */
  private dimensionsOverlay!: DimensionsOverlayController;

  private turntableEnabled = false;
  private turntableSpeed = 0.15;
  private lights: Lights;
  /** Grupo com um wireframe L×A×P de layout (contorno azul de seleção). */
  private selectionOutline!: SelectionOutlineController;
  private readonly pendingViewerVisualSync = createFinishSyncFlags();
  private readonly pendingBoxStructureUpdates = new Map<string, Partial<BoxOptions>>();
  /** Contexto transitório para sync de frentes independentes durante updateBox(materialName).
   * frenteFixaMaterialId: string = override; null = seguir corpo; undefined = preservar mesh/entry.
   */
  private readonly pendingMaterialSyncContext = new Map<
    string,
    { drawerLayerItems?: DrawerLayerItem[]; frenteFixaMaterialId?: string | null }
  >();
  /** Outline da parede selecionada (Room Box). */
  private wallSelectionOutline!: WallSelectionOutlineController;
  /** Highlight por mesh (hover + seleção): portas, gavetas, painéis, furos. Só ativo quando highlightEnabled. */
  private highlightManager: HighlightManager | null = null;
  /** Outline global e isolado: apenas visual, usado para mostrar arestas das peças. */
  private edgeOutlineSystem: EdgeOutlineSystem | null = null;
  /** Gizmo para mover e rotacionar paredes (handles X/Z e rotação). */
  private wallGizmo: WallGizmo | null = null;
  private transformDiagnosticsEnabled = false;
  /** Quando true, permite logs de debug (ex.: getBoxIdAtPointer). Ativar manualmente para diagnóstico. */
  private debugMode = false;
  private eventsManager: EventsManager | null = null;
  private readonly viewerTools = new ViewerTools(() => this.getToolsEngineApi());
  private readonly gizmoEngine = createViewerGizmoEngine(this.viewerTools);

  /** Vista escolhida pelo utilizador (Selecionar Vista). Quando definida, updateCameraTarget/ToBox só atualizam o alvo, não a orientação. */
  private get cameraViewPreset() {
    return this.cameraEngine?.preset ?? null;
  }
  private set cameraViewPreset(value: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric" | null) {
    if (!this.cameraEngine) return;
    if (value == null) this.cameraEngine.clearPreset();
    else this.cameraEngine.preset = value;
  }

  /** Gestor da sala única (4 paredes principais + extras + piso + lock). */
  private roomManager: RoomManager | null = null;
  /** Snapshot/restore da câmera. */
  private snapshotRenderer: SnapshotRenderer | null = null;
  /** Overlay de debug do snapping (somente DEV). */
  private snapDebugOverlay: SnapDebugOverlay | null = null;
  private lastSnapDebugData: SnapDebugData | null = null;
  private ultraPerformanceMode = false;
  private ultraPerformanceModeOptions: UltraPerformanceModeOptions = {
    enabled: false,
    mode: "balanced",
  };
  private defaultPixelRatio: number;
  private defaultGroundSize: number;
  private ultraRenderState: {
    materialQuality: ViewerMaterialQuality;
    reflectionsEnabled: boolean;
    toneMappingExposure: number;
    } | null = null;
  private materialPipeline!: MaterialPipelineFacade;
  private displayMaterials!: DisplayMaterialController;
  private ultraMaterials!: UltraMaterialController;
  /** Intensidade de brilho visual (1 = preset original, 0 = fosco). Só afeta exibição. */
  private glossIntensity = 1;
  /** Modo fosco: sobrepõe gloss e clearcoat, envMapIntensity → 0. Reversível. */
  private matteMode = false;
  private _diagnosticsLogged = false;
  /** Evita aplicar rotação duplicada no mesmo mesh. */
  private appliedRotationByMeshUuid = new Map<string, number>();
  /** Diagnóstico DEV: contadores por mesh.uuid. */
  private rotationDiagnosticsByUuid = new Map<string, { applied: number; duplicateSkipped: number }>();
  private rotationDiagnosticsLastLogTs = 0;
  private renderExporter!: ViewerRenderExporter;
  private constraints!: TransformConstraints;
  private snapEngine!: SnapEngine;
  private readonly projectLoader = new ProjectLoader();
  /**
   * Fronteiras de integração extraídas do core:
   * - measurementEngine: régua unificada (único motor de medição).
   * - panelVisibility: visibilidade de painéis, contornos e exploded view.
   * - runtimeLoop: cadência de frame, resize e pipeline de render.
   * O ViewerCore permanece como orquestrador e ponto único de composição.
   */
  private measurementEngine!: MeasurementEngine;
  private getProjectMeasurementsFn: () => UnifiedMeasurement[] = () => [];
  private onInternalMeasurementSavedFn: (_entry: UnifiedMeasurement) => void = () => {};
  private smartSnappingEngine!: SmartSnapping;
  private remateSmartSnapping!: RemateSmartSnapping;
  private smartAlignSnapOverlay!: SmartAlignSnapOverlay;
  private smartAlignSnapEngine!: SmartAlignSnapEngine;
  private smartAlignOverlay!: SmartAlignOverlayFacade;
  private unregisterAdminSnappingRules: (() => void) | null = null;
  readonly settings = {
    enableSmartAlignSnap: true,
  };
  private layoutEngine!: LayoutEngine;
  private smartLayoutBridge: SmartLayoutBridge | null = null;
  private readonly designConversationState = new DesignConversationState();
  private conversationalDesignerEngine: ConversationalDesignerEngine | null = null;
  private manufacturingReportEngine: ManufacturingReportEngine | null = null;
  private costReportEngine: CostReportEngine | null = null;
  private orlaVisualizer = new OrlaVisualizer();
  private remateVisualizer = new RematePieceVisualizer();
  private tampoVisualizer = new TampoPieceVisualizer();
  private remateVisualBridge: RematePieceVisualBridge | null = null;
  private divSepVisualBridge: DivSepVisualBridge | null = null;
  private rodapeVisualBridge: RodapeVisualBridge | null = null;
  private hematiVisualizer = new HematiVisualizer();
  private rodapeVisualizer = new RodapeVisualizer();
  private readonly overlayCoordinator = new ViewerOverlayCoordinator();
  private readonly boundsCache = new ViewerBoundsCache();
  private unregisterWindowEvents: (() => void) | null = null;
  /** Evita processar fim de drag duas vezes (mouseUp + dragging-changed). */
  private transformDragEndStamp = -1;
  /** Evita reentrância objectChange → clampTransform → mover mesh → objectChange. */
  private isApplyingTransformConstraints = false;
  readonly internalRuler: InternalRulerFacade;
  readonly snapping: SnappingFacade;
  readonly autoLayout: {
    fillWallWithModule: (_wallId: string | number, _moduleBoxId: string) => boolean;
    extendAlongWallFromBox: (_boxId: string) => boolean;
    distributeBoxesEvenly: (_boxIds: string[]) => boolean;
    autoStackShelvesInBox: (_boxId: string, _options: AutoStackShelvesOptions) => boolean;
  };
  readonly smartLayout: {
    autoWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
    previewAutoWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
    autoRoomFill: (_seedBoxId?: string) => boolean;
    autoDistribute: (_boxIds: string[]) => boolean;
    autoStackShelves: (_boxId: string, _options: AutoStackShelvesOptions) => boolean;
    applyPredictiveLayout: () => boolean;
    rejectPredictiveLayout: () => void;
    hasPredictiveLayout: () => boolean;
  };
  readonly intelligentDesigner: {
    generateDesigns: (_seedBoxId: string) => boolean;
    generateVariations: () => boolean;
    previewDesign: (_id: DesignVariantId) => boolean;
    applyDesign: (_id: DesignVariantId) => boolean;
    refineLayout: () => boolean;
    learnPreferences: () => string;
    explainDecision: (_id?: DesignVariantId) => string;
    previewStyle: (_styleId: EnvironmentStyleId, _seedBoxId: string) => boolean;
    applyStyle: (_styleId: EnvironmentStyleId, _seedBoxId: string) => boolean;
    explainStyle: (_styleId?: EnvironmentStyleId) => string;
    listStyles: () => Array<{ id: EnvironmentStyleId; label: string }>;
  };
  readonly conversationalDesigner: {
    sendMessage: (_text: string, _seedBoxId: string) => ConversationTurnResult;
    quickAction: (
      _action: "moreSpace" | "moreSymmetry" | "minimal" | "optimizeWall" | "variations",
      _seedBoxId: string
    ) => ConversationTurnResult;
    getHistory: () => ConversationEntry[];
    explain: () => string;
  };
  readonly manufacturing: {
    generateReport: () => ManufacturingFullReport;
    getReport: () => ManufacturingUiReport;
    autoFix: () => { ok: boolean; message: string; score: number };
    score: () => number;
    previewFixes: () => boolean;
    applySuggestedFixes: () => boolean;
  };
  readonly costEstimator: {
    generateCostReport: (_seedBoxId?: string) => CostFullReport;
    summarizeForUI: (_seedBoxId?: string) => CostUiSummary;
    score: () => number;
    compareDesigns: (_seedBoxId: string) => import("./snapping/costTypes").CostDesignComparison;
    compareStyles: () => import("./snapping/costTypes").CostStyleComparison;
    estimateChangeImpact: (_change: CostChangeInput) => import("./snapping/costTypes").CostImpactEstimate;
    suggestCheaper: (_seedBoxId: string) => boolean;
    suggestPremium: (_seedBoxId: string) => boolean;
    suggestBalanced: (_seedBoxId: string) => boolean;
  };
  readonly orlaVisual: ViewerVisualFacade;
  readonly remateVisual: ViewerVisualFacade;
  readonly hematiVisual: ViewerVisualFacade;
  readonly rodapeVisual: ViewerVisualFacade;
  private panelVisibility!: ViewerPanelVisibility;
  private readonly industrialDesignViewerOverlay = new IndustrialDesignViewerOverlay();
  private readonly industrialDesignMode: IndustrialDesignWorkspaceMode;
  private viewerReadyFlag = false;
  private readonly viewerReadyCallbacks: Array<() => void> = [];
  private runtimeLoop!: ViewerRuntimeLoop;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    wireViewerCoreConstructorImpl(this.getConstructorOpsDeps(), container, options);
  }

  private getEngineApisOpsDeps(): ViewerCoreEngineApisOpsDeps {
    // Mantém a superfície privada alcançável para as Engine APIs extraídas (TS6133).
    void this.roomBoxGroup;
    void this.roomBoxFloor;
    void this.roomBoxFloorOutline;
    void this.roomBoxCeiling;
    void this.roomFloorRoot;
    void this.roomUtilitiesRoot;
    void this.raycaster;
    void this.pointer;
    void this.onBoxSelected;
    void this.onMultiSelectToggle;
    void this.onRemateSelected;
    void this.onRodapeSelected;
    void this.onInternalSurfaceSelected;
    void this.onInternalEdgeSelected;
    void this.onInternalPointSelected;
    void this.internalSelectionOutline;
    void this.multiSelectionOutline;
    void this.onDoorLayerDoubleClick;
    void this.onDrawerLayerDoubleClick;
    void this.onDrawerLayerClick;
    void this.onBoxDoubleClick;
    void this.groupGizmo;
    void this.onTransformDragEnd;
    void this.isMobile;
    void this.onRoomElementPlaced;
    void this.onRoomElementSelected;
    void this.onWallSelected;
    void this.onWallTransform;
    void this.onRoomElementTransform;
    void this.onRoomUtilitySelected;
    void this.onRoomUtilityTransform;
    void this.roomCeilingVisible;
    void this.roomFloorMode;
    void this.hiddenRoomWallIds;
    void this.backgroundMode;
    void this.reflectionsEnabled;
    void this.reflectionFrameCounter;
    void this.reflectionUpdateIntervalFrames;
    void this.photoModeEnabled;
    void this.baseToneMappingExposure;
    void this.shiftKeyHeld;
    void this.dragStartZForShiftLock;
    void this.manualHiddenWallId;
    void this.turntableEnabled;
    void this.wallSelectionOutline;
    void this.highlightManager;
    void this.edgeOutlineSystem;
    void this.transformDiagnosticsEnabled;
    void this.ultraPerformanceMode;
    void this.ultraPerformanceModeOptions;
    void this.ultraRenderState;
    void this.materialQuality;
    void this.matteMode;
    void this.glossIntensity;
    void this.defaultPixelRatio;
    void this.boxesIntersectingWalls;
    void this.transformControlsHelper;
    void this.mouseInputPreset;
    void this._diagnosticsLogged;
    void this.industrialDesignCallbacks;
    void this.divSepVisualBridge;
    void this.isApplyingTransformConstraints;
    void this.transformDragEndStamp;
    void this.settings;
    void this.boxSceneController;
    void this.panelVisibility;
    void this.industrialDesignViewerOverlay;
    void this.displayMaterials;
    void this.ultraMaterials;
    void this.pendingViewerVisualSync;
    void this.constraints;
    void this.snapEngine;
    void this.remateSmartSnapping;
    void this.smartAlignSnapEngine;
    void this.overlayCoordinator;
    void this.gizmoEngine;
    void this.selectedBoxChangeListeners;
    void this.lockEnabled;
    void this.roomManager;
    void this.defaultGroundSize;
    void this.boundsCache;
    void this.snapDebugOverlay;
    void this.lastSnapDebugData;
    void this.runtimeLoop;
    void this.smartAlignOverlay;
    void this.industrialDesignMode;
    void this.ensureLightingEngine;
    void this.lerpLightsToTarget;
    void this.updateDimensionsOverlay;
    void this.updateReflectionProbe;
    void this.setTransformAttachmentRefreshSuspended;
    void this.flushDeferredBoxStructureUpdates;
    void this.flushDeferredViewerVisualSyncs;
    void this.getToolsOpsDeps;
    void this.setOutlineTarget;
    void this.notifyHematiTransform;
    void this.notifyDivSepTransform;
    void this.applyDynamicAlignSnap;
    void this.clampTransform;
    void this.updateWallVisibilityBasedOnCamera;
    void this.getRoomOpeningsForSnapping;
    void this.notifyWallTransform;
    void this.notifyRoomElementTransform;
    void this.notifyRoomUtilityTransform;
    void this.getRoomUtilityById;
    void this.setHoveredBox;
    void this.setHoveredRemate;
    return this as unknown as ViewerCoreEngineApisOpsDeps;
  }

  private getConstructorOpsDeps(): ViewerCoreConstructorOpsDeps {
    // Mantém a superfície privada alcançável para o wiring extraído (TS6133 / ownership).
    void this.raycastSystem;
    void this.onTransformDragStart;
    void this.boundShiftKeyDown;
    void this.boundShiftKeyUp;
    void this.turntableSpeed;
    void this.debugMode;
    void this.getProjectMeasurementsFn;
    void this.onInternalMeasurementSavedFn;
    void this.smartAlignSnapOverlay;
    void this.ensureConversationalDesignerEngine;
    void this.notifyViewerReady;
    void this.notifyAlignableTransform;
    void this.collectBoxBoundsForDimensions;
    void this.getEventEngineApi;
    void this.handleTransformObjectChange;
    void this.finishTransformDrag;
    void this.buildSmartAlignSnapContextForDrag;
    void this.syncSmartAlignSnapOverlayFromEngine;
    void this.buildDisabledSmartSnapContext;
    void this.generateIntelligentDesigns;
    void this.previewIntelligentDesign;
    void this.applyIntelligentDesign;
    void this.previewIntelligentStyle;
    void this.applyIntelligentStyle;
    void this.previewCostSuggestionByTier;
    void this.applyManufacturingSuggestedFixes;
    void this.generateIntelligentVariations;
    void this.computeDistanceToNearestBox;
    void this.computeDistanceToNearestWall;
    void this.computeDistanceToFloor;
    void this.start;
    void this.onBeforeRenderTick;
    void this.previewManufacturingFixes;
    void this.acceptPredictiveLayoutPending;
    void this.previewSmartWallFill;
    void this.updateCameraTarget;
    void this.updateCanvasSize;
    void this.applyMousePresetToControls;
    void this.applyBackgroundMode;
    void this.getSelectionOpsDeps;
    void this.getIndustrialModeDeps;
    void this.getRoomGeometryDeps;
    void this.getSelectedObjects;
    void this.projectWorldToScreen;
    void this.setWallEditMode;
    void this.ensureComposerEngine;
    void this.ensureIntelligentDesigner;
    void this.ensureManufacturingReportEngine;
    void this.ensureCostReportEngine;
    void this.getRemateMesh;
    void this.getDivSepMesh;
    void this.logTransformDiagnostic;
    void this.clearSmartAlignSnapOverlay;
    void this.syncOrlaVisuals;
    void this.syncRemateVisuals;
    void this.syncHematiVisuals;
    void this.syncRodapeVisuals;
    void this.updateShadowIntensity;
    return this as unknown as ViewerCoreConstructorOpsDeps;
  }

  getCurrentMode(): "performance" | "showcase" {
    return getCurrentModeImpl(this.getDisplayOpsDeps());
  }

  private ensureLightingEngine(): LightingEngine {
    const engine = ensureViewerLightingEngine(this.lightingEngine, this.lights, this.baseLightIntensities);
    this.lightingEngine = engine;
    return engine;
  }

  private ensureComposerEngine(): ComposerEngine {
    const engine = ensureViewerComposerEngine(this.composerEngine, {
      getRenderer: () => this.rendererManager.renderer,
      getScene: () => this.sceneManager.scene,
      getCamera: () => this.cameraManager.camera,
      getContainer: () => this.container,
    });
    this.composerEngine = engine;
    return engine;
  }

  private ensureBoxEngine(): BoxEngine {
    const engine = ensureViewerBoxEngine(this.boxEngine, this.boxSceneController);
    this.boxEngine = engine;
    return engine;
  }

  private ensureViewerRoomEngine(): ViewerRoomEngine {
    const engine = ensureViewerRoomEngineFactory(this.viewerRoomEngine, () => this.roomManager);
    this.viewerRoomEngine = engine;
    return engine;
  }

  private ensureIntelligentDesigner(): IntelligentDesignerEngine {
    return this.designerEngine.ensure({
      getBridge: () => this.smartLayoutBridge,
      getRoomLabelHint: () => this.smartLayoutBridge?.getRoomLabelHint?.(),
    });
  }

  private ensureManufacturingReportEngine(): ManufacturingReportEngine {
    const engine = ManufacturingReportEngine.ensure(this.manufacturingReportEngine, {
      getContext: () => this.buildManufacturingScanContext(),
      applyPlan: (plan) => {
        this.smartLayoutBridge?.applyPlan(plan);
      },
      distribute: (boxIds) => this.layoutEngine.autoDistribute(boxIds),
      isSmartSnapEnabled: () => false,
    });
    this.manufacturingReportEngine = engine;
    return engine;
  }

  private ensureCostReportEngine(): CostReportEngine {
    const engine = CostReportEngine.ensure(this.costReportEngine, {
      getContext: () => this.buildCostScanContext(),
      getDesigner: () => this.ensureIntelligentDesigner(),
      getSeedBoxId: () => this.resolveCostSeedBoxId(),
    });
    this.costReportEngine = engine;
    return engine;
  }

  private ensureConversationalDesignerEngine(): ConversationalDesignerEngine {
    const engine = ConversationalDesignerEngine.ensure(
      this.conversationalDesignerEngine,
      {
        designer: this.ensureIntelligentDesigner(),
        conversation: this.designConversationState,
        previewPlan: (plan, label, previewId) => {
          const { overlay } = buildPredictiveLayoutResult(this.layoutEngine.predictive, plan, label);
          this.layoutEngine.predictive.previewDesigns([{ id: previewId, plan, label }]);
          this.smartAlignOverlay.setState(overlay);
        },
        applyPlan: (plan, meta) => {
          const ok = this.ensureIntelligentDesigner().applyPlanDirect(plan, {
            designId: meta.designId,
            variationKind: meta.variationKind,
          });
          if (ok) {
            this.designConversationState.recordApplied({
              plan,
              label: meta.label,
              designId: meta.designId,
              variationKind: meta.variationKind,
            });
            this.clearSmartAlignSnapOverlay();
          }
          return ok;
        },
        acceptPending: () => this.acceptConversationalPending(),
        rejectPending: () => {
          this.layoutEngine.predictive.rejectPending();
          this.designConversationState.clearPending();
          this.clearSmartAlignSnapOverlay();
        },
        optimizeWallPreview: (wallId, seedBoxId) => this.previewSmartWallFill(wallId, seedBoxId),
        getManufacturingReport: () => this.ensureManufacturingReportEngine().generateReport(),
        previewManufacturingFixes: () => this.previewManufacturingFixes(),
        applyManufacturingFixes: () => {
          const result = this.ensureManufacturingReportEngine().autoFix();
          return { ok: result.ok, message: result.message };
        },
        getCostReport: (seedBoxId) => {
          this.designConversationState.setSeedBoxId(seedBoxId);
          return this.ensureCostReportEngine().generateCostReport();
        },
        previewCostSuggestion: (suggestion) => this.previewCostSuggestion(suggestion),
        buildCostSuggestion: (tier, seedBoxId, reducePercent) => {
          this.designConversationState.setSeedBoxId(seedBoxId);
          this.ensureCostReportEngine().scanProject();
          if (tier === "cheaper") {
            return reducePercent != null
              ? this.ensureCostReportEngine().suggestReduceCostPercent(reducePercent)
              : this.ensureCostReportEngine().suggestCheaperAlternative();
          }
          if (tier === "premium") return this.ensureCostReportEngine().suggestPremiumAlternative();
          return this.ensureCostReportEngine().suggestBalancedAlternative();
        },
      }
    );
    this.conversationalDesignerEngine = engine;
    return engine;
  }

  /** True após inicialização completa (eventos, loop, boxes). Único sinal para expor a API pública. */
  get viewerReady(): boolean {
    return this.viewerReadyFlag;
  }

  /**
   * Regista callback para quando o viewer está pronto.
   * Workspace deve chamar `setActiveViewerCore` (e a ponte `window.viewerCore`) só neste callback.
   */
  setOnViewerReady(callback: (() => void) | null): void {
    if (!callback) return;
    if (this.viewerReadyFlag) {
      callback();
      return;
    }
    this.viewerReadyCallbacks.push(callback);
  }

  private notifyViewerReady(): void {
    if (this.viewerReadyFlag) return;
    this.viewerReadyFlag = true;
    const pending = this.viewerReadyCallbacks.splice(0);
    for (const callback of pending) {
      try {
        callback();
      } catch (err) {
        devLogger.error("[ViewerCore] setOnViewerReady callback failed", err);
      }
    }
  }

  bindInternalMeasurementBridge(
    getMeasurements: () => UnifiedMeasurement[],
    onSaved: (_entry: UnifiedMeasurement) => void
  ): void {
    this.getProjectMeasurementsFn = getMeasurements;
    this.onInternalMeasurementSavedFn = onSaved;
    this.measurementEngine.syncFromProject(getMeasurements());
  }

  bindAutoLayoutBridge(
    bridge: Pick<AutoLayoutBridge, "getWorkspaceBoxes" | "applyPlan"> & {
      runProjectRoomFill?: () => boolean;
      getRoomLabelHint?: () => string | undefined;
    }
  ): void {
    this.smartLayoutBridge = {
      getWorkspaceBoxes: bridge.getWorkspaceBoxes,
      applyPlan: bridge.applyPlan,
      getRoomBoundsMm: () => this.getRoomBoundsMmForAutoLayout(),
      getOpeningsMm: () => this.getRoomOpeningsMmForAutoLayout(),
      getWallOffsetMm: () => this.smartSnappingEngine.getWallOffset(),
      runProjectRoomFill: bridge.runProjectRoomFill,
      getRoomLabelHint: bridge.getRoomLabelHint,
    };
    this.layoutEngine.bindBridge(this.smartLayoutBridge);
  }

  bindOrlaBridge(bridge: Pick<OrlaVisualBridge, "getBoxOrlaConfig"> | null): void {
    bindOrlaBridgeImpl(this.getFinishOpsDeps(), bridge);
  }

  syncOrlaVisuals(): void {
    syncOrlaVisualsImpl(this.getFinishOpsDeps());
  }

  private syncOrlaForBox(boxId: string): void {
    syncOrlaForBoxImpl(this.getFinishOpsDeps(), boxId);
  }

  bindRemateBridge(bridge: RematePieceVisualBridge | null): void {
    bindRemateBridgeImpl(this.getFinishOpsDeps(), bridge);
  }

  /** Sync visual de remates — aplica apenas transform guardado no estado (sem re-snap à caixa). */
  syncRemateVisuals(): void {
    syncRemateVisualsImpl(this.getFinishOpsDeps());
  }

  private syncRemateForBox(_boxId: string): void {
    syncRemateForBoxImpl(this.getFinishOpsDeps(), _boxId);
  }

  getRemateMesh(remateId: string): THREE.Object3D | null {
    return getRemateMeshImpl(this.getFinishOpsDeps(), remateId);
  }

  /**
   * Nudge de remate via teclado — opera no root de transform (grupo L CIMA composite quando aplicável),
   * propaga via notifyRemateTransform (mesmo pipeline do gizmo).
   */
  applyRemateKeyboardTransform(
    remateId: string,
    key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
    options?: { stepMm?: number; stepDeg?: number; shiftKey?: boolean }
  ): boolean {
    return applyRemateKeyboardTransformImpl(this.getFinishOpsDeps(), remateId, key, options);
  }

  selectRemate(remateId: string | null): void {
    selectRemateImpl(this.getFinishOpsDeps(), remateId);
  }

  setOnRemateTransform(
    callback: ((
      _remateId: string,
      _patch: import("../../core/remate/rematePieceTypes").UpdateRematePieceInput
    ) => void) | null
  ): void {
    this.onRemateTransform = callback;
  }

  bindDivSepBridge(bridge: DivSepVisualBridge | null): void {
    bindDivSepBridgeImpl(this.getFinishOpsDeps(), bridge);
  }

  setOnDivSepTransform(
    callback: ((
      _params: { boxId: string; kind: "div" | "sep"; itemId: string; positionMm: number }
    ) => void) | null
  ): void {
    this.onDivSepTransform = callback;
  }

  getDivSepMesh(selection: SelectedDivSep): THREE.Object3D | null {
    return getDivSepMeshImpl(this.getFinishOpsDeps(), selection);
  }

  getDivSepHitAtPointer(event: { clientX: number; clientY: number }): SelectedDivSep | null {
    return this.pointerPicking.getDivSepHitAtPointer(event);
  }

  selectDivSep(selection: SelectedDivSep | null): void {
    selectDivSepImpl(this.getFinishOpsDeps(), selection);
  }

  setOnRemateSelected(callback: ((_remateId: string | null) => void) | null): void {
    this.onRemateSelected = callback;
  }

  setOnRodapeSelected(callback: ((_rodapeId: string | null) => void) | null): void {
    this.onRodapeSelected = callback;
  }

  bindHematiBridge(bridge: HematiVisualBridge | null): void {
    bindHematiBridgeImpl(this.getFinishOpsDeps(), bridge);
  }

  syncHematiVisuals(): void {
    syncHematiVisualsImpl(this.getFinishOpsDeps());
  }

  bindRodapeBridge(bridge: RodapeVisualBridge | null): void {
    bindRodapeBridgeImpl(this.getFinishOpsDeps(), bridge);
  }

  /** Sync visual de rodapés — aplica apenas transform guardado no estado (sem re-snap à caixa). */
  syncRodapeVisuals(): void {
    syncRodapeVisualsImpl(this.getFinishOpsDeps());
  }

  getHematiMesh(hematiId: string): THREE.Object3D | null {
    return getHematiMeshImpl(this.getFinishOpsDeps(), hematiId);
  }

  getRodapeMesh(rodapeId: string): THREE.Object3D | null {
    return getRodapeMeshImpl(this.getFinishOpsDeps(), rodapeId);
  }

  getHematiIdAtPointer(event: { clientX: number; clientY: number }): string | null {
    return this.pointerPicking.getHematiIdAtPointer(event);
  }

  getRodapeIdAtPointer(event: { clientX: number; clientY: number }): string | null {
    return this.pointerPicking.getRodapeIdAtPointer(event);
  }

  selectHemati(hematiId: string | null): void {
    selectHematiImpl(this.getFinishOpsDeps(), hematiId);
  }

  selectRodape(rodapeId: string | null): void {
    selectRodapeImpl(this.getFinishOpsDeps(), rodapeId);
  }

  setOnHematiTransform(
    callback: ((
      _hematiId: string,
      _patch: { transform: { xMm: number; yMm: number; zMm: number; rotacaoXRad: number; rotacaoYRad: number; rotacaoZRad: number }; placementFree: boolean }
    ) => void) | null
  ): void {
    this.onHematiTransform = callback;
  }

  setOnRodapeTransform(
    callback: ((
      _rodapeId: string,
      _patch: { transform: { xMm: number; yMm: number; zMm: number; rotacaoXRad: number; rotacaoYRad: number; rotacaoZRad: number }; placementFree: boolean }
    ) => void) | null
  ): void {
    this.onRodapeTransform = callback;
  }

  private getRoomBoundsMmForAutoLayout(): AutoLayoutRoomBoundsMm | null {
    return getRoomBoundsMmForAutoLayoutImpl(this.getRoomUtilsDeps());
  }

  private getRoomOpeningsMmForAutoLayout(): AutoLayoutOpeningMm[] {
    return getRoomOpeningsMmForAutoLayoutImpl(this.getRoomUtilsDeps());
  }

  setMode(mode: "performance" | "showcase", turntable = false): void {
    setModeImpl(this.getDisplayOpsDeps(), mode, turntable);
  }

  setShowcaseMode(active: boolean, turntable = false): void {
    setShowcaseModeImpl(this.getDisplayOpsDeps(), active, turntable);
  }

  getShowcaseMode(): boolean {
    return getShowcaseModeImpl(this.getDisplayOpsDeps());
  }

  setGlobalLightIntensity(value: number): void {
    setGlobalLightIntensityImpl(this.getDisplayOpsDeps(), value);
  }

  getGlobalLightIntensity(): number {
    return getGlobalLightIntensityImpl(this.getDisplayOpsDeps());
  }

  setShadowIntensity(value: number): void {
    updateShadowIntensityImpl(this.getDisplayOpsDeps(), value);
  }

  getShadowIntensity(): number {
    return getShadowIntensityImpl(this.getDisplayOpsDeps());
  }

  /**
   * Aplica intensidade das sombras na luz principal (Three.js `shadow.intensity`) e agenda render.
   */
  updateShadowIntensity(value: number): void {
    updateShadowIntensityImpl(this.getDisplayOpsDeps(), value);
  }

  setUltraPerformanceMode(active: boolean): void {
    setUltraPerformanceModeImpl(this.getDisplayOpsDeps(), active);
  }

  setUltraPerformanceModeOptions(options: UltraPerformanceModeOptions): void {
    setUltraPerformanceModeOptionsImpl(this.getDisplayOpsDeps(), options);
  }

  getUltraPerformanceModeOptions(): UltraPerformanceModeOptions {
    return getUltraPerformanceModeOptionsImpl(this.getDisplayOpsDeps());
  }

  private lerpLightsToTarget(): void {
    lerpLightsToTargetImpl(this.getDisplayOpsDeps());
  }

  getUltraPerformanceMode(): boolean {
    return getUltraPerformanceModeImpl(this.getDisplayOpsDeps());
  }

  setLockEnabled(enabled: boolean): void {
    this.lockEnabled = enabled;
    if (!enabled) {
      this.boxes.forEach((entry) => this.clearSnapState(entry.mesh));
    }
    this.updateBoxesIntersectingWalls();
    this.refreshOutlineTarget();
  }

  getLockEnabled(): boolean {
    return this.lockEnabled;
  }

  getCombinedBoundingBox(): { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; width: number; height: number; depth: number } | null {
    if (this.boxes.size === 0) return null;
    const roots = Array.from(this.boxes.values()).map((e) => e.mesh);
    runWithAllLayoutBoundsProxiesVisible(roots, () => {
      this._boundingBox.makeEmpty();
      this.boxes.forEach((entry) => this._boundingBox.expandByObject(entry.mesh));
    });
    const min = this._boundingBox.min.clone();
    const max = this._boundingBox.max.clone();
    this._boundingBox.getSize(this._size);
    return {
      min,
      max,
      size: this._size.clone(),
      width: this._size.x,
      height: this._size.y,
      depth: this._size.z,
    };
  }

  /**
   * Retorna IDs codificados (box:, remate:, rodape:) dos objetos cujo bbox projetado intersecta o retângulo em px.
   */
  getSelectionIdsInScreenRect(
    rect: { left: number; top: number; right: number; bottom: number },
    canvas: HTMLCanvasElement
  ): string[] {
    return getSelectionIdsInScreenRectImpl(this.getSelectionOpsDeps(), rect, canvas);
  }

  setMultiSelectionOutlines(encodedIds: string[]): void {
    this.selectionEngine.setMultiSelectionOutlines(encodedIds);
  }

  setGroupTransformMembers(encodedIds: string[]): void {
    this.selectionEngine.setGroupTransformMembers(encodedIds);
  }

  getGroupTransformMembers(): string[] {
    return this.viewerState.getGroupTransformMemberIds();
  }

  clearGroupTransformMembers(): void {
    this.selectionEngine.clearGroupTransformMembers();
  }

  setOnTransformDragStart(callback: (() => void) | null): void {
    this.onTransformDragStart = callback;
  }

  setOnTransformDragEnd(callback: (() => void) | null): void {
    this.onTransformDragEnd = callback;
  }

  syncMeasurementAnchors(
    anchors: MeasurementAnchorEntry[],
    selectedMesh?: THREE.Object3D | null
  ): void {
    syncMeasurementAnchorsToVisualizer(this.measurementAnchorsVisualizer, anchors, selectedMesh);
  }

  addMeasurementAnchorAtPointer(event: { clientX: number; clientY: number }): MeasurementAnchorEntry | null {
    const snap = pickMeasurementSnap(event, {
      getCamera: () => this.cameraManager.camera,
      getCanvas: () => this.rendererManager.renderer.domElement,
      getBoxes: () => this.boxes,
      getRoomWalls: () => this.roomBoxWalls,
      projectWorldToScreen: (worldPoint) => this.projectWorldToScreen(worldPoint),
    });
    if (snap) return createMeasurementAnchorFromSnap(snap);
    // Fallback: ponto de interseção cru quando nada faz snap.
    const hit = this.pointerPicking.getPointerWorldHit(event);
    return hit ? createMeasurementAnchorFromWorldHit(hit) : null;
  }

  /**
   * Extension point reservado para smart snap de grupos.
   * Aplica snap ao primeiro membro caixa e propaga delta ao pivô do grupo.
   */
  applySmartSnapForGroup(_pointerPosition?: { x: number; y: number; z: number }): boolean {
    return applySmartSnapForGroupImpl(this.getTransformOpsDeps(), _pointerPosition);
  }

  resolveMemberMesh(encoded: string): THREE.Object3D | null {
    return resolveMemberMeshImpl(this.getSelectionOpsDeps(), encoded);
  }

  applyGroupPivotTransform(): void {
    applyGroupPivotTransformImpl(this.getTransformOpsDeps());
  }

  notifyGroupTransform(options?: { recordHistory?: boolean }): void {
    notifyGroupTransformImpl(this.getTransformOpsDeps(), options);
  }

  clampGroupTransform(): void {
    clampGroupTransformImpl(this.getTransformOpsDeps());
  }

  isPointerOnSelectableObject(event: { clientX: number; clientY: number }): boolean {
    return this.pointerPicking.isPointerOnSelectableObject(event);
  }

  setOnMultiSelectToggle(callback: ((_encodedId: string) => void) | null): void {
    this.onMultiSelectToggle = callback;
  }

  getPointerSelectionEncodedId(event: { clientX: number; clientY: number }): string | null {
    return this.pointerPicking.getPointerSelectionEncodedId(event);
  }

  /**
   * Maior X (borda direita) das caixas em metros.
   * Usa bbox real quando disponível; quando bbox ainda não carregado (ex.: Group vazio) usa position + width/2.
   * Sem caixas retorna -0.1.
   */
  getRightmostX(): number {
    if (this.boxes.size === 0) return -0.1;
    let maxX = -Infinity;
    this.boxes.forEach((entry) => {
      entry.mesh.updateMatrixWorld(true);
      setBox3FromObjectExcludingLayoutProxy(this._boundingBox, entry.mesh);
      this._boundingBox.getSize(this._size);
      const rightEdge =
        this._size.x < 0.001 || !Number.isFinite(this._boundingBox.max.x)
          ? entry.mesh.position.x + entry.width / 2
          : this._boundingBox.max.x;
      if (rightEdge > maxX) maxX = rightEdge;
    });
    return Number.isFinite(maxX) ? maxX : -0.1;
  }

  /** Dimensões da caixa selecionada (L, A, P). Usado no modo Selecionar para overlay. */
  getSelectedBoxDimensions(): { width: number; height: number; depth: number } | null {
    if (!this.viewerState.getSelectedBox()) return null;
    const entry = this.boxes.get(this.viewerState.getSelectedBox());
    if (!entry) return null;
    return { width: entry.width, height: entry.height, depth: entry.depth };
  }

  setDimensionsOverlayVisible(visible: boolean): void {
    this.dimensionsOverlay.setVisible(visible);
  }

  getDimensionsOverlayVisible(): boolean {
    return this.dimensionsOverlay.isVisible();
  }

  toggleDimensionsOverlay(): boolean {
    return this.dimensionsOverlay.toggle();
  }

  /**
   * Objetos atualmente selecionáveis para alinhamento (primeiro = referência).
   * `multiBoxIds` — ordem da multi-seleção de caixas (Workspace).
   */
  getSelectedObjects(multiBoxIds?: string[]): AlignableObject[] {
    const result: AlignableObject[] = [];
    const seen = new Set<string>();

    const push = (obj: AlignableObject) => {
      const key = `${obj.kind}:${obj.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(obj);
    };

    const remateId = this.viewerState.getSelectedRemate();
    if (remateId) {
      const mesh = this.getRemateMesh(remateId);
      if (mesh) push({ kind: "remate", id: remateId, mesh });
    }

    const rodapeId = this.viewerState.getSelectedRodape();
    if (rodapeId) {
      const mesh = this.rodapeVisualizer.getMeshByRodapeId(rodapeId);
      if (mesh) push({ kind: "rodape", id: rodapeId, mesh });
    }

    const boxIds =
      multiBoxIds && multiBoxIds.length > 0
        ? multiBoxIds
        : this.viewerState.getSelectedBox()
          ? [this.viewerState.getSelectedBox()!]
          : [];

    for (const id of boxIds) {
      const entry = this.boxes.get(id);
      if (!entry) continue;
      push({
        kind: "box",
        id,
        mesh: entry.mesh,
        locked: entry.locked === true,
      });
    }

    return result;
  }

  /** Alinha objetos selecionados (referência = primeiro). */
  align(type: AlignmentType, multiBoxIds?: string[]): boolean {
    return this.selectionEngine.align(type, multiBoxIds);
  }

  private notifyAlignableTransform(obj: AlignableObject): void {
    if (obj.kind === "box") {
      const entry = this.boxes.get(obj.id);
      if (!entry) return;
      const { x, y, z } = entry.mesh.position;
      const r = entry.mesh.rotation;
      this.onBoxTransform?.(obj.id, { x, y, z }, { x: r.x, y: r.y, z: r.z });
      return;
    }
    if (obj.kind === "remate") {
      const prev = this.viewerState.getSelectedRemate();
      if (prev !== obj.id) this.viewerState.setSelectedRemate(obj.id);
      this.notifyRemateTransform();
      if (prev !== obj.id) this.viewerState.setSelectedRemate(prev);
      return;
    }
    if (obj.kind === "rodape") {
      const prev = this.viewerState.getSelectedRodape();
      if (prev !== obj.id) this.viewerState.setSelectedRodape(obj.id);
      this.notifyRodapeTransform();
      if (prev !== obj.id) this.viewerState.setSelectedRodape(prev);
    }
  }

  private collectBoxBoundsForDimensions(): BoxBoundsInput[] {
    const inputs: BoxBoundsInput[] = [];
    this.boxes.forEach((entry, id) => {
      if (!entry.mesh.visible) return;
      entry.mesh.updateMatrixWorld(true);
      setBox3FromObjectExcludingLayoutProxy(this._boundingBox, entry.mesh);
      if (!Number.isFinite(this._boundingBox.min.x)) return;
      inputs.push({
        id,
        min: this._boundingBox.min.clone(),
        max: this._boundingBox.max.clone(),
        cabinetType: entry.cabinetType,
      });
    });
    return inputs;
  }

  /** Modo canónico da régua (único motor: MeasurementEngine). */
  setMeasurementMode(enabled: boolean): void {
    this.measurementEngine.setEnabled(enabled);
  }

  getMeasurementMode(): boolean {
    return this.measurementEngine.isEnabled();
  }

  /** Fase 5 Parte A — picking interno (face / aresta / ponto). */
  getInternalSelectionHit(event: { clientX: number; clientY: number }): InternalSelectionHit | null {
    return this.pointerPicking.getInternalSelectionHit(event);
  }

  getInternalSelection(): InternalSelectionState | null {
    return cloneInternalSelectionState(this.viewerState.getInternalSelection());
  }

  setInternalSelection(selection: InternalSelectionState | null): void {
    setInternalSelectionImpl(this.getSelectionOpsDeps(), selection);
  }

  setInternalSelectionEnabled(enabled: boolean): void {
    this.viewerState.setInternalSelectionEnabled(enabled);
    if (!enabled) {
      this.setInternalSelection(null);
    }
  }

  getInternalMeasurements(boxId?: string): InternalCavityMeasurements | null {
    const resolvedId =
      boxId ??
      this.viewerState.getInternalSelection()?.boxId ??
      this.viewerState.getSelectedBox() ??
      null;
    if (!resolvedId) return null;
    const entry = this.boxes.get(resolvedId);
    if (!entry) return null;
    return computeInternalCavityMeasurements(resolvedId, entry);
  }

  isInternalRulerOverlayActive(): boolean {
    return this.measurementEngine.isActive();
  }

  getInternalSelectionEnabled(): boolean {
    return this.viewerState.getInternalSelectionEnabled();
  }

  setOnInternalSurfaceSelected(callback: ((_hit: InternalSelectionState) => void) | null): void {
    this.onInternalSurfaceSelected = callback;
  }

  setOnInternalEdgeSelected(callback: ((_hit: InternalSelectionState) => void) | null): void {
    this.onInternalEdgeSelected = callback;
  }

  setOnInternalPointSelected(callback: ((_hit: InternalSelectionState) => void) | null): void {
    this.onInternalPointSelected = callback;
  }

  /**
   * Posição em pixels (relativa ao container do viewer) do topo-centro da caixa selecionada.
   * Usado para posicionar o overlay de texto (dimensões + rotação) acima da caixa.
   */
  getSelectedBoxScreenPosition(): { x: number; y: number } | null {
    if (!this.viewerState.getSelectedBox() || !this.container) return null;
    const entry = this.boxes.get(this.viewerState.getSelectedBox());
    if (!entry) return null;
    entry.mesh.updateMatrixWorld(true);
    setBox3FromObjectExcludingLayoutProxy(this._boundingBox, entry.mesh);
    const min = this._boundingBox.min;
    const max = this._boundingBox.max;
    const topCenter = new THREE.Vector3(
      (min.x + max.x) * 0.5,
      max.y,
      (min.z + max.z) * 0.5
    );
    return this.projectWorldToScreen(topCenter);
  }

  /**
   * FASE 6 — Segmento no eixo de profundidade local (Z) da caixa selecionada, em espaço mundo.
   * Apenas leitura para overlays 2D (projectWorldToScreen); não altera geometria.
   */
  getSelectedBoxDepthAxisWorldSegment(
    lengthMeters: number
  ): { start: THREE.Vector3; end: THREE.Vector3 } | null {
    const id = this.viewerState.getSelectedBox();
    if (!id) return null;
    const entry = this.boxes.get(id);
    if (!entry) return null;
    const len = Number(lengthMeters);
    if (!Number.isFinite(len) || len <= 0) return null;
    const h = len * 0.5;
    entry.mesh.updateMatrixWorld(true);
    const a = new THREE.Vector3(0, 0, -h);
    const b = new THREE.Vector3(0, 0, h);
    a.applyMatrix4(entry.mesh.matrixWorld);
    b.applyMatrix4(entry.mesh.matrixWorld);
    return { start: a, end: b };
  }

  /** FASE 6 — Raycast no canvas (mesma lógica que o seletor de caixas). */
  getBoxIdAtPointerPublic(event: { clientX: number; clientY: number }): string | null {
    return getBoxIdAtPointerImpl(this.getEventOpsDeps(), event);
  }

  /**
   * Projeta um ponto 3D (mundial) em coordenadas de ecrã (pixels relativos ao container do viewer).
   * Retorna null se o ponto estiver atrás da câmera.
   */
  projectWorldToScreen(worldPoint: THREE.Vector3): { x: number; y: number } | null {
    if (!this.container) return null;
    const p = worldPoint.clone().project(this.cameraManager.camera);
    if (p.z > 1) return null;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const x = (p.x + 1) * 0.5 * w;
    const y = (1 - p.y) * 0.5 * h;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private updateDimensionsOverlay(): void {
    this.dimensionsOverlay.update();
  }

  getDimensionsOverlayData(): DimensionOverlayDataEntry[] {
    return this.dimensionsOverlay.getData();
  }

  getPrintReadyDimensions(): PrintReadyDimensions {
    return this.dimensionsOverlay.getPrintReadyDimensions();
  }

  private disposeComposer(): void {
    this.composerEngine?.disposeShowcase();
  }

  private disposeMainComposer(): void {
    this.composerEngine?.disposeMain();
  }

  loadMaterialSet(materialConfig?: MaterialSet) {
    this.materialSet = mergeViewerMaterialSet(this.materialSet, materialConfig);
  }

  updateBoxMaterial(id: string, materialName: string) {
    const entry = this.boxes.get(id);
    if (!entry) return;
    const nextMaterial = this.loadMaterial(materialName);
    if (!nextMaterial) return;

    entry.materialName = materialName;

    if (entry.mesh instanceof THREE.Group) {
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (isKitchenFeetNode(child)) return;
          // Click-target legado: nunca matéria do módulo (película fantasma).
          if (isDrawerClickTargetGhost(child)) return;
          // Nunca escrever matéria do módulo em frentes independentes.
          if (isDoorOrDrawerFrontNode(child) || isDrawerFrontExteriorMesh(child)) {
            traceDrawerFrontMaterial("updateBoxMaterial.SKIP_front", {
              boxId: id,
              moduleMaterial: materialName,
              mesh: describeMeshMaterial(child),
            });
            return;
          }
          if (child.userData?.isDrawerFrontExteriorCap === true) return;
          const childName = typeof child.name === "string" ? child.name : "";
          if (
            childName === "frente-fixa" ||
            childName.startsWith("frente-fixa") ||
            childName.startsWith("drawer-front-")
          ) {
            return;
          }
          if (child.userData?.drawerLayerId && child.userData?.drawerPart === "front") {
            return;
          }
          child.material = nextMaterial.material;
        }
      });
    } else if (entry.mesh instanceof THREE.Mesh) {
      if (!isKitchenFeetNode(entry.mesh)) {
        entry.mesh.material = nextMaterial.material;
      }
    }

    if (this.viewerState.getSelectedBox() === id) {
      this.refreshOutlineTarget();
    }
    disposeLoadedWoodMaterial(entry.material);
    entry.material = nextMaterial;
    if (this.viewerState.getSelectedBox() === id) {
      this.refreshOutlineTarget();
    }
    // Sem sync automático de gaveta/frente-fixa: só updateDrawerMaterial /
    // updateFixedFrontMaterial (escolha do utilizador) controlam essas matérias.
  }

  /** Reaplica materiais a todas as caixas (ao trocar modo performance/showcase/realistic). */
  reapplyAllBoxMaterials(): void {
    this.boxes.forEach((entry, id) => {
      const name = entry.materialName ?? this.defaultMaterialName;
      this.updateBoxMaterial(id, name);
    });
    this.syncRemateVisuals();
    this.syncRodapeVisuals();
  }

  /**
   * Activa/desactiva costa traseira no viewer (mesh `back` + profundidade útil).
   * O estado de projecto deve ser actualizado via `setWorkspaceBoxNoBackPanel` na UI.
   */
  setBoxNoBackPanel(boxId: string, enabled: boolean): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    const layoutDepthM = entry.depth;
    const backM = SYSTEM_BACK_MM / 1000;
    const carcassDepthM = enabled
      ? layoutDepthM
      : Math.max(0.001, entry.carcassDepth ?? layoutDepthM - backM);
    const ok = this.updateBox(boxId, {
      noBackPanel: enabled,
      costaAtiva: !enabled,
      layoutDepthM,
      carcassDepthM,
    });
    if (ok) {
      const updated = this.boxes.get(boxId);
      if (updated) updated.noBackPanel = enabled;
      if (this.viewerState.getSelectedBox() === boxId) {
        this.refreshOutlineTarget();
      }
      this.refreshTransformControlsAttachment();
    }
    return ok;
  }

  /**
   * Aplica um material a uma porta específica (por boxId e doorLayerId).
   * Localiza o grupo door-layer-{doorLayerId}, extrai DoorSpec, remove a porta antiga, cria nova com createDoorObject
   * preservando doorHoles e aplica applyPanelIdsToBox para manter userData.boxId/doorLayerId para seleção e outline.
   */
  updateDoorMaterial(boxId: string, doorLayerId: string, materialName: string): void {
    if (import.meta.env.DEV) {
      devLogger.debug("[DOOR-MAT] ViewerCore.updateDoorMaterial", { boxId, doorLayerId, materialName });
    }
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    const nextMaterial = this.loadMaterial(materialName);
    if (!nextMaterial) return;
    const boxGroup = entry.mesh;
    if (!(boxGroup instanceof THREE.Group)) return;

    const doorLayerNames = boxGroup.children
      .filter((c) => c.name.startsWith("door-layer-"))
      .map((c) => c.name);
    const expectedName = `door-layer-${doorLayerId}`;
    const oldDoorGroup = boxGroup.children.find(
      (c) => c.name === expectedName
    ) as THREE.Group | undefined;

    if (import.meta.env.DEV) {
      devLogger.debug("[updateDoorMaterial] diagnóstico", {
        boxId,
        doorLayerIdRecebido: doorLayerId,
        gruposDoorLayerNoBox: doorLayerNames,
        nomeEsperado: expectedName,
        encontrouGrupo: Boolean(oldDoorGroup),
        meshUuidAntes: oldDoorGroup
          ? (() => {
              let u: string | null = null;
              oldDoorGroup.traverse((n) => {
                if (n instanceof THREE.Mesh) u = n.uuid;
              });
              return u;
            })()
          : null,
      });
    }

    if (!oldDoorGroup) return;
    const spec = getDoorSpecFromGroup(oldDoorGroup);
    if (!spec) return;
    let doorHoles: TechnicalDrillHole[] | undefined;
    oldDoorGroup.traverse((node) => {
      if (node instanceof THREE.Mesh && this.appliedRotationByMeshUuid.has(node.uuid)) {
        this.appliedRotationByMeshUuid.delete(node.uuid);
      }
      const ud = (node as THREE.Object3D & { userData: { doorHolesEffective?: TechnicalDrillHole[] } }).userData;
      if (Array.isArray(ud?.doorHolesEffective)) doorHoles = ud.doorHolesEffective;
    });
    boxGroup.remove(oldDoorGroup);
    const doorMat = (nextMaterial.material as THREE.Material).clone();
    const newDoor = createDoorObject(
      spec,
      doorMat,
      filterTechnicalDrillHolesForViewerMesh(doorHoles)
    );
    boxGroup.add(newDoor);
    newDoor.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        applyMeshGrainOrientation(n, materialName, () => this.requestRender());
      }
    });
    this.applyViewerDrillHoleSceneRules(newDoor);
    if (import.meta.env.DEV) {
      devLogger.debug("[DOOR-MAT] Material aplicado independentemente:", {
        id: doorLayerId,
        material: (doorMat as THREE.Material).uuid,
        textura: materialName,
      });
    }
    this.applyPanelIdsToBox(boxGroup, boxId, undefined, entry.materialName ?? this.defaultMaterialName);
    this.applyPanelVisibilityForObject(boxGroup);
    if (import.meta.env.DEV) {
      let newMeshUuid: string | null = null;
      newDoor.traverse((n) => {
        if (n instanceof THREE.Mesh) newMeshUuid = n.uuid;
      });
      devLogger.debug("[updateDoorMaterial] porta reconstruída", {
        boxId,
        doorLayerId,
        newMeshUuid,
        groupName: newDoor.name,
        groupUserDataDoorLayerId: (newDoor as THREE.Object3D & { userData: { doorLayerId?: string } }).userData?.doorLayerId,
      });
    }
    if (this.viewerState.getSelectedBox() === boxId) this.refreshOutlineTarget();
  }

  /**
   * Aplica um material à frente de uma gaveta (por boxId e drawerLayerId).
   * Paridade com updateDoorMaterial: rebuild do grupo.
   * Mapas PBR: createClonedMaterialWithDetailMaps (clone + re-apply async no clone —
   * material.clone() antes do Promise dos mapas deixa a frente sem textura e vulnerável
   * a ser confundida/substituída quando os mapas do módulo chegam).
   */
  updateDrawerMaterial(
    boxId: string,
    drawerLayerId: string,
    materialName: string,
    drawerLayerItems?: DrawerLayerItem[]
  ): void {
    traceDrawerFrontMaterial("updateDrawerMaterial.ENTER", { boxId, drawerLayerId, materialName });
    if (import.meta.env.DEV) {
      devLogger.debug("[DRAWER-MAT] ViewerCore.updateDrawerMaterial", { boxId, drawerLayerId, materialName });
    }
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    const frontMat = createClonedMaterialWithDetailMaps(materialName, {
      onMapsApplied: () => {
        traceDrawerFrontMaterial("updateDrawerMaterial.MAPS_APPLIED", {
          boxId,
          drawerLayerId,
          materialName,
        });
        this.requestRender();
      },
    });
    if (!frontMat) return;
    const boxGroup = entry.mesh;
    if (!(boxGroup instanceof THREE.Group)) return;

    const expectedName = `drawer-layer-${drawerLayerId}`;
    const oldDrawerGroup = boxGroup.children.find(
      (c) => c.name === expectedName
    ) as THREE.Group | undefined;

    if (import.meta.env.DEV) {
      devLogger.debug("[updateDrawerMaterial] diagnóstico", {
        boxId,
        drawerLayerIdRecebido: drawerLayerId,
        nomeEsperado: expectedName,
        encontrouGrupo: Boolean(oldDrawerGroup),
      });
    }

    if (!oldDrawerGroup) return;
    let spec = getDrawerSpecFromGroup(oldDrawerGroup);
    if (!spec && drawerLayerItems?.length) {
      const fromItems = buildDrawerSpecs(drawerLayerItems).find((s) => s.id === drawerLayerId);
      if (fromItems) spec = fromItems;
    }
    if (!spec) return;

    oldDrawerGroup.traverse((node) => {
      if (node instanceof THREE.Mesh && this.appliedRotationByMeshUuid.has(node.uuid)) {
        this.appliedRotationByMeshUuid.delete(node.uuid);
      }
    });
    boxGroup.remove(oldDrawerGroup);

    const bodyMaterialName = entry.materialName ?? this.defaultMaterialName;
    const bodyLoaded = this.loadMaterial(bodyMaterialName);
    const bodyMat = bodyLoaded
      ? (bodyLoaded.material as THREE.Material).clone()
      : frontMat.clone();

    const newDrawer = createDrawerObject(spec, {
      front: frontMat,
      body: bodyMat,
      frontMaterialId: materialName,
    });
    boxGroup.add(newDrawer);
    newDrawer.traverse((n) => {
      if (
        n instanceof THREE.Mesh &&
        (n.userData as { drawerPart?: string }).drawerPart === "front"
      ) {
        traceDrawerFrontMaterial("updateDrawerMaterial.FRONT_ASSIGNED", {
          boxId,
          drawerLayerId,
          materialName,
          mesh: describeMeshMaterial(n),
        });
        applyMeshGrainOrientation(n, materialName, () => this.requestRender());
      }
    });
    this.applyViewerDrillHoleSceneRules(newDrawer);
    if (import.meta.env.DEV) {
      devLogger.debug("[DRAWER-MAT] Material aplicado independentemente:", {
        id: drawerLayerId,
        material: frontMat.uuid,
        textura: materialName,
      });
    }
    this.applyPanelIdsToBox(boxGroup, boxId, undefined, entry.materialName ?? this.defaultMaterialName);
    this.applyPanelVisibilityForObject(boxGroup);
    if (this.viewerState.getSelectedBox() === boxId) this.refreshOutlineTarget();
    this.requestRender();
  }

  /**
   * Facade unificada para matérias de frente (porta / gaveta / frente fixa).
   * Delega nos updaters existentes — sem novo pipeline.
   */
  updateFrontMaterial(
    partType: "door" | "drawer-front" | "fixed-front",
    boxId: string,
    materialName: string,
    layerId?: string,
    drawerLayerItems?: DrawerLayerItem[]
  ): void {
    if (partType === "door") {
      if (!layerId) return;
      this.updateDoorMaterial(boxId, layerId, materialName);
      return;
    }
    if (partType === "drawer-front") {
      if (!layerId) return;
      this.updateDrawerMaterial(boxId, layerId, materialName, drawerLayerItems);
      return;
    }
    this.updateFixedFrontMaterial(boxId, materialName);
  }

  /** Aplica material independente à peça frente-fixa (canto v2). */
  updateFixedFrontMaterial(boxId: string, materialName: string): void {
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    const ffPanel = this.findFixedFrontPanel(entry.mesh);
    if (!ffPanel) return;
    const nextMaterial = this.loadMaterial(materialName);
    if (!nextMaterial) return;
    ffPanel.material = (nextMaterial.material as THREE.Material).clone();
    applyMeshGrainOrientation(ffPanel, materialName, () => this.requestRender());
    (ffPanel.userData as Record<string, unknown>).frenteFixaMaterialId = materialName;
    entry.frenteFixaMaterialId = materialName;
    this.requestRender();
    if (this.viewerState.getSelectedBox() === boxId) this.refreshOutlineTarget();
  }

  private findFixedFrontPanel(root: THREE.Object3D): THREE.Mesh | undefined {
    return root.children.find(
      (c) => c instanceof THREE.Mesh && c.name === "frente-fixa"
    ) as THREE.Mesh | undefined;
  }

  /**
   * Define o modo de materiais (performance/showcase/realistic) e reaplica a todas as caixas.
   */
  setMaterialMode(mode: MaterialMode): void {
    this.materialPipeline.setMaterialMode(mode);
    this.reapplyAllBoxMaterials();
  }

  getMaterialMode(): MaterialMode {
    return this.materialPipeline.getMaterialMode();
  }

  setBoxPosition(id: string, position: { x: number; y: number; z: number }): boolean {
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return false;
    }
    return this.updateBox(id, { position });
  }

  private incrementRotationDiagnostics(uuid: string, key: "applied" | "duplicateSkipped"): void {
    if (!import.meta.env.DEV) return;
    const current = this.rotationDiagnosticsByUuid.get(uuid) ?? { applied: 0, duplicateSkipped: 0 };
    current[key] += 1;
    this.rotationDiagnosticsByUuid.set(uuid, current);
  }

  private logRotationDiagnosticsIfNeeded(): void {
    if (!import.meta.env.DEV) return;
    const now = performance.now();
    if (now - this.rotationDiagnosticsLastLogTs < 2000) return;
    this.rotationDiagnosticsLastLogTs = now;

    const rows = Array.from(this.rotationDiagnosticsByUuid.entries()).map(([uuid, stats]) => ({
      uuid,
      rot_applied: stats.applied,
      rot_duplicate_skipped: stats.duplicateSkipped,
    }));
    if (rows.length === 0) return;
    console.groupCollapsed("[Viewer Rotation Diagnostics] by mesh.uuid");
    console.table(rows);
    console.groupEnd();
  }

  private applyRotationIfNeeded(
    mesh: THREE.Object3D | null | undefined,
    rotation?: { x?: number; y?: number; z?: number }
  ): void {
    if (!mesh || !rotation) return;
    let applied = false;
    if (rotation.x != null && Number.isFinite(rotation.x)) {
      mesh.rotation.x = rotation.x;
      applied = true;
    }
    if (rotation.y != null && Number.isFinite(rotation.y)) {
      const previous = this.appliedRotationByMeshUuid.get(mesh.uuid);
      if (previous == null || Math.abs(previous - rotation.y) >= 1e-6) {
        mesh.rotation.y = rotation.y;
        this.appliedRotationByMeshUuid.set(mesh.uuid, rotation.y);
        applied = true;
      }
    }
    if (rotation.z != null && Number.isFinite(rotation.z)) {
      mesh.rotation.z = rotation.z;
      applied = true;
    }
    if (applied) {
      mesh.updateMatrixWorld();
      this.incrementRotationDiagnostics(mesh.uuid, "applied");
      this.logRotationDiagnosticsIfNeeded();
    }
  }

  private applyMousePresetToControls(): void {
    const controls = this.controls?.controls;
    if (!controls) return;
    const mapping = getMouseInputMapping(this.mouseInputPreset);
    applyMouseInputMappingToOrbitControls(controls, mapping);
  }

  /** Aplica o mapeamento canónico de Orbit/Pan/Zoom. Não depende da ferramenta activa. */
  private applyTransformControlsMouseGuard(): void {
    applyTransformControlsMouseGuardImpl(this.getTransformOpsDeps());
  }

  private logTransformDiagnostic(event: string, payload?: Record<string, unknown>): void {
    logTransformDiagnosticImpl(this.getTransformOpsDeps(), event, payload);
  }

  setMousePreset(preset: ViewerMousePreset): void {
    this.mouseInputPreset = normalizeMouseInputPreset(preset);
    this.applyTransformControlsMouseGuard();
  }

  getMousePreset(): ViewerMousePreset {
    return this.mouseInputPreset;
  }

  private applyBackgroundMode(): void {
    applyBackgroundModeImpl(this.getDisplayOpsDeps());
  }

  /** Orquestrador: quality → glossIntensity → matteMode.
   * Único ponto de reconciliação de brilho. Substitui applyMaterialQualityProfile. */
  private reapplyDisplayMaterials(): void {
    reapplyDisplayMaterialsImpl(this.getDisplayOpsDeps());
  }

  setGlossIntensity(value: number): void {
    setGlossIntensityImpl(this.getDisplayOpsDeps(), value);
  }

  getGlossIntensity(): number {
    return getGlossIntensityImpl(this.getDisplayOpsDeps());
  }

  setMatteMode(enabled: boolean): void {
    setMatteModeImpl(this.getDisplayOpsDeps(), enabled);
  }

  getMatteMode(): boolean {
    return getMatteModeImpl(this.getDisplayOpsDeps());
  }

  setBackgroundMode(mode: ViewerBackgroundMode): void {
    setBackgroundModeImpl(this.getDisplayOpsDeps(), mode);
  }

  getBackgroundMode(): ViewerBackgroundMode {
    return getBackgroundModeImpl(this.getDisplayOpsDeps());
  }

  setMaterialQuality(quality: ViewerMaterialQuality): void {
    setMaterialQualityImpl(this.getDisplayOpsDeps(), quality);
  }

  getMaterialQuality(): ViewerMaterialQuality {
    return getMaterialQualityImpl(this.getDisplayOpsDeps());
  }

  private updateReflectionProbe(force = false): void {
    updateReflectionProbeImpl(this.getDisplayOpsDeps(), force);
  }

  setReflectionsEnabled(enabled: boolean): void {
    setReflectionsEnabledImpl(this.getDisplayOpsDeps(), enabled);
  }

  getReflectionsEnabled(): boolean {
    return getReflectionsEnabledImpl(this.getDisplayOpsDeps());
  }

  setPhotoModeEnabled(enabled: boolean): void {
    setPhotoModeEnabledImpl(this.getDisplayOpsDeps(), enabled);
  }

  getPhotoModeEnabled(): boolean {
    return getPhotoModeEnabledImpl(this.getDisplayOpsDeps());
  }

  setExplodedViewEnabled(enabled: boolean): void {
    setExplodedViewEnabledImpl(this.getIndustrialModeDeps(), enabled);
  }

  setHighlightEnabled(enabled: boolean): void {
    setHighlightEnabledImpl(this.getSelectionOpsDeps(), enabled);
  }

  getExplodedViewEnabled(): boolean {
    return getExplodedViewEnabledImpl(this.getIndustrialModeDeps());
  }

  setExplodedViewIntensity(value: number): void {
    setExplodedViewIntensityImpl(this.getIndustrialModeDeps(), value);
  }

  getExplodedViewIntensity(): number {
    return getExplodedViewIntensityImpl(this.getIndustrialModeDeps());
  }

  private applyPanelIdsToBox(
    root: THREE.Object3D,
    boxId: string,
    panelIds?: Partial<BoxPanelIds> | null,
    materialPresetId?: string
  ): void {
    applyPanelIdsToBoxImpl(this.getIndustrialModeDeps(), root, boxId, panelIds, materialPresetId);
  }

  private applyPanelVisibilityForObject(root: THREE.Object3D): void {
    applyPanelVisibilityForObjectImpl(this.getIndustrialModeDeps(), root);
  }

  private applyExplodedViewForObject(root: THREE.Object3D): void {
    applyExplodedViewForObjectImpl(this.getIndustrialModeDeps(), root);
  }

  setPanelEdgesVisible(visible: boolean): void {
    setPanelEdgesVisibleImpl(this.getIndustrialModeDeps(), visible);
  }

  setPanelHidden(panel: "left" | "right" | "top" | "bottom" | "back", hidden: boolean): void {
    setPanelHiddenImpl(this.getIndustrialModeDeps(), panel, hidden);
  }

  setHiddenPanels(keys: string[]): void {
    setHiddenPanelsImpl(this.getIndustrialModeDeps(), keys);
  }

  getHiddenPanels(): string[] {
    return getHiddenPanelsImpl(this.getIndustrialModeDeps());
  }

  setAllPanelsHidden(hidden: boolean): void {
    setAllPanelsHiddenImpl(this.getIndustrialModeDeps(), hidden);
  }

  setPanelRenderingEnabled(enabled: boolean): void {
    setPanelRenderingEnabledImpl(this.getIndustrialModeDeps(), enabled);
  }

  getPanelRenderingEnabled(): boolean {
    return getPanelRenderingEnabledImpl(this.getIndustrialModeDeps());
  }

  /** Workspace Industrial de Design — activa/desactiva modo de inserção de furos. */
  setIndustrialDesignWorkspaceEnabled(enabled: boolean): void {
    setIndustrialDesignWorkspaceEnabledImpl(this.getIndustrialModeDeps(), enabled);
  }

  getIndustrialDesignWorkspaceEnabled(): boolean {
    return getIndustrialDesignWorkspaceEnabledImpl(this.getIndustrialModeDeps());
  }

  setIndustrialDesignActiveHoleType(id: HoleTypeId | null): void {
    setIndustrialDesignActiveHoleTypeImpl(this.getIndustrialModeDeps(), id);
  }

  getIndustrialDesignActiveHoleType(): HoleTypeId | null {
    return getIndustrialDesignActiveHoleTypeImpl(this.getIndustrialModeDeps());
  }

  setIndustrialDesignBox(box: IndustrialDesignBox | null, targetBoxId?: string | null): void {
    setIndustrialDesignBoxImpl(this.getIndustrialModeDeps(), box, targetBoxId);
  }

  getIndustrialDesignBox(): IndustrialDesignBox | null {
    return getIndustrialDesignBoxImpl(this.getIndustrialModeDeps());
  }

  getIndustrialDesignSelectedPanelId(): string | null {
    return getIndustrialDesignSelectedPanelIdImpl(this.getIndustrialModeDeps());
  }

  private industrialDesignCallbacks: IndustrialDesignCallbacksState = {};

  setOnIndustrialDesignPanelSelected(
    callback: ((panelId: string | null, boxId: string | null) => void) | null
  ): void {
    setOnIndustrialDesignPanelSelectedImpl(this.getIndustrialModeDeps(), callback);
  }

  setOnIndustrialDesignHolePlaced(
    callback: ((
      panelId: string,
      hole: DesignDrillHole,
      paired?: { panelId: string; hole: DesignDrillHole }
    ) => void) | null
  ): void {
    setOnIndustrialDesignHolePlacedImpl(this.getIndustrialModeDeps(), callback);
  }

  setOnIndustrialDesignChanged(
    callback: ((box: IndustrialDesignBox) => void) | null
  ): void {
    setOnIndustrialDesignChangedImpl(this.getIndustrialModeDeps(), callback);
  }

  setOnIndustrialDesignValidationChanged(
    callback: ((issues: DesignValidationIssue[]) => void) | null
  ): void {
    setOnIndustrialDesignValidationChangedImpl(this.getIndustrialModeDeps(), callback);
  }

  setOnIndustrialDesignValidationFailed(
    callback: ((error: DesignValidationError) => void) | null
  ): void {
    setOnIndustrialDesignValidationFailedImpl(this.getIndustrialModeDeps(), callback);
  }

  getIndustrialDesignValidationIssues(): DesignValidationIssue[] {
    return getIndustrialDesignValidationIssuesImpl(this.getIndustrialModeDeps());
  }

  refreshIndustrialDesignValidation(): DesignValidationIssue[] {
    return refreshIndustrialDesignValidationImpl(this.getIndustrialModeDeps());
  }

  /** Destaca painéis com erro de validação (contorno vermelho). */
  setIndustrialDesignValidationHighlight(boxId: string, panelIds: string[]): void {
    setIndustrialDesignValidationHighlightImpl(this.getIndustrialModeDeps(), boxId, panelIds);
  }

  /** Destaca painel seleccionado no modo design (contorno azul). */
  setIndustrialDesignSelectionHighlight(boxId: string, panelId: string | null): void {
    setIndustrialDesignSelectionHighlightImpl(this.getIndustrialModeDeps(), boxId, panelId);
  }

  setRoomCeilingVisible(visible: boolean): void {
    setRoomCeilingVisibleImpl(this.getRoomGeometryDeps(), visible);
  }

  setRoomFloorMode(mode: RoomFloorMode): void {
    setRoomFloorModeImpl(this.getRoomGeometryDeps(), mode);
  }

  setRoomHiddenWalls(wallIds: string[]): void {
    setRoomHiddenWallsImpl(this.getRoomGeometryDeps(), wallIds);
  }

  setRoomUtilities(utilities: ProjectRoomUtility[]): void {
    setRoomUtilitiesImpl(this.getRoomGeometryDeps(), utilities);
  }

  setWallEditMode(enabled: boolean): void {
    setWallEditModeImpl(this.getRoomGeometryDeps(), enabled);
  }

  addBox(id: string, options: BoxOptions = {}): boolean {
    if (this.boxes == null || this.boxManager == null) {
      throw new Error(
        "ViewerCore not ready: boxes/boxManager not initialized. Ensure viewerReady is true before calling addBox."
      );
    }
    return this.ensureBoxEngine().addBox({
      id,
      options,
      boxes: this.boxes,
      boxManager: this.boxManager,
      defaultMaterialName: this.defaultMaterialName,
      nextIndex: this.getNextBoxIndex(),
      heightBaseCm: ViewerCore.HEIGHT_BASE_CM,
      loadMaterial: (materialName) => this.loadMaterial(materialName),
      filterViewerDrillMarkersForMesh,
      getFixedYForCabinet: (entry) => this.getFixedYForCabinet(entry),
      applyRotationIfNeeded: (mesh, rotation) => this.applyRotationIfNeeded(mesh, rotation),
      syncFeetVisualForBox: (entry) => this.syncFeetVisualForBox(entry),
      sceneAdd: (object) => this.sceneEngine.add(object),
      applyPanelIdsToBox: (root, boxId, panelIds, materialPresetId) =>
        this.applyPanelIdsToBox(root, boxId, panelIds, materialPresetId),
      applyPanelVisibilityForObject: (root) => this.applyPanelVisibilityForObject(root),
      applyExplodedViewForObject: (root) => this.applyExplodedViewForObject(root),
      syncOrlaForBox: (boxId) => this.syncOrlaForBox(boxId),
      syncRemateForBox: (boxId) => this.syncRemateForBox(boxId),
      syncEdgeOutlines: () =>
        syncEdgeOutlineRootImpl(this.getSelectionOpsDeps()),
      applyBackgroundMode: () => this.applyBackgroundMode(),
      reapplyDisplayMaterials: () => this.reapplyDisplayMaterials(),
      isMeshInsideOrTouchingRoom: (mesh) => this.isMeshInsideOrTouchingRoom(mesh),
      hasRoomBounds: () => this.roomBounds != null,
      getLockEnabled: () => this.lockEnabled,
      applyRoomConstraint: (mesh, roomOptions) => this.applyRoomConstraint(mesh, roomOptions),
      ensureBoxesBaseAtFloor: () => this.ensureBoxesBaseAtFloor(),
      reflowBoxes: () => this.reflowBoxes(),
      updateCameraTargetToBox: (boxId, cameraOptions) =>
        this.updateCameraTargetToBox(boxId, cameraOptions),
      updateCameraTarget: () => this.updateCameraTarget(),
    });
  }

  updateBox(id: string, options: Partial<BoxOptions> = {}): boolean {
    const entry = this.boxes.get(id);
    const opts = options ?? {};
    const hasDimOpts =
      opts.width !== undefined ||
      opts.height !== undefined ||
      opts.depth !== undefined ||
      opts.size !== undefined ||
      opts.layoutDepthM !== undefined ||
      opts.carcassDepthM !== undefined;
    if (import.meta.env.DEV && hasDimOpts) {
      devLogger.debug("[ViewerCore.updateBox] chamado com dimensões", {
        id,
        entry: !!entry,
        width: opts.width,
        height: opts.height,
        depth: opts.depth,
        layoutDepthM: opts.layoutDepthM,
        carcassDepthM: opts.carcassDepthM,
      });
    }
    if (!entry) return false;
    if ("frenteFixaMaterialId" in opts) {
      const v =
        typeof opts.frenteFixaMaterialId === "string" ? opts.frenteFixaMaterialId.trim() : "";
      entry.frenteFixaMaterialId = v || undefined;
    }
    if (
      (opts.size !== undefined && (!Number.isFinite(opts.size) || opts.size <= 0)) ||
      (opts.width !== undefined && (!Number.isFinite(opts.width) || opts.width <= 0)) ||
      (opts.height !== undefined && (!Number.isFinite(opts.height) || opts.height <= 0)) ||
      (opts.depth !== undefined && (!Number.isFinite(opts.depth) || opts.depth <= 0)) ||
      (opts.layoutDepthM !== undefined &&
        (!Number.isFinite(opts.layoutDepthM) || opts.layoutDepthM <= 0)) ||
      (opts.carcassDepthM !== undefined &&
        (!Number.isFinite(opts.carcassDepthM) || opts.carcassDepthM <= 0))
    ) {
      return false;
    }
    if (
      opts.position &&
      (!Number.isFinite(opts.position.x) ||
        !Number.isFinite(opts.position.y) ||
        !Number.isFinite(opts.position.z))
    ) {
      return false;
    }
    if (opts.index !== undefined && (!Number.isFinite(opts.index) || opts.index < 0)) {
      return false;
    }

    // Atualização apenas de posição/rotação (ex.: após drag ou sync do projeto). Não fazer rebuild (updateBoxGroup/createDoorObject).
    const structurePlan = this.ensureBoxEngine().createUpdateBoxStructurePlan(entry, opts);
    const { onlyTransform, hasStructureOpts } = structurePlan;
    if (onlyTransform && !hasStructureOpts) {
      if (import.meta.env.DEV) {
        devLogger.debug("[DOOR-MAT] ViewerCore.updateBox ramo onlyTransform — NÃO chama updateBoxGroup", { boxId: id, onlyTransform: true, hasStructureOpts: false });
      }
      // Defesa: ignorar updates externos de posição/rotação enquanto o drag estiver activo
      // para esta caixa. O Fix principal está em objectChange (notifyBoxTransform removido
      // durante drag), mas este guard protege contra qualquer outro caminho que chame updateBox.
      const isActiveDragForThisBox =
        this.viewerState.getTransformControlsDragging() &&
        this.viewerState.getSelectedBox() === id;
      return this.ensureBoxEngine().applyOnlyTransformUpdate({
        entry,
        opts,
        isActiveDragForThisBox,
        shouldUseFeetLock: (boxEntry) => this.shouldUseFeetLock(boxEntry),
        getFixedYForCabinet: (boxEntry) => this.getFixedYForCabinet(boxEntry),
        applyRotationIfNeeded: (mesh, rotation) => this.applyRotationIfNeeded(mesh, rotation),
        syncEdgeOutlines: () =>
          syncEdgeOutlineRootImpl(this.getSelectionOpsDeps()),
      });
    }

    const { dimensionsChanged, structureChanged } = structurePlan;
    if (structureChanged && this.viewerState.getTransformControlsDragging()) {
      this.pendingBoxStructureUpdates.set(id, {
        ...(this.pendingBoxStructureUpdates.get(id) ?? {}),
        ...opts,
      });
      return true;
    }
    if (structureChanged) {
      this.ensureBoxEngine().applyStructuralUpdate({
        id,
        entry,
        opts,
        plan: structurePlan,
        defaultMaterialName: this.defaultMaterialName,
        loadMaterial: (materialName) => this.loadMaterial(materialName),
        filterViewerDrillMarkersForMesh,
        deleteRotationCacheForMesh: (meshUuid) => this.appliedRotationByMeshUuid.delete(meshUuid),
        sceneRootAdd: (object) => this.sceneManager.root.add(object),
        syncEdgeOutlines: () =>
          syncEdgeOutlineRootImpl(this.getSelectionOpsDeps()),
        requestRender: () => this.requestRender(),
        logStructuralRebuild: import.meta.env.DEV && dimensionsChanged
          ? (payload) => devLogger.debug("[ViewerCore.updateBox] mesh reconstruído (estrutura alterada)", payload)
          : undefined,
      });
    }
    if (opts.materialName) {
      this.pendingMaterialSyncContext.set(id, {
        drawerLayerItems: opts.drawerLayerItems,
        // Só string explícita = override. undefined/vazio = preservar (nunca null→corpo).
        frenteFixaMaterialId:
          typeof opts.frenteFixaMaterialId === "string" && opts.frenteFixaMaterialId.trim()
            ? opts.frenteFixaMaterialId.trim()
            : undefined,
      });
    }
    try {
      return this.boxSceneController.applyPostUpdateFlow({
        id,
        entry,
        opts,
        plan: structurePlan,
        defaultMaterialName: this.defaultMaterialName,
        updateBoxMaterial: (boxId, materialName) => this.updateBoxMaterial(boxId, materialName),
        reapplyDisplayMaterials: () => this.reapplyDisplayMaterials(),
        shouldUseFeetLock: (boxEntry) => this.shouldUseFeetLock(boxEntry),
        getFixedYForCabinet: (boxEntry) => this.getFixedYForCabinet(boxEntry),
        applyRotationIfNeeded: (mesh, rotation) => this.applyRotationIfNeeded(mesh, rotation),
        applyPanelIdsToBox: (root, boxId, panelIds, materialPresetId) =>
          this.applyPanelIdsToBox(root, boxId, panelIds, materialPresetId),
        applyExplodedViewForObject: (root) => this.applyExplodedViewForObject(root),
        syncFeetVisualForBox: (boxEntry) => this.syncFeetVisualForBox(boxEntry),
        applyPanelVisibilityForObject: (root) => this.applyPanelVisibilityForObject(root),
        syncOrlaForBox: (boxId) => this.syncOrlaForBox(boxId),
        syncRemateForBox: (boxId) => this.syncRemateForBox(boxId),
        getLockEnabled: () => this.lockEnabled,
        applyFloorConstraint: (mesh) => this.applyFloorConstraint(mesh),
        applyCatalogModelScale: (boxEntry, model) => this.applyCatalogModelScale(boxEntry, model),
        reflowBoxes: () => this.reflowBoxes(),
        updateCameraTarget: () => this.updateCameraTarget(),
        updateCameraTargetToBox: (boxId, cameraOptions) =>
          this.updateCameraTargetToBox(boxId, cameraOptions),
        refreshViewerAttachmentsAfterMeshMutation: () => this.refreshViewerAttachmentsAfterMeshMutation(),
        updateModelsVerticalPosition: (boxEntry) => this.updateModelsVerticalPosition(boxEntry),
        hasRoomBounds: () => this.roomBounds != null,
        isMeshInsideOrTouchingRoom: (mesh) => this.isMeshInsideOrTouchingRoom(mesh),
        applyRoomConstraint: (mesh, roomOptions) => this.applyRoomConstraint(mesh, roomOptions),
        isSelectedBox: (boxId) => boxId === this.viewerState.getSelectedBox(),
        notifySelectedBoxChange: (boxId) => {
          this.selectedBoxChangeListeners.forEach((cb) => {
            try {
              cb(boxId);
            } catch {
              /* ignore */
            }
          });
        },
        syncEdgeOutlines: () =>
          syncEdgeOutlineRootImpl(this.getSelectionOpsDeps()),
        requestRender: () => this.requestRender(),
      });
    } finally {
      this.pendingMaterialSyncContext.delete(id);
    }
  }

  /** Agenda um frame de render no próximo requestAnimationFrame. Usado após rebuild de mesh para atualizar a tela imediatamente. */
  private requestRender(): void {
    requestRenderImpl(this.getRuntimeOpsDeps());
  }

  setBoxIndex(id: string, index: number): boolean {
    const entry = this.boxes.get(id);
    if (!entry) return false;
    if (!Number.isFinite(index) || index < 0) return false;
    entry.index = index;
    this.reflowBoxes();
    this.updateCameraTarget();
    return true;
  }

  /**
   * Objetos marcados como furo CNC auxiliar (malha dedicada): invisíveis e sem raycast.
   * Os furos estruturais em painéis são filtrados antes do CSG via viewerCncDrillFilter.
   */
  private applyViewerDrillHoleSceneRules(root: THREE.Object3D): void {
    applyViewerDrillHoleSceneRulesImpl(this.getIndustrialModeDeps(), root);
  }

  removeBox(id: string): boolean {
    const removed = this.boxSceneController.removeBox({
      id,
      boxes: this.boxes,
      boxManager: this.boxManager,
      getSelectedBoxId: () => this.viewerState.getSelectedBox(),
      clearSelectedBox: () => this.setSelectedBox(null),
      clearModelsFromBox: (boxId) => this.clearModelsFromBox(boxId),
      syncEdgeOutlines: () =>
        syncEdgeOutlineRootImpl(this.getSelectionOpsDeps()),
      deleteRotationCacheForMesh: (meshUuid) => this.appliedRotationByMeshUuid.delete(meshUuid),
      reflowBoxes: () => this.reflowBoxes(),
      updateCameraTarget: () => this.updateCameraTarget(),
    });
    if (removed) this.measurementEngine.onSceneContentChanged();
    return removed;
  }

  clearBoxes(): void {
    Array.from(this.boxes.keys()).forEach((id) => this.removeBox(id));
    this.measurementEngine.onSceneContentChanged();
  }

  /*
   * ROOM SYSTEM — 3 subsistemas complementares:
   * 1. RoomManager: sala principal (paredes, piso)
   * 2. RoomBuilder: aberturas (portas/janelas)
   * 3. wallStore + roomMeshFromWallStore: persistência e restore automático
   *
   * Fluxo de criação: createRoomWithDimensions -> RoomManager
   * Fluxo de restore: loadRoomConfig -> roomMeshSyncToken -> Workspace -> applyRoomMeshFromWallStore
   */
  /**
   * @deprecated Preferir `createRoomWithDimensions` no fluxo de UI (Painel Sala).
   * Mantido para compatibilidade com `ViewerApi.createRoom(RoomConfig)` em fluxos programáticos/snapshot.
   * Internamente este método converte `RoomConfig` para dimensões e delega em `createRoomWithDimensions`.
   */
  createRoom(config: RoomConfig): void {
    if (!this.ensureViewerRoomEngine().createRoomFromConfig(config)) {
      this.removeRoom();
    }
  }

  /** Cria a sala com o sistema RoomManager. numWalls: 4 = fechada, 3 = sala de estar (aberta, sem parede traseira). */
  createRoomWithDimensions(
    width: number,
    depth: number,
    height: number,
    numWalls?: 3 | 4,
    wallThicknessM?: number
  ): void {
    this.ensureViewerRoomEngine().createRoomWithDimensions(width, depth, height, numWalls, wallThicknessM);
  }

  removeRoom(): void {
    if (!this.ensureViewerRoomEngine().removeRoom()) {
      this.clearRoomBounds();
    }
  }

  setRoomDimensions(width: number, depth: number, height: number): void {
    this.ensureViewerRoomEngine().setRoomDimensions(width, depth, height);
  }

  addExtraWall(): void {
    this.ensureViewerRoomEngine().addExtraWall();
  }

  setRoomLocked(locked: boolean): void {
    this.ensureViewerRoomEngine().setRoomLocked(locked);
  }

  getRoomExists(): boolean {
    return this.ensureViewerRoomEngine().getRoomExists();
  }

  getRoomLocked(): boolean {
    return this.ensureViewerRoomEngine().getRoomLocked();
  }

  getRoomDimensions(): { width: number; depth: number; height: number } | null {
    return this.ensureViewerRoomEngine().getRoomDimensions();
  }

  hideRoom(): void {
    this.ensureViewerRoomEngine().hideRoom();
  }

  showRoom(): void {
    this.ensureViewerRoomEngine().showRoom();
  }

  getRoomVisible(): boolean {
    return this.ensureViewerRoomEngine().getRoomVisible();
  }

  setRoomFromManager(
    walls: WallEntryForViewer[],
    bounds: RoomBounds,
    group: THREE.Group
  ): void {
    setRoomFromManagerImpl(this.getRoomGeometryDeps(), walls, bounds, group);
  }

  clearRoomFromManager(): void {
    clearRoomFromManagerImpl(this.getRoomGeometryDeps());
  }

  setRoomBounds(bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }): void {
    setRoomBoundsImpl(this.getRoomGeometryDeps(), bounds);
  }

  clearRoomBounds(): void {
    clearRoomBoundsImpl(this.getRoomGeometryDeps());
  }

  /**
   * Reposiciona a câmera numa vista pré-definida.
   * Target sempre no centro do bounding box combinado (ou sala/origem).
   * Orientações: Frontal = -Z, Traseira = +Z, Esquerda = +X, Direita = -X, Superior = -Y, Inferior = +Y.
   * Nenhum auto-follow deve sobrescrever a orientação enquanto esta vista estiver ativa.
   */
  setCameraView(
    preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric"
  ): void {
    const bounds = this.getCombinedBoundingBox();
    let cx: number;
    let cy: number;
    let cz: number;
    let dist: number;

    if (bounds) {
      cx = (bounds.min.x + bounds.max.x) * 0.5;
      cy = (bounds.min.y + bounds.max.y) * 0.5;
      cz = (bounds.min.z + bounds.max.z) * 0.5;
      dist = Math.max(bounds.width, bounds.height, bounds.depth, 0.1) * 1.2;
    } else if (this.roomBounds) {
      cx = this.roomBounds.centerX;
      cy = (this.roomBounds.minY + this.roomBounds.maxY) * 0.5;
      cz = this.roomBounds.centerZ;
      const roomHeight = this.roomBounds.maxY - this.roomBounds.minY;
      const roomWidth = this.roomBounds.maxX - this.roomBounds.minX;
      const roomDepth = this.roomBounds.maxZ - this.roomBounds.minZ;
      dist = Math.max(roomWidth, roomDepth, roomHeight, 0.1) * 1.2;
    } else {
      cx = 0;
      cy = 0;
      cz = 0;
      dist = 2.5;
    }

    this.cameraEngine.applyPreset(
      preset,
      { x: cx, y: cy, z: cz },
      dist,
      this.controls
        ? {
            set: (x, y, z) =>
              this.syncCameraTarget(new THREE.Vector3(x, y, z), { updateLookAt: false }),
          }
        : null
    );
  }

  /** Aplica apenas a vista frontal padrão e limpa o preset (permite que auto-follow volte a atuar). */
  resetCamera(): void {
    this.cameraViewPreset = null;
    this.setCameraView("front");
  }

  /**
   * Enquadra a câmara numa caixa específica (centro no target, distância pelo FOV).
   */
  frameSelection(boxId: string): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    entry.mesh.updateMatrixWorld(true);
    runWithLayoutBoundsProxiesVisible(entry.mesh, () => {
      this._boxSingle.setFromObject(entry.mesh);
    });
    this._boxSingle.getCenter(this._center);
    this._boxSingle.getSize(this._size);
    const maxDim = Math.max(this._size.x, this._size.y, this._size.z, 0.1);
    const cam = this.cameraManager.camera;
    const fovRad = (cam.fov * Math.PI) / 180;
    const distance = Math.max(0.3, (maxDim / (2 * Math.tan(fovRad * 0.5))) * 1.2);
    const orbitTarget = this.controls?.controls.target ?? this.cameraManager.getTarget();
    const dir = new THREE.Vector3().subVectors(cam.position, orbitTarget);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0.2, 1);
    dir.normalize();
    cam.position.copy(this._center).addScaledVector(dir, distance);
    this.syncCameraTarget(this._center, { updateLookAt: false });
    cam.lookAt(this._center);
    this.controls?.update();
    return true;
  }

  setPlacementMode(mode: "door" | "window" | null): void {
    this.viewerState.setPlacementMode(mode);
  }

  setOnRoomElementPlaced(
    callback: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ): void {
    this.onRoomElementPlaced = callback;
  }

  setOnRoomElementSelected(
    callback: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ): void {
    this.onRoomElementSelected = callback;
  }

  setOnWallSelected(callback: ((_wallId: number | null) => void) | null): void {
    this.onWallSelected = callback;
  }

  setOnWallTransform(callback: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null): void {
    this.onWallTransform = callback;
  }

  setOnRoomElementTransform(callback: ((_elementId: string, _config: DoorWindowConfig) => void) | null): void {
    this.onRoomElementTransform = callback;
  }

  setOnRoomUtilitySelected(
    callback: ((_data: { utilityId: string; wallId: number; config: ProjectRoomUtility } | null) => void) | null
  ): void {
    this.onRoomUtilitySelected = callback;
  }

  setOnRoomUtilityTransform(
    callback: ((_utilityId: string, _patch: Pick<ProjectRoomUtility, "positionAlongWall" | "heightMm">) => void) | null
  ): void {
    this.onRoomUtilityTransform = callback;
  }

  updateRoomElementConfig(elementId: string, config: DoorWindowConfig): boolean {
    return this.roomBuilder.updateElementConfig(elementId, config);
  }

  addDoorToRoom(wallId: number, config: DoorWindowConfig, elementId?: string): string {
    const id = this.roomBuilder.addDoorByIndex(wallId, config, elementId);
    this.boundsCache.invalidateRoom();
    return id;
  }

  addWindowToRoom(wallId: number, config: DoorWindowConfig, elementId?: string): string {
    const id = this.roomBuilder.addWindowByIndex(wallId, config, elementId);
    this.boundsCache.invalidateRoom();
    return id;
  }

  getRoomWalls(): THREE.Mesh[] {
    return this.roomBoxWalls.map((w) => w.mesh);
  }

  /** Seleciona parede por índice (ex.: ao clicar na lista do painel). Atualiza gizmo e outline. */
  selectWallByIndex(index: number | null): void {
    selectWallByIndexImpl(this.getSelectionOpsDeps(), index);
  }

  selectRoomElementById(elementId: string | null): void {
    selectRoomElementByIdImpl(this.getSelectionOpsDeps(), elementId);
  }

  selectRoomUtilityById(utilityId: string | null): void {
    selectRoomUtilityByIdImpl(this.getSelectionOpsDeps(), utilityId);
  }

  setOnBoxSelected(callback: (_id: string | null) => void): void {
    this.onBoxSelected = callback;
  }

  setOnDoorLayerDoubleClick(callback: ((_boxId: string, _doorLayerId: string) => void) | null): void {
    this.onDoorLayerDoubleClick = callback;
  }

  setOnDrawerLayerDoubleClick(callback: ((_boxId: string, _drawerLayerId: string) => void) | null): void {
    this.onDrawerLayerDoubleClick = callback;
  }

  setOnDrawerLayerClick(callback: ((_boxId: string, _drawerLayerId: string) => void) | null): void {
    this.onDrawerLayerClick = callback;
  }

  setOnBoxDoubleClick(callback: ((_boxId: string) => void) | null): void {
    this.onBoxDoubleClick = callback;
  }

  setOnModelLoaded(callback: ((_boxId: string, _modelId: string, _object: THREE.Object3D) => void) | null): void {
    this.onModelLoaded = callback;
  }

  setOnBoxTransform(callback: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotation: { x: number; y: number; z: number }) => void) | null): void {
    this.onBoxTransform = callback;
  }

  setTransformMode(mode: "translate" | "rotate" | "scale" | null): void {
    setTransformModeImpl(this.getTransformOpsDeps(), mode);
  }

  /** Delega ao GizmoEngine / ViewerTools. */
  private refreshTransformControlsAttachment(): void {
    refreshTransformControlsAttachmentImpl(this.getTransformOpsDeps());
  }

  /**
   * Extension point interno preservado para EventsManager.
   * Contrato atual: NO-OP, porque o refresh é controlado pelo lifecycle de drag.
   */
  private setTransformAttachmentRefreshSuspended(_v: boolean): void {
    setTransformAttachmentRefreshSuspendedImpl(_v);
  }

  private refreshViewerAttachmentsAfterMeshMutation(): void {
    if (this.viewerState.getTransformControlsDragging()) return;
    this.sanitizeStaleViewerReferences();
    this.refreshTransformControlsAttachment();
    this.sanitizeStaleViewerReferences();
    this.refreshOutlineTarget();
    this.validateViewerMeshLifecycle("mesh-mutation");
  }

  private flushDeferredBoxStructureUpdates(): void {
    if (this.viewerState.getTransformControlsDragging()) return;
    if (this.pendingBoxStructureUpdates.size === 0) return;
    const pending = Array.from(this.pendingBoxStructureUpdates.entries());
    this.pendingBoxStructureUpdates.clear();
    pending.forEach(([boxId, options]) => {
      this.updateBox(boxId, options);
    });
  }

  private flushDeferredViewerVisualSyncs(): void {
    flushPendingFinishSync(
      this.pendingViewerVisualSync,
      this.viewerState.getTransformControlsDragging(),
      {
        orla: () => this.syncOrlaVisuals(),
        remate: () => this.syncRemateVisuals(),
        hemati: () => this.syncHematiVisuals(),
        rodape: () => this.syncRodapeVisuals(),
      }
    );
  }

  private isObjectAttachedToScene(object: THREE.Object3D | null | undefined): boolean {
    let current: THREE.Object3D | null | undefined = object;
    while (current) {
      if (current === this.sceneManager.scene) return true;
      current = current.parent;
    }
    return false;
  }

  private sanitizeStaleViewerReferences(): void {
    if (this.viewerState.getTransformControlsDragging()) return;
    const attached = this.transformControls?.object ?? null;
    if (attached && !this.isObjectAttachedToScene(attached)) {
      this.transformControls?.detach();
      if (this.transformControlsHelper) this.transformControlsHelper.visible = false;
    }
    sanitizeSelectionOutlineStaleTargetImpl(this.getSelectionOpsDeps());
  }

  private incrementLifecycleCount(map: Map<string, number>, id: unknown): void {
    if (typeof id !== "string" || id.length === 0) return;
    map.set(id, (map.get(id) ?? 0) + 1);
  }

  private collectDuplicateLifecycleIds(map: Map<string, number>): string[] {
    return Array.from(map.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
  }

  private validateViewerMeshLifecycle(reason: string): void {
    if (!import.meta.env.DEV) return;
    const boxRoots = new Map<string, number>();
    const remates = new Map<string, number>();
    const hematis = new Map<string, number>();
    const rodapes = new Map<string, number>();
    const staleBoxRoots: string[] = [];
    const staleFinishMeshes: string[] = [];
    const remateRodapeOverlap: string[] = [];

    this.sceneManager.scene.traverse((node) => {
      if (!node.visible) return;
      const boxId = node.userData?.boxId;
      if (typeof boxId === "string" && boxId.length > 0 && !this.boxes.has(boxId)) {
        staleFinishMeshes.push(`box:${boxId}`);
      }
      if (typeof boxId === "string" && this.boxes.get(boxId)?.mesh === node) {
        this.incrementLifecycleCount(boxRoots, boxId);
      } else if (typeof boxId === "string" && node.name === boxId && this.boxes.get(boxId)?.mesh !== node) {
        staleBoxRoots.push(boxId);
      }
      if (node.userData?.isRematePiece === true) {
        const remateId = node.userData?.remateId;
        this.incrementLifecycleCount(remates, remateId);
        if (node.userData?.remateTipo === "RODAPE" || node.userData?.remateTipo === "RODAPE_L") {
          remateRodapeOverlap.push(String(remateId ?? "unknown"));
        }
      }
      if (node.userData?.isHematiPiece === true && node.userData?.isHematiMergeVisual !== true) {
        this.incrementLifecycleCount(hematis, node.userData?.hematiId);
      }
      if (node.userData?.isRodapePiece === true && node.userData?.isRodapeMergeVisual !== true) {
        this.incrementLifecycleCount(rodapes, node.userData?.rodapeId);
      }
    });

    const issues = {
      duplicateBoxes: this.collectDuplicateLifecycleIds(boxRoots),
      duplicateRemates: this.collectDuplicateLifecycleIds(remates),
      duplicateHematis: this.collectDuplicateLifecycleIds(hematis),
      duplicateRodapes: this.collectDuplicateLifecycleIds(rodapes),
      staleBoxRoots,
      staleFinishMeshes: Array.from(new Set(staleFinishMeshes)),
      remateRodapeOverlap,
      staleTransformTarget: Boolean(this.transformControls?.object && !this.isObjectAttachedToScene(this.transformControls.object)),
      staleOutlineTarget: this.selectionOutline.hasStaleTarget((object) => this.isObjectAttachedToScene(object)),
    };
    const hasIssues = Object.values(issues).some((value) => Array.isArray(value) ? value.length > 0 : value);
    if (hasIssues) {
      devLogger.info("[ViewerCore][LifecycleValidation]", { reason, ...issues });
    }
  }

  selectBox(id: string | null): void {
    this.setSelectedBox(id);
  }

  /**
   * Subscreve alterações da caixa selecionada (mudança de seleção ou updateBox na caixa selecionada).
   * Retorna função para cancelar a assinatura.
   */
  subscribeSelectedBoxChange(callback: (_id: string | null) => void): () => void {
    this.selectedBoxChangeListeners.add(callback);
    return () => {
      this.selectedBoxChangeListeners.delete(callback);
    };
  }

  /** Aplica highlight na caixa (igual a selectBox; exposto para sincronização RightPanel ↔ Viewer). */
  highlightBox(id: string | null): void {
    // Guard-rail: highlight nunca deve limpar seleção ativa.
    // O clear de seleção deve ocorrer apenas por clique explícito fora de box (EventsManager).
    if (id == null) return;
    this.setSelectedBox(id);
  }

  /**
   * Orquestra formatos externos via ProjectLoader (Z-01.2.5).
   * Não aplica o resultado à cena — o ProjectState continua a ser a SSOT do Workspace.
   */
  loadExternalProject(input: ProjectLoadInput): ProjectLoadResult {
    return this.projectLoader.load(input);
  }

  addModelToBox(boxId: string, modelPath: string, modelId?: string): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    if (!modelPath || typeof modelPath !== "string") return false;
    const extension = this.getModelExtension(modelPath);
    if (!extension) return false;
    const id = modelId ?? this.getNextModelId();
    if (entry.cadModels.some((model) => model.id === id)) return false;
    const isCatalogModel = id.startsWith("catalog:");

    this.loadModelObject(modelPath, extension)
      .then((object) => {
        entry.mesh.add(object);
        object.traverse((child) => {
          child.userData.boxId = boxId;
          if (child.layers && typeof child.layers.set === "function") {
            child.layers.set(0);
          }
        });
        if (isCatalogModel) {
          object.userData.isCatalogGlb = true;
          this.storeCatalogBaseSize(object);
          if (entry.cadOnly) {
            this.applyCatalogModelScale(entry, object);
          }
        } else if (entry.cadOnly) {
          this.centerObjectInGroup(object);
        } else {
          object.position.set(0, entry.height / 2, 0);
        }
        entry.cadModels.push({ id, object, path: modelPath });
        syncEdgeOutlineRootImpl(this.getSelectionOpsDeps());
        this.onModelLoaded?.(boxId, id, object);
      })
      .catch(() => {
        // Falha silenciosa conforme especificado
      });

    return true;
  }

  /**
   * Normaliza o pivot do modelo: centro em X/Z na origem do grupo, base no chão (y=0).
   * Usado para modelos do Catálogo e CAD-only para que não nasçam com pivot no meio (centro da tela).
   * Altera apenas object.position (filho); a posição do grupo (entry.mesh) não é tocada.
   */
  private centerObjectInGroup(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(object);
    this._boundingBox.getCenter(this._center);
    this._boundingBox.getSize(this._size);
    object.position.x = -this._center.x;
    object.position.z = -this._center.z;
    object.position.y = this._size.y / 2;
  }

  /** Guarda o bounding box base do GLB para permitir escala por dimensão. */
  private storeCatalogBaseSize(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(object);
    this._boundingBox.getSize(this._size);
    object.userData.glbBaseSize = {
      x: Math.max(this._size.x, 0.001),
      y: Math.max(this._size.y, 0.001),
      z: Math.max(this._size.z, 0.001),
    };
  }

  /** Ajusta escala do GLB de catálogo e normaliza pivot (base no chão, centro XZ). Grupo não é movido. */
  private applyCatalogModelScale(
    entry: { width: number; height: number; depth: number },
    object: THREE.Object3D
  ): void {
    const base = object.userData.glbBaseSize as { x: number; y: number; z: number } | undefined;
    if (!base) return;
    const sx = entry.width / Math.max(base.x, 0.001);
    const sy = entry.height / Math.max(base.y, 0.001);
    const sz = entry.depth / Math.max(base.z, 0.001);
    object.scale.set(sx, sy, sz);
    this.centerObjectInGroup(object);
  }

  removeModelFromBox(boxId: string, modelId: string): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    const index = entry.cadModels.findIndex((model) => model.id === modelId);
    if (index === -1) return false;
    const [model] = entry.cadModels.splice(index, 1);
    if (model.object.parent) {
      model.object.parent.remove(model.object);
    }
    syncEdgeOutlineRootImpl(this.getSelectionOpsDeps());
    this.disposeObject(model.object);
    return true;
  }

  clearModelsFromBox(boxId: string): void {
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    entry.cadModels.forEach((model) => {
      if (model.object.parent) {
        model.object.parent.remove(model.object);
      }
      this.disposeObject(model.object);
    });
    entry.cadModels = [];
    syncEdgeOutlineRootImpl(this.getSelectionOpsDeps());
  }

  listModels(boxId: string): Array<{ id: string; path: string }> | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    return entry.cadModels.map((model) => ({ id: model.id, path: model.path }));
  }

  /** Dimensões da caixa em metros (para layout e auto-posicionamento). */
  getBoxDimensions(boxId: string): { width: number; height: number; depth: number } | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    return { width: entry.width, height: entry.height, depth: entry.depth };
  }

  getBoxWorldMatrix(boxId: string): THREE.Matrix4 | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    entry.mesh.updateMatrixWorld(true);
    return entry.mesh.matrixWorld.clone();
  }

  getRemateIdAtPointer(event: { clientX: number; clientY: number }): string | null {
    return this.pointerPicking.getRemateIdAtPointer(event);
  }

  /** Posição do modelo em espaço local da caixa (metros; origem no centro da caixa). */
  getModelPosition(boxId: string, modelId: string): { x: number; y: number; z: number } | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    const model = entry.cadModels.find((m) => m.id === modelId);
    if (!model) return null;
    const p = model.object.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Tamanho do bounding box do modelo em metros (largura, altura, profundidade). */
  getModelBoundingBoxSize(boxId: string, modelId: string): { width: number; height: number; depth: number } | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    const model = entry.cadModels.find((m) => m.id === modelId);
    if (!model) return null;
    entry.mesh.updateMatrixWorld(true);
    model.object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(model.object);
    const size = new THREE.Vector3();
    this._boundingBox.getSize(size);
    return { width: size.x, height: size.y, depth: size.z };
  }

  /** Define a posição do modelo em espaço local da caixa (metros; origem no centro da caixa). */
  setModelPosition(boxId: string, modelId: string, position: { x: number; y: number; z: number }): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    const model = entry.cadModels.find((m) => m.id === modelId);
    if (!model) return false;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return false;
    }
    model.object.position.set(position.x, position.y, position.z);
    return true;
  }

  setBoxGap(gap: number): boolean {
    this.boxGap = Math.max(0, gap);
    this.reflowBoxes();
    this.updateCameraTarget();
    return true;
  }

  /** LEGACY: alias mantido para integração histórica com useCalculadoraSync. */
  setBoxSpacing(spacing: number): boolean {
    return this.setBoxGap(spacing);
  }

  /** LEGACY: alias mantido para integração histórica com useCalculadoraSync. */
  updateBoxSpacing(spacing: number): boolean {
    return this.setBoxGap(spacing);
  }

  /**
   * Com lock ATIVADO: garante que o mesh não penetre abaixo de Y = 0.
   * Com lock DESATIVADO: não altera posição (permite atravessar o chão).
   */
  private applyFloorConstraint(mesh: THREE.Object3D): void {
    if (!this.lockEnabled) return;
    mesh.updateMatrixWorld(true);
    setBox3FromObjectExcludingLayoutProxy(this._boundingBox, mesh);
    if (this._boundingBox.min.y < 0) {
      mesh.position.y += -this._boundingBox.min.y;
      mesh.updateMatrixWorld(true);
    }
  }

  /**
   * Garante que a base de todas as caixas (sem manualPosition) fique em Y = 0.
   * Recalcula o bounding box real após exploded view e ajusta position.y para que min.y >= 0.
   * Chamado após o box estar totalmente construído (ex.: após applyExplodedViewForObject).
   */
  private ensureBoxesBaseAtFloor(): void {
    if (this.boxes.size === 0) return;
    this.boxes.forEach((entry) => entry.mesh.updateMatrixWorld(true));
    this._boundingBox.makeEmpty();
    this.boxes.forEach((entry) =>
      expandBox3ByObjectExcludingLayoutProxy(this._boundingBox, entry.mesh)
    );
    const minY = this._boundingBox.min.y;
    if (minY >= 0) return;
    const shiftUp = -minY;
    this.boxes.forEach((entry) => {
      if (!entry.manualPosition) {
        entry.mesh.position.y += shiftUp;
      }
    });
    this.boxes.forEach((entry) => entry.mesh.updateMatrixWorld(true));
  }

  /**
   * Posiciona caixas sem manualPosition lado a lado em X/Z.
   * manualPosition === true: NUNCA alterar position.x, position.y nem position.z.
   */
  reflowBoxes() {
    this.boxManager.reflowBoxes(this.boxGap);
  }

  private getCameraOpsDeps(): ViewerCoreCameraOpsDeps {
    return {
      cameraManager: this.cameraManager,
      controls: this.controls,
      boxes: this.boxes,
      cameraViewPreset: this.cameraViewPreset,
      boundingBox: this._boundingBox,
      center: this._center,
      boxSingle: this._boxSingle,
      size: this._size,
      projScreenMatrix: this._projScreenMatrix,
      frustum: this._frustum,
    };
  }

  private getFeetOpsDeps(): ViewerCoreFeetOpsDeps {
    return {
      heightBaseCm: ViewerCore.HEIGHT_BASE_CM,
      heightUpperCm: ViewerCore.HEIGHT_UPPER_CM,
      feetFrontInsetM: ViewerCore.FEET_FRONT_INSET_M,
      feetBackInsetM: ViewerCore.FEET_BACK_INSET_M,
      feetSideInsetM: ViewerCore.FEET_SIDE_INSET_M,
    };
  }

  private getRoomUtilsDeps(): ViewerCoreRoomUtilsDeps {
    return {
      getRoomBounds: () => this.roomBounds,
      lockEnabled: this.lockEnabled,
      wallInnerInsetM: ViewerCore.WALL_INNER_INSET_M,
      snapWallOffsetM: ViewerCore.SNAP_WALL_OFFSET_M,
      boundingBox: this._boundingBox,
      boundsCache: this.boundsCache,
      roomBuilder: this.roomBuilder,
    };
  }

  private getDisplayOpsDeps(): ViewerCoreDisplayOpsDeps {
    return getDisplayEngineApiImpl(this.getEngineApisOpsDeps());
  }

  private getIndustrialModeDeps(): ViewerCoreIndustrialModeDeps {
    return getIndustrialEngineApiImpl(this.getEngineApisOpsDeps());
  }

  private getRoomGeometryDeps(): ViewerCoreRoomGeometryDeps {
    return getRoomEngineApiImpl(this.getEngineApisOpsDeps());
  }

  private getSelectionOpsDeps(): ViewerCoreSelectionOpsDeps {
    return getSelectionEngineApiImpl(this.getEngineApisOpsDeps());
  }

  private getFinishOpsDeps(): ViewerCoreFinishOpsDeps {
    return getFinishOpsDepsImpl(this.getEngineApisOpsDeps());
  }

  private getTransformOpsDeps(): ViewerCoreTransformOpsDeps {
    return getTransformOpsDepsImpl(this.getEngineApisOpsDeps());
  }

  /** Mantém CameraManager.target e OrbitControls.target sincronizados. */
  private syncCameraTarget(
    center: THREE.Vector3,
    options?: { updateLookAt?: boolean }
  ): void {
    syncCameraTargetImpl(this.getCameraOpsDeps(), center, options);
  }

  private updateCameraTarget() {
    updateCameraTargetImpl(this.getCameraOpsDeps());
  }

  /**
   * Centro do bounding box real do box em mundo (atualiza matriz antes).
   */
  private getBoxBoundingBoxCenter(boxId: string): THREE.Vector3 | null {
    return getBoxBoundingBoxCenterImpl(this.getCameraOpsDeps(), boxId);
  }

  /**
   * True se o box está (parcialmente) dentro do frustum da câmera.
   */
  private isBoxInCameraFrame(boxId: string): boolean {
    return isBoxInCameraFrameImpl(this.getCameraOpsDeps(), boxId);
  }

  /**
   * Ajusta a posição da câmera para que o box entre no enquadramento (sem saltos bruscos).
   * Só altera a distância ao alvo para caber o box no FOV.
   */
  private adjustCameraPositionToIncludeBox(boxId: string): void {
    adjustCameraPositionToIncludeBoxImpl(this.getCameraOpsDeps(), boxId);
  }

  /**
   * Auto-follow: atualiza o alvo da câmera para o centro do box (sempre o objeto editado).
   * Só move a posição da câmera se onlyMovePositionIfOutOfFrame e o box estiver fora do enquadramento.
   * Com vista pré-definida ativa, só atualiza o alvo (não altera orientação nem posição).
   */
  private updateCameraTargetToBox(
    boxId: string,
    options?: { onlyMovePositionIfOutOfFrame?: boolean }
  ): void {
    const center = this.getBoxBoundingBoxCenter(boxId);
    if (!center) return;

    if (this.cameraViewPreset != null) {
      this.syncCameraTarget(center, { updateLookAt: false });
      return;
    }

    this.syncCameraTarget(center);
    const onlyIfOut = options?.onlyMovePositionIfOutOfFrame === true;
    if (onlyIfOut && !this.isBoxInCameraFrame(boxId)) {
      this.adjustCameraPositionToIncludeBox(boxId);
    }
  }

  private shouldUseFeetLock(entry: {
    cabinetType?: "lower" | "upper";
    feetEnabled?: boolean;
  }): boolean {
    return shouldUseFeetLockImpl(entry);
  }

  /** Altura Y (m) fixa para caixas inferiores com pés ativos. */
  private getFixedYForCabinet(entry: {
    height: number;
    cabinetType?: "lower" | "upper";
    pe_cm?: number;
  }): number {
    return getFixedYForCabinetImpl(this.getFeetOpsDeps(), entry);
  }

  private syncFeetVisualForBox(
    entry: {
      mesh: THREE.Object3D;
      width: number;
      height: number;
      depth: number;
      cabinetType?: "lower" | "upper";
      pe_cm?: number;
      feetHeight?: number;
      feetOffsetFront?: number;
      feetEnabled?: boolean;
    }
  ): void {
    syncFeetVisualForBoxImpl(this.getFeetOpsDeps(), entry);
  }

  private getNextBoxIndex() {
    return this.boxSceneController.getNextBoxIndex(this.boxes);
  }

  private getNextModelId() {
    this.modelCounter += 1;
    return `model-${this.modelCounter}`;
  }

  private getModelExtension(path: string) {
    const lower = path.toLowerCase();
    // Data URLs (ex.: upload GLB em base64) não têm extensão no fim
    if (lower.startsWith("data:")) {
      if (lower.includes("gltf-binary") || lower.includes("model/gltf") || lower.includes("model/gltf-binary")) return "glb";
      if (lower.includes("model/gltf+json")) return "gltf";
      return null;
    }
    const match = lower.match(/\.(glb|gltf|obj|stl)$/);
    return match ? match[1] : null;
  }

  private loadModelObject(path: string, extension: string): Promise<THREE.Object3D> {
    if (extension === "glb" || extension === "gltf") {
      return this.projectLoader.loadGlbScene(path);
    }
    if (extension === "obj") {
      const loader = new OBJLoader();
      return loader.loadAsync(path);
    }
    if (extension === "stl") {
      const loader = new STLLoader();
      return loader.loadAsync(path).then((geometry) => {
        const material = new THREE.MeshStandardMaterial({ color: "#d1d5db", roughness: 0.8 });
        return new THREE.Mesh(geometry, material);
      });
    }
    return Promise.reject(new Error("Unsupported model format"));
  }

  private updateModelsVerticalPosition(entry: {
    cadModels: Array<{ object: THREE.Object3D }>;
    height: number;
  }) {
    entry.cadModels.forEach((model) => {
      model.object.position.y = entry.height / 2;
    });
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /** API mínima para o EventsManager (handlers de canvas). */
  private getEventEngineApi(): IViewerEventEngine {
    return buildEventEngineApiImpl(this.getEngineApisOpsDeps());
  }

  private getEventOpsDeps(): ViewerCoreEventOpsDeps {
    return getEventOpsDepsImpl(this.getEngineApisOpsDeps());
  }

  /** API mínima para o ViewerTools (attachment, outline, clamp). */
  private getToolsEngineApi(): IViewerToolsEngine {
    return buildToolsEngineApiImpl(this.getEngineApisOpsDeps());
  }

  private getToolsOpsDeps(): ViewerCoreToolsOpsDeps {
    return getToolsOpsDepsImpl(this.getEngineApisOpsDeps());
  }

  private setOutlineTarget(mesh: THREE.Object3D | null, opacity: number, colorHex: number): void {
    setOutlineTargetImpl(this.getSelectionOpsDeps(), mesh, opacity, colorHex);
  }

  /** Obtém boxId a partir de um mesh (grupo ou filho/GLB); sobe na hierarquia até encontrar userData.boxId ou o grupo da caixa. */
  private getBoxIdByMesh(mesh: THREE.Object3D): string | null {
    return getBoxIdByMeshImpl(this.getEventOpsDeps(), mesh);
  }

  private setSelectedBox(id: string | null, options?: { preserveGroupMembers?: boolean }) {
    setSelectedBoxImpl(this.getSelectionOpsDeps(), id, options);
  }

  /**
   * Listener único de objectChange — protegido contra reentrância quando Lock/colisão
   * altera mesh.position e o TransformControls re-emite objectChange na mesma stack.
   */
  private handleTransformObjectChange(): void {
    handleTransformObjectChangeImpl(this.getTransformOpsDeps());
  }

  /** Fim de drag unificado — evita duplicação mouseUp + dragging-changed. */
  private finishTransformDrag(_source: "mouseUp" | "dragging-changed"): void {
    finishTransformDragImpl(this.getTransformOpsDeps(), _source);
  }

  private notifyRemateTransform(): void {
    const remateId = this.viewerState.getSelectedRemate();
    if (!remateId) return;
    const rawMesh = this.getRemateMesh(remateId);
    const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
    if (!mesh) return;
    const p = mesh.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      console.warn("[sanity] posição inválida em notifyRemateTransform — ignorado");
      return;
    }
    const boxId = mesh.userData.boxId as string | undefined;
    const entry = boxId ? this.boxes.get(boxId) : undefined;

    const tool = this.viewerState.getCurrentTool();
    if (tool === "scale") {
      if (!(mesh instanceof THREE.Mesh)) return;
      mesh.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      mesh.geometry.boundingBox?.getSize(size);
      const widthMm = Math.max(1, size.x * mesh.scale.x * 1000);
      const heightMm = Math.max(1, size.y * mesh.scale.y * 1000);
      const depthMm = Math.max(1, size.z * mesh.scale.z * 1000);
      mesh.scale.set(1, 1, 1);
      this.onRemateTransform?.(remateId, {
        width: widthMm,
        height: heightMm,
        depth: depthMm,
        placementMode: "FREE",
        isInitialPlacement: false,
      });
      return;
    }

    const buildRemateTransformPatch = (
      position: { xMm: number; yMm: number; zMm: number },
      rotation: { xRad: number; yRad: number; zRad: number }
    ) => ({
      position,
      rotation,
      transform: {
        xMm: position.xMm,
        yMm: position.yMm,
        zMm: position.zMm,
        rotacaoXRad: rotation.xRad,
        rotacaoYRad: rotation.yRad,
        rotacaoZRad: rotation.zRad,
      },
      placementMode: "FREE" as const,
      isInitialPlacement: false,
    });

    if (entry?.mesh && boxId) {
      entry.mesh.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(entry.mesh.matrixWorld).invert();
      const local = mesh.position.clone().applyMatrix4(inv);
      const localQuat = new THREE.Quaternion().copy(mesh.quaternion);
      const boxQuat = new THREE.Quaternion().setFromRotationMatrix(entry.mesh.matrixWorld);
      const invBoxQuat = boxQuat.clone().invert();
      localQuat.premultiply(invBoxQuat);
      const euler = new THREE.Euler().setFromQuaternion(localQuat);

      const position = {
        xMm: local.x * 1000,
        yMm: local.y * 1000,
        zMm: local.z * 1000,
      };
      const rotation = { xRad: euler.x, yRad: euler.y, zRad: euler.z };

      const piece = this.remateVisualBridge?.listRematePieces().find((r) => r.id === remateId);
      if (piece && isLRematePiece(piece)) {
        this.onRemateTransform?.(remateId, buildRemateTransformPatch(position, rotation));
        return;
      }

      this.onRemateTransform?.(remateId, buildRemateTransformPatch(position, rotation));
      return;
    }

    const position = {
      xMm: mesh.position.x * 1000,
      yMm: mesh.position.y * 1000,
      zMm: mesh.position.z * 1000,
    };
    const rotation = {
      xRad: mesh.rotation.x,
      yRad: mesh.rotation.y,
      zRad: mesh.rotation.z,
    };
    this.onRemateTransform?.(remateId, buildRemateTransformPatch(position, rotation));
  }

  private notifyHematiTransform(): void {
    const hematiId = this.viewerState.getSelectedHemati();
    if (!hematiId) return;
    const mesh = this.hematiVisualizer.getMeshByHematiId(hematiId);
    if (!mesh) return;
    const boxId = mesh.userData.boxId as string | undefined;
    if (!boxId) return;
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    entry.mesh.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(entry.mesh.matrixWorld).invert();
    const local = mesh.position.clone().applyMatrix4(inv);
    this.onHematiTransform?.(hematiId, {
      transform: {
        xMm: local.x * 1000,
        yMm: local.y * 1000,
        zMm: local.z * 1000,
        rotacaoXRad: mesh.rotation.x,
        rotacaoYRad: mesh.rotation.y,
        rotacaoZRad: mesh.rotation.z,
      },
      placementFree: true,
    });
  }

  private notifyRodapeTransform(): void {
    const rodapeId = this.viewerState.getSelectedRodape();
    if (!rodapeId) return;
    const mesh = this.rodapeVisualizer.getMeshByRodapeId(rodapeId);
    if (!mesh) return;
    const boxId = mesh.userData.boxId as string | undefined;
    if (!boxId) return;
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    entry.mesh.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(entry.mesh.matrixWorld).invert();
    const local = mesh.position.clone().applyMatrix4(inv);
    this.onRodapeTransform?.(rodapeId, {
      transform: {
        xMm: local.x * 1000,
        yMm: local.y * 1000,
        zMm: local.z * 1000,
        rotacaoXRad: mesh.rotation.x,
        rotacaoYRad: mesh.rotation.y,
        rotacaoZRad: mesh.rotation.z,
      },
      placementFree: true,
      isInitialPlacement: false,
    });
  }

  private notifyDivSepTransform(): void {
    const selection = this.viewerState.getSelectedDivSep();
    if (!selection) return;
    const mesh = this.getDivSepMesh(selection);
    const entry = this.boxes.get(selection.boxId);
    const ctx = this.divSepVisualBridge?.getDivSepDragContext(
      selection.boxId,
      selection.kind,
      selection.itemId
    );
    if (!mesh || !entry || !ctx) return;

    const positionMm =
      selection.kind === "sep"
        ? separadorLocalYToPositionMm(
            mesh.position.y,
            entry.height,
            ctx.box,
            ctx.item as SeparadorItem
          )
        : divisorLocalXToPositionMm(
            mesh.position.x,
            entry.width,
            ctx.box,
            ctx.item as DivisorItem
          );

    this.onDivSepTransform?.({
      boxId: selection.boxId,
      kind: selection.kind,
      itemId: selection.itemId,
      positionMm,
    });
  }

  /**
   * Após sync visual (painel/teclado), reaplica colisão e propaga posição corrigida ao estado.
   */
  resolveFinishCollisionAfterSync(params: { remateId?: string; rodapeId?: string }): void {
    const { remateId, rodapeId } = params;
    if (remateId) {
      const rawMesh = this.getRemateMesh(remateId);
      const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
      if (!mesh) return;
      const piece = this.remateVisualBridge?.listRematePieces().find((r) => r.id === remateId);
      if (isTampoAngularConfig(piece?.angleConfig, piece?.height)) return;
      const boxId = piece?.parentBoxId ?? (mesh.userData.boxId as string | undefined);
      this.applyFinishCollisionConstraint(mesh, boxId, remateId);
      const prev = this.viewerState.getSelectedRemate();
      if (prev !== remateId) this.viewerState.setSelectedRemate(remateId);
      this.notifyRemateTransform();
      if (prev !== remateId) this.viewerState.setSelectedRemate(prev);
      return;
    }
    if (rodapeId) {
      const mesh = this.rodapeVisualizer.getMeshByRodapeId(rodapeId);
      if (!mesh) return;
      const boxId = mesh.userData.boxId as string | undefined;
      this.applyFinishCollisionConstraint(mesh, boxId, undefined, rodapeId);
      const prev = this.viewerState.getSelectedRodape();
      if (prev !== rodapeId) this.viewerState.setSelectedRodape(rodapeId);
      this.notifyRodapeTransform();
      if (prev !== rodapeId) this.viewerState.setSelectedRodape(prev);
    }
  }

  private applyFinishCollisionConstraint(
    movingMesh: THREE.Object3D,
    excludeBoxId: string | undefined,
    excludeRemateId?: string,
    excludeRodapeId?: string
  ): void {
    if (!this.lockEnabled) return;
    if (excludeRemateId) {
      const piece = this.remateVisualBridge?.listRematePieces().find((r) => r.id === excludeRemateId);
      if (isTampoAngularConfig(piece?.angleConfig, piece?.height)) return;
    }

    const excludeRemateIds = new Set<string>();
    if (excludeRemateId) {
      for (const id of listRemateIdsInSameLComposite(
        excludeRemateId,
        this.remateVisualBridge?.listRematePieces() ?? []
      )) {
        excludeRemateIds.add(id);
      }
    }

    const otherMeshes: THREE.Object3D[] = [];
    const seenMeshUuids = new Set<string>();
    for (const piece of this.remateVisualBridge?.listRematePieces() ?? []) {
      if (excludeRemateIds.has(piece.id)) continue;
      const mesh = this.getRemateMesh(piece.id);
      if (!mesh || mesh === movingMesh || seenMeshUuids.has(mesh.uuid)) continue;
      seenMeshUuids.add(mesh.uuid);
      otherMeshes.push(mesh);
    }
    for (const cfg of this.rodapeVisualBridge?.listBoxRodapeConfigs() ?? []) {
      for (const rodape of cfg.rodapes) {
        if (rodape.id === excludeRodapeId) continue;
        const mesh = this.rodapeVisualizer.getMeshByRodapeId(rodape.id);
        if (mesh) otherMeshes.push(mesh);
      }
    }

    const parentBoxEntry =
      excludeBoxId && this.boxes.has(excludeBoxId)
        ? (() => {
            const entry = this.boxes.get(excludeBoxId)!;
            return {
              boxId: excludeBoxId,
              mesh: entry.mesh,
              width: entry.width,
              height: entry.height,
              depth: entry.depth,
            };
          })()
        : undefined;

    applyFinishMovementConstraints({
      movingMesh,
      boxes: this.boxes,
      otherMeshes,
      parentBox: parentBoxEntry,
      applyFloorConstraint: (mesh) => this.applyFloorConstraint(mesh),
      roomBounds: this.roomBounds,
      roomWallMeshes: this.roomBoxWalls.map((w) => w.mesh),
      isInsideRoom: (mesh) => this.isMeshInsideOrTouchingRoom(mesh),
    });
  }

  private buildSmartAlignSnapContextForDrag() {
    return buildSmartAlignSnapContextForDragImpl(this.getSnappingOpsDeps());
  }

  private syncSmartAlignSnapOverlayFromEngine(): void {
    syncSmartAlignSnapOverlayFromEngineImpl(this.getSnappingOpsDeps());
  }

  private applyDynamicAlignSnap(params: SnapAlignTarget): void {
    applyDynamicAlignSnapImpl(this.getSnappingOpsDeps(), params);
  }

  private buildDisabledSmartSnapContext() {
    return buildDisabledSmartSnapContextImpl(this.getSnappingOpsDeps());
  }

  private generateIntelligentDesigns(seedBoxId: string): boolean {
    const designs = this.ensureIntelligentDesigner().buildDesigns(seedBoxId);
    if (!designs.length) return false;
    const overlays = this.layoutEngine.predictive.previewDesigns(
      designs.map((d) => ({ id: d.id, plan: d.plan, label: d.label }))
    );
    if (overlays[0]) {
      this.smartAlignOverlay.setState(
        this.layoutEngine.predictive.showDesignPreview(0) ?? { visible: false, mode: "predictive", guides: [] }
      );
    }
    return true;
  }

  private previewIntelligentDesign(id: DesignVariantId): boolean {
    const state = this.layoutEngine.predictive.showDesignById(id);
    if (!state) return false;
    this.smartAlignOverlay.setState(state);
    return true;
  }

  private applyIntelligentDesign(id: DesignVariantId): boolean {
    const ok = this.ensureIntelligentDesigner().applyDesign(id);
    if (ok) this.clearSmartAlignSnapOverlay();
    return ok;
  }

  private acceptPredictiveLayoutPending(): boolean {
    const pending = this.layoutEngine.predictive.getPending();
    if (!pending) return false;
    const previews = this.layoutEngine.predictive.getDesignPreviews();
    const activeEntry = previews[this.layoutEngine.predictive.getActiveDesignIndex()];
    const ok = this.layoutEngine.predictive.applyPending();
    if (ok) {
      if (activeEntry && isEnvironmentStyleId(activeEntry.id)) {
        this.ensureIntelligentDesigner().getBehaviorStore().learnStylePreference(activeEntry.id);
      }
      this.clearSmartAlignSnapOverlay();
    }
    return ok;
  }

  private acceptConversationalPending(): boolean {
    const pending = this.layoutEngine.predictive.getPending();
    if (!pending) return false;
    const ok = this.acceptPredictiveLayoutPending();
    if (ok) {
      this.designConversationState.recordApplied({
        plan: pending.plan,
        label: pending.label,
      });
    }
    return ok;
  }

  private previewIntelligentStyle(styleId: EnvironmentStyleId, seedBoxId: string): boolean {
    const result = this.ensureIntelligentDesigner().buildStyleDesign(styleId, seedBoxId);
    if (!result) return false;
    const { overlay } = buildPredictiveLayoutResult(this.layoutEngine.predictive, result.plan, result.label);
    this.layoutEngine.predictive.previewDesigns([{ id: styleId, plan: result.plan, label: result.label }]);
    this.smartAlignOverlay.setState(overlay);
    return true;
  }

  private applyIntelligentStyle(styleId: EnvironmentStyleId, seedBoxId: string): boolean {
    const ok = this.ensureIntelligentDesigner().applyStyle(styleId, seedBoxId);
    if (ok) this.clearSmartAlignSnapOverlay();
    return ok;
  }

  private resolveCostSeedBoxId(): string {
    return (
      this.designConversationState.getSeedBoxId() ??
      this.smartLayoutBridge?.getWorkspaceBoxes().find((b) => !b.locked)?.id ??
      ""
    );
  }

  private buildCostScanContext(): import("./snapping/costTypes").CostScanContext {
    const ctx = this.buildManufacturingScanContext();
    return {
      boxes: ctx.boxes,
      remates: ctx.remates,
      rodapes: ctx.rodapes,
      bounds: ctx.bounds,
      openings: ctx.openings,
      wallOffsetMm: ctx.wallOffsetMm,
    };
  }

  private previewCostSuggestion(suggestion: CostSuggestion): void {
    const { overlay } = buildPredictiveLayoutResult(
      this.layoutEngine.predictive,
      suggestion.plan,
      suggestion.label
    );
    this.layoutEngine.predictive.previewDesigns([
      { id: `cost-${suggestion.kind}`, plan: suggestion.plan, label: suggestion.label },
    ]);
    this.smartAlignOverlay.setState(overlay);
  }

  private previewCostSuggestionByTier(
    seedBoxId: string,
    tier: "cheaper" | "premium" | "balanced"
  ): boolean {
    this.designConversationState.setSeedBoxId(seedBoxId);
    this.ensureCostReportEngine().scanProject();
    const suggestion =
      tier === "cheaper"
        ? this.ensureCostReportEngine().suggestCheaperAlternative()
        : tier === "premium"
          ? this.ensureCostReportEngine().suggestPremiumAlternative()
          : this.ensureCostReportEngine().suggestBalancedAlternative();
    if (!suggestion) return false;
    this.previewCostSuggestion(suggestion);
    return true;
  }

  private buildManufacturingScanContext(): import("./snapping/manufacturingTypes").ManufacturingScanContext {
    const bridge = this.smartLayoutBridge;
    const rodapeConfigs = this.rodapeVisualBridge?.listBoxRodapeConfigs() ?? [];
    const rodapes = rodapeConfigs.flatMap((cfg) => cfg.rodapes);
    return {
      boxes: bridge?.getWorkspaceBoxes() ?? [],
      remates: this.remateVisualBridge?.listRematePieces() ?? [],
      rodapes,
      bounds: bridge?.getRoomBoundsMm() ?? null,
      openings: bridge?.getOpeningsMm() ?? [],
      wallOffsetMm: bridge?.getWallOffsetMm() ?? this.smartSnappingEngine.getWallOffset(),
    };
  }

  private previewManufacturingFixes(): boolean {
    const fixPlan = this.ensureManufacturingReportEngine().buildFixPreview();
    if (!fixPlan || !fixPlan.plan.moveBoxes.length) return false;
    const { overlay } = buildPredictiveLayoutResult(
      this.layoutEngine.predictive,
      fixPlan.plan,
      fixPlan.label
    );
    this.layoutEngine.predictive.previewDesigns([
      { id: "manufacturing-fix", plan: fixPlan.plan, label: fixPlan.label },
    ]);
    this.smartAlignOverlay.setState(overlay);
    return true;
  }

  private applyManufacturingSuggestedFixes(): boolean {
    const pending = this.layoutEngine.predictive.getPending();
    if (pending?.label.includes("Auto-Manufacturing")) {
      return this.acceptPredictiveLayoutPending();
    }
    const result = this.ensureManufacturingReportEngine().autoFix();
    return result.ok;
  }

  private generateIntelligentVariations(): boolean {
    const variations = this.ensureIntelligentDesigner().generateVariations();
    if (!variations.length) return false;
    const overlays = this.layoutEngine.predictive.previewDesigns(
      variations.map((v, i) => ({
        id: `V${i + 1}`,
        plan: v.plan,
        label: v.label,
      }))
    );
    if (overlays[0]) {
      this.smartAlignOverlay.setState(
        this.layoutEngine.predictive.showDesignPreview(0) ?? { visible: false, mode: "predictive", guides: [] }
      );
    }
    return true;
  }

  private clearSmartAlignSnapOverlay(): void {
    clearSmartAlignSnapOverlayImpl(this.getSnappingOpsDeps());
  }

  private previewSmartWallFill(wallId: string | number, moduleBoxId: string): boolean {
    const plan = this.layoutEngine.buildWallFillPlan(wallId, moduleBoxId);
    if (!plan) return false;
    const { overlay } = buildPredictiveLayoutResult(
      this.layoutEngine.predictive,
      plan,
      "Auto-Wall-Fill sugerido"
    );
    this.smartAlignOverlay.setState(overlay);
    return true;
  }

  /** Só chamado em objectChange (arraste do utilizador). Nunca na criação da caixa. */
  private clampTransform() {
    clampTransformImpl(this.getTransformOpsDeps());
  }

  private computeDistanceToNearestBox(): RulerMeasurementHit | null {
    return computeParametricDistanceToNearestBox({
      boxes: this.boxes,
      selectedBoxId: this.viewerState.getSelectedBox(),
      roomBounds: this.roomBounds,
    });
  }

  private computeDistanceToNearestWall(): RulerMeasurementHit | null {
    return computeParametricDistanceToNearestWall({
      boxes: this.boxes,
      selectedBoxId: this.viewerState.getSelectedBox(),
      roomBounds: this.roomBounds,
    });
  }

  private computeDistanceToFloor(): RulerMeasurementHit | null {
    return computeParametricDistanceToFloor({
      boxes: this.boxes,
      selectedBoxId: this.viewerState.getSelectedBox(),
      roomBounds: this.roomBounds,
    });
  }

  /** Atualiza o conjunto de caixas que intersectam paredes (para destaque quando lock desativado). */
  private updateBoxesIntersectingWalls(): void {
    this.boxesIntersectingWalls.clear();
    if (this.lockEnabled) return;
    const roomWalls = this.roomBoxWalls.map((w) => w.mesh);
    if (!roomWalls.length) return;
    const wallBox = new THREE.Box3();
    roomWalls.forEach((wall) => {
      wall.updateMatrixWorld(true);
      wallBox.union(new THREE.Box3().setFromObject(wall));
    });
    this.boxes.forEach((entry, boxId) => {
      entry.mesh.updateMatrixWorld(true);
      const box = new THREE.Box3();
      setBox3FromObjectExcludingLayoutProxy(box, entry.mesh);
      if (box.intersectsBox(wallBox)) this.boxesIntersectingWalls.add(boxId);
    });
  }

  /** Esconde a parede que está entre a câmera e o centro da sala. */
  private updateWallVisibilityBasedOnCamera(): void {
    updateWallVisibilityBasedOnCameraImpl(this.getRoomGeometryDeps());
  }

  /** Esconde/mostra uma parede manualmente. Auto-hide continua ativo. */
  setManualWallHidden(active: boolean): void {
    setManualWallHiddenImpl(this.getRoomGeometryDeps(), active);
  }

  getManualWallHidden(): boolean {
    return getManualWallHiddenImpl(this.getRoomGeometryDeps());
  }

  private applyRoomConstraint(movingMesh: THREE.Object3D, options: { ignoreY?: boolean } = {}): void {
    applyRoomConstraintImpl(this.getRoomUtilsDeps(), movingMesh, options);
  }

  /** Recuo (m) do limite interno da parede; com lock ON a caixa não entra no muro. */
  private static readonly WALL_INNER_INSET_M = 0.06;
  /** Offset (m) da caixa em relação ao plano da parede para evitar Z-fighting (0.5 cm). */
  private static readonly SNAP_WALL_OFFSET_M = 0.005;
  /** Altura da base do armário inferior (PE) em cm; base da caixa fica a esta altura do piso. */
  private static readonly HEIGHT_BASE_CM = 10;
  /** Altura em cm do piso à base da caixa superior (wall cabinet). */
  private static readonly HEIGHT_UPPER_CM = 150;
  /** Recuo frontal dos pés (m): 100 mm. */
  private static readonly FEET_FRONT_INSET_M = 0.1;
  /** Recuo traseiro dos pés (m). */
  private static readonly FEET_BACK_INSET_M = 0.06;
  /** Recuo lateral dos pés (m). */
  private static readonly FEET_SIDE_INSET_M = 0.06;

  private isMeshInsideOrTouchingRoom(movingMesh: THREE.Object3D, tolerance = 0.02): boolean {
    return isMeshInsideOrTouchingRoomImpl(this.getRoomUtilsDeps(), movingMesh, tolerance);
  }

  private getRoomOpeningsForSnapping(): import("./snapping/smartSnappingTypes").RoomOpeningLike[] {
    return getRoomOpeningsForSnappingImpl(this.getRoomUtilsDeps());
  }

  private clearSnapState(object: THREE.Object3D): void {
    clearSnapStateImpl(object);
  }

  private getSnappingOpsDeps(): ViewerCoreSnappingOpsDeps {
    return getSnappingOpsDepsImpl(this.getEngineApisOpsDeps());
  }

  private notifyWallTransform(): void {
    notifyWallTransformImpl(this.getRoomGeometryDeps());
  }

  private notifyRoomElementTransform(): void {
    notifyRoomElementTransformImpl(this.getRoomGeometryDeps());
  }

  private notifyRoomUtilityTransform(): void {
    notifyRoomUtilityTransformImpl(this.getRoomGeometryDeps());
  }

  private getRoomUtilityById(utilityId: string): THREE.Object3D | null {
    return getRoomUtilityByIdImpl(this.getRoomGeometryDeps(), utilityId);
  }

  private loadMaterial(materialName: string): LoadedWoodMaterial | null {
    ensureMaterialEngine();
    return this.materialPipeline.loadMaterial(materialName, this.materialQuality);
  }

  /** Delega ao ViewerTools. */
  private refreshOutlineTarget(): void {
    refreshOutlineTargetImpl(this.getSelectionOpsDeps());
  }

  private setHoveredBox(id: string | null) {
    setHoveredBoxImpl(this.getSelectionOpsDeps(), id);
  }

  private setHoveredRemate(id: string | null) {
    setHoveredRemateImpl(this.getSelectionOpsDeps(), id);
  }

  /**
   * Obtém boxId a partir de um mesh (para uso externo, ex.: régua).
   */
  getBoxIdByMeshPublic(mesh: THREE.Object3D): string | null {
    return this.getBoxIdByMesh(mesh);
  }

  /**
   * Retorna o alvo do ponteiro para o menu de contexto: porta, gaveta ou null (módulo/canvas).
   * Raycast nos boxes; para o primeiro hit que tenha getDoorLayerIdByMesh ou getDrawerLayerIdByMesh, devolve boxId + type + doorLayerId/drawerLayerId.
   * Depende de userData.doorLayerId propagado em createDoorObject e de userData.boxId em applyPanelIdsToBox.
   */
  getContextMenuLayerHit(event: { clientX: number; clientY: number }): MouseMenuTarget | null {
    return this.pointerPicking.getContextMenuLayerHit(event);
  }

  private updateCanvasSize = () => {
    updateCanvasSizeImpl(this.getRuntimeOpsDeps());
  };

  private start() {
    startRuntimeImpl(this.getRuntimeOpsDeps());
  }

  private onBeforeRenderTick(): void {
    onBeforeRenderTickImpl(this.getRuntimeOpsDeps());
  }

  private getRuntimeOpsDeps(): ViewerCoreRuntimeOpsDeps {
    return getRuntimeOpsDepsImpl(this.getEngineApisOpsDeps());
  }

  saveSnapshot(): import("../../context/projectTypes").ViewerSnapshot | null {
    return this.snapshotRenderer?.saveSnapshot() ?? null;
  }

  restoreSnapshot(snapshot: import("../../context/projectTypes").ViewerSnapshot | null): void {
    this.snapshotRenderer?.restoreSnapshot(snapshot);
  }


  async renderScene(options: ViewerRenderOptions): Promise<ViewerRenderResult | null> {
    return this.renderExporter.renderScene(options);
  }

  dispose() {
    this.runtimeLoop.stop();
    this.unregisterWindowEvents?.();
    this.unregisterWindowEvents = null;
    this.disposeComposer();
    this.disposeMainComposer();
    this.controls?.dispose();
    if (this.transformControls) {
      this.transformControls.detach();
      if (this.transformControlsHelper) {
        this.sceneManager.scene.remove(this.transformControlsHelper);
        this.transformControlsHelper = null;
      }
      this.transformControls.dispose();
      this.transformControls = null;
    }
    this.layoutEngine?.bindBridge(null);
    this.orlaVisualizer.bindBridge(null);
    this.orlaVisualizer.dispose();
    this.remateVisualBridge = null;
    this.remateVisualizer.bindBridge(null);
    this.remateVisualizer.dispose();
    this.tampoVisualizer.bindBridge(null);
    this.tampoVisualizer.dispose();
    this.hematiVisualizer.bindBridge(null);
    this.hematiVisualizer.dispose();
    this.rodapeVisualBridge = null;
    this.rodapeVisualizer.bindBridge(null);
    this.rodapeVisualizer.dispose();
    this.overlayCoordinator.dispose();
    this.onBoxTransform = null;
    this.onBoxSelected = null;
    this.onMultiSelectToggle = null;
    this.onInternalSurfaceSelected = null;
    this.onInternalEdgeSelected = null;
    this.onInternalPointSelected = null;
    this.onDoorLayerDoubleClick = null;
    this.onDrawerLayerDoubleClick = null;
    this.onDrawerLayerClick = null;
    this.onBoxDoubleClick = null;
    this.onModelLoaded = null;
    this.eventsManager?.unregister();
    this.eventsManager = null;
    if (this.wallGizmo) {
      this.wallGizmo.dispose();
      this.sceneManager.scene.remove(this.wallGizmo.group);
      this.wallGizmo = null;
    }
    if (this.snapDebugOverlay) {
      this.snapDebugOverlay.dispose();
      this.snapDebugOverlay = null;
    }
    if (this.roomManager) {
      this.roomManager.removeRoom();
      this.roomManager = null;
    }
    this.snapshotRenderer = null;
    this.selectedBoxChangeListeners.clear();
    disposeSelectionSystemsImpl(this.getSelectionOpsDeps());
    this.multiSelectionOutline = null;
    this.highlightManager = null;
    this.edgeOutlineSystem = null;
    this.internalSelectionOutline = null;
    this.dimensionsOverlay.dispose();
    this.measurementEngine.dispose();
    this.unregisterAdminSnappingRules?.();
    this.unregisterAdminSnappingRules = null;
    this.smartSnappingEngine.dispose();
    this.smartAlignOverlay.dispose();
    this.remateSmartSnapping.dispose();
    // Limpar todos os caixotes corretamente
    this.clearBoxes();
    this.roomBuilder.clearRoom();
    this.displayMaterials.dispose();
    this.materialPipeline.disposeSharedPanelEdgeMaterial();

    this.sceneManager.dispose();
    this.rendererManager.dispose();
  }
}
