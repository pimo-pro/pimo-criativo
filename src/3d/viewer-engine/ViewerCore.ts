import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import { SceneManager } from "./scene";
import { SceneEngine } from "./scene/SceneEngine";
import { ensureViewerSceneEngine } from "./engines/SceneEngine";
import { CameraManager } from "./camera";
import { CameraEngine } from "./camera/CameraEngine";
import { ensureViewerCameraEngine } from "./engines/CameraEngine";
import { RendererManager } from "./renderer";
import { Lights } from "./lighting";
import { LightingEngine } from "./lighting/LightingEngine";
import { ensureViewerLightingEngine } from "./engines/LightingEngine";
import { ComposerEngine } from "./lighting/ComposerEngine";
import { ensureViewerComposerEngine } from "./engines/ComposerEngine";
import type { SelectionEngine } from "./selection/SelectionEngine";
import { createViewerSelectionEngine } from "./engines/SelectionEngine";
import { createViewerGizmoEngine } from "./engines/GizmoEngine";
import type { BoxEngine } from "./box/BoxEngine";
import { ensureViewerBoxEngine } from "./engines/BoxEngine";
import { ViewerRoomEngine } from "./room/ViewerRoomEngine";
import { ensureViewerRoomEngine as ensureViewerRoomEngineFactory } from "./engines/ViewerRoomEngine";
import { ensureViewerDesignerEngine } from "./engines/DesignerEngine";
import { createFinishSyncFlags, flushPendingFinishSync } from "./finish/ViewerFinishSync";
import { Controls } from "./controls";
import {
  createViewerControls,
  createViewerDisplayFacade,
  createViewerFoundation,
  createViewerMaterialSystems,
  createViewerSelectionSystems,
} from "./composition/ViewerCompositionRoot";
import {
  applyMouseInputMappingToOrbitControls,
  applyCameraNavigationLock,
  getMouseInputMapping,
  getPointerActionForButton,
  normalizeMouseInputPreset,
  shouldBlockPointerDownForSelection,
  type MouseInputPreset,
} from "./controls/MouseInputMapper";
import { isObjectInScreenRect } from "./utils/screenSelection";
import { BoxSceneController } from "./box/BoxSceneController";
import { ViewerBoxManager } from "./box";
import { SnapshotRenderer } from "./snapshot";
import type { HighlightManager } from "./highlight";
import type { EdgeOutlineBoxEntry, EdgeOutlineSystem } from "../outline";
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
  createInitialMaterialSet,
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
import {
  createRoomFloorOutline,
  createRoomFloorOverlayMaterial,
  getRoomFloorExpandM,
  getRoomFloorOverlayAppearance,
} from "./materials/roomFloorOverlay";
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
import {
  clearSnapUserData,
  getTransformGizmoSizeForBox as computeTransformGizmoSizeForBox,
} from "@/viewer/core/viewerUtils";
import type { ViewerOptions } from "@/viewer/core/viewerTypes";
export type { ViewerOptions } from "@/viewer/core/viewerTypes";
import { RoomBuilder } from "../room/RoomBuilder";
import { createViewerCoreFacades } from "./ViewerCoreFacades";
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
  type IRoomManagerViewer,
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
import { snapHorizontalOffset } from "../../utils/openingConstraints";
import type { ProjectRoomUtility, RoomFloorMode } from "./room/roomEngineTypes";
import { devLogger } from "../../utils/devLogger";
import { WallGizmo } from "../gizmos/WallGizmo";
import { updateWallCulling } from "../visibility/WallRaycastCulling";
import type { SnapDebugData } from "../snapping/ModelWallSnap";
import { keepModelInsideRoom, preventModelWallIntersection } from "../collision/ModelCollision";
import { SnapDebugOverlay } from "../../debug/SnapDebugOverlay";
import { ViewerRenderExporter } from "./export/ViewerRenderExporter";
import { TransformConstraints, type ClampTransformContext } from "./constraints/TransformConstraints";
import { SnapEngine, type SnapAlignTarget } from "./snapping/SnapEngine";
import { ensureViewerSnapEngine } from "./engines/SnapEngine";
import { applyFinishMovementConstraints } from "./constraints/finishCollision";
import { MeasurementEngine } from "./measurement/MeasurementEngine";
import { ensureViewerMeasurementEngine } from "./engines/MeasurementEngine";
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
import type { MultiOutlineTarget, MultiSelectionOutline } from "./selection/MultiSelectionOutline";
import { MeasurementAnchorsVisualizer } from "./measurement/MeasurementAnchorsVisualizer";
import { historyManager } from "../../core/viewer/historyManager";
import type { MeasurementAnchorEntry } from "../../core/viewer/measurementAnchors";
import { decodeSelectionId } from "../../core/viewer/selectionIds";
import { encodeSelectionIdFromLayerHit } from "../../core/viewer/selectionHitEncoding";
import { SmartSnapping } from "./snapping/SmartSnapping";
import { createSnappingFacade, type SnappingFacade } from "./snapping/snappingFacade";
import { registerAdminSnappingRules } from "./snapping/adminSnappingRules";
import { RemateSmartSnapping } from "./snapping/RemateSmartSnapping";
import { SmartAlignSnapOverlay } from "./snapping/smartAlignSnapOverlay";
import { SmartAlignSnapEngine } from "./snapping/SmartAlignSnapEngine";
import {
  createSmartAlignOverlayFacade,
  type SmartAlignOverlayFacade,
} from "./snapping/smartAlignOverlayFacade";
import type { SmartAlignSnapContext, SmartSnapEntity } from "./snapping/smartAlignSnapTypes";
import { DEFAULT_UNIFIED_CAPTURE_MM, DEFAULT_UNIFIED_MAGNET } from "./snapping/smartAlignSnapTypes";
import { getEntityWorldBoxAabb } from "./snapping/smartAlignSnapAabb";
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
import { rulesStore } from "../../admin/rules/rulesStore";
import type { SmartLayoutBridge } from "./snapping/smartLayoutTypes";
import { createDisabledSmartLayoutDeps } from "./snapping/smartLayoutDepsFactory";
import { OrlaVisualizer, type OrlaVisualBridge } from "./orla/OrlaVisualizer";
import { RematePieceVisualizer, type RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import { TampoPieceVisualizer } from "./remate/TampoPieceVisualizer";
import {
  listRemateIdsInSameLComposite,
  resolveRemateTransformRoot,
} from "./remate/remateLCompositeVisual";
import { isLRematePiece } from "../../core/remate/remateLGeometry";
import { applyRemateRotationSnapToMesh } from "../../core/remate/remateRotationSnap";
import { isTampoAngularConfig } from "../../core/remate/tampoAngle";
import { HematiVisualizer, type HematiVisualBridge } from "./hemati/HematiVisualizer";
import { RodapeVisualizer, type RodapeVisualBridge } from "./rodape/RodapeVisualizer";
import { mmToM } from "../../utils/units";
import { ViewerPanelVisibility } from "./panels/ViewerPanelVisibility";
import { IndustrialDesignViewerOverlay } from "./overlays/IndustrialDesignViewerOverlay";
import { IndustrialDesignWorkspaceMode } from "./modes/IndustrialDesignWorkspaceMode";
import type { HoleTypeId } from "../../core/drill/holeCatalog";
import type { DesignDrillHole, IndustrialDesignBox } from "../../core/industrialDesigner/types";
import type { DesignValidationIssue } from "../../core/industrialDesigner/geometryValidation";
import { DesignValidationError } from "../../core/industrialDesigner/geometryValidation";
import { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
import { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import { bindViewerOverlayCoordinator } from "./overlays/bindViewerOverlayCoordinator";
import { createViewerVisualFacades, type ViewerVisualFacade } from "./overlays/viewerVisualFacades";
import { registerViewerWindowEvents } from "./input/viewerWindowEvents";
import { PointerPickingFacade } from "./input/PointerPickingFacade";
import { shouldProcessTransformDragEnd } from "./transforms/transformDragLifecycle";
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
  clampDivisorLocalX,
  clampSeparadorLocalY,
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
    if (e.key === "Shift") this.shiftKeyHeld = true;
  };
  private boundShiftKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Shift") this.shiftKeyHeld = false;
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
    if (!container) {
      throw new Error("Viewer: container is required");
    }
    const userAgent =
      typeof window !== "undefined" && window.navigator ? window.navigator.userAgent : "";
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent ?? ""
    );
    this.reflectionUpdateIntervalFrames = this.isMobile ? 36 : 24;
    this.container = container;
    const foundation = createViewerFoundation(container, options, this.isMobile);
    this.sceneManager = foundation.sceneManager;
    this.sceneEngine = ensureViewerSceneEngine(this.sceneEngine ?? null, this.sceneManager);
    this.defaultGroundSize = foundation.defaultGroundSize;
    this.cameraManager = foundation.cameraManager;
    this.cameraEngine = ensureViewerCameraEngine(this.cameraEngine ?? null, this.cameraManager);
    this.rendererManager = foundation.rendererManager;
    this.lights = foundation.lights;
    this.baseLightIntensities = foundation.baseLightIntensities;
    this.display = createViewerDisplayFacade({
      getShadowIntensity: () => this.lightingEngine?.shadowIntensity ?? 1,
      updateShadowIntensity: (value) => this.updateShadowIntensity(value),
    });
    this.defaultPixelRatio = foundation.defaultPixelRatio;
    this.baseToneMappingExposure = foundation.baseToneMappingExposure;
    const selectionSystems = createViewerSelectionSystems({
      scene: this.sceneManager.scene,
      getBoxes: () => this.boxes,
    });
    this.selectionOutline = selectionSystems.selectionOutline;
    this.wallSelectionOutline = selectionSystems.wallSelectionOutline;
    this.highlightManager = selectionSystems.highlightManager;
    this.edgeOutlineSystem = selectionSystems.edgeOutlineSystem;
    this.internalSelectionOutline = selectionSystems.internalSelectionOutline;
    this.multiSelectionOutline = selectionSystems.multiSelectionOutline;
    this.selectionEngine = createViewerSelectionEngine({
      multiSelectionOutline: this.multiSelectionOutline,
      resolveMultiOutlineTarget: (encoded) => this.resolveMultiOutlineTarget(encoded),
      setGroupMemberIds: (ids) => this.viewerState.setGroupTransformMemberIds(ids),
      clearGroupMemberIds: () => this.viewerState.clearGroupTransformMemberIds(),
      refreshGizmo: () => this.gizmoEngine.refreshAttachment(),
      getSelectedObjects: (multiBoxIds) => this.getSelectedObjects(multiBoxIds),
      notifyAligned: (obj) => this.notifyAlignableTransform(obj),
    });

    this.roomBuilder = new RoomBuilder(() => this.roomBoxWalls.map((w) => w.mesh));
    this.sceneEngine.add(this.roomBuilder.getGroup());

    this.raycastSystem = new ViewerRaycastSystem({
      raycaster: this.raycaster,
      pointer: this.pointer,
      camera: this.cameraManager.camera,
      getBoxes: () => this.boxes,
      getRoomBoxWalls: () => this.roomBoxWalls,
      getRoomBuilderGroup: () => this.roomBuilder.getGroup(),
      getScene: () => this.sceneManager.scene,
      getCanvas: () => this.rendererManager.renderer.domElement,
      getRoomBounds: () => this.roomBounds,
      getTransformControlsHelper: () => this.transformControlsHelper,
      getDebugMode: () => this.debugMode,
      getBoxEntry: (boxId) => this.boxes.get(boxId),
      projectWorldToScreen: (world) => this.projectWorldToScreen(world),
      getRemateRoot: () => this.remateVisualizer.getRoot(),
      getTampoRoot: () => this.tampoVisualizer.getRoot(),
      getHematiRoot: () => this.hematiVisualizer.getRoot(),
      getRodapeRoot: () => this.rodapeVisualizer.getRoot(),
    });
    this.pointerPicking = new PointerPickingFacade({
      raycastSystem: this.raycastSystem,
      getPlacementMode: () => this.viewerState.getPlacementMode(),
      hasRoomElementPlacementHandler: () => Boolean(this.onRoomElementPlaced),
    });

    const materialSystems = createViewerMaterialSystems();
    this.materialPipeline = materialSystems.materialPipeline;
    this.displayMaterials = materialSystems.displayMaterials;
    this.ultraMaterials = materialSystems.ultraMaterials;

    this.industrialDesignMode = new IndustrialDesignWorkspaceMode({
      getBoxEntry: (id) => this.boxes.get(id),
      getBoxMesh: (id) => this.boxes.get(id)?.mesh ?? null,
      raycastIntersects: (event) => this.getBoxPanelRaycastHits(event),
      updateBoxDrillMarkers: (boxId, markers) => {
        const entry = this.boxes.get(boxId);
        if (!entry) return;
        entry.drillMarkersByPanel = markers;
        this.applyPanelVisibilityForObject(entry.mesh);
        this.syncIndustrialDesignViewerOverlay(boxId);
      },
      setPanelRenderingEnabled: (enabled) => {
        this.setPanelRenderingEnabled(enabled);
        if (enabled) this.setPanelEdgesVisible(true);
      },
      setValidationHighlightPanels: (boxId, panelIds) => {
        this.setIndustrialDesignValidationHighlight(boxId, panelIds);
      },
      setSelectionHighlightPanel: (boxId, panelId) => {
        this.setIndustrialDesignSelectionHighlight(boxId, panelId);
      },
      syncDesignVisuals: (boxId) => {
        this.syncIndustrialDesignViewerOverlay(boxId);
      },
      getViewerReady: () => this.viewerReadyFlag,
    });

    this.panelVisibility = new ViewerPanelVisibility({
      getBoxes: () => this.boxes,
      getHighlightEnabled: () => this.viewerState.getHighlightEnabled(),
      getBoxIdByMesh: (mesh) => this.pointerPicking.getBoxIdByMesh(mesh),
      getSharedPanelEdgeMaterial: () => this.materialPipeline.getSharedPanelEdgeMaterial(),
      getIndustrialDesignWorkspaceEnabled: () => this.industrialDesignMode.isEnabled(),
    });

    this.materialSet = createInitialMaterialSet();

    this.controls = createViewerControls(
      this.cameraManager.camera,
      this.rendererManager.renderer.domElement,
      options
    );
    this.applyMousePresetToControls();
    this.applyBackgroundMode();
    this.measurementEngine = ensureViewerMeasurementEngine(null, {
      getCamera: () => this.cameraManager.camera,
      getCanvas: () => this.rendererManager.renderer.domElement,
      getContainer: () => this.container,
      getBoxes: () => this.boxes,
      getRoomWalls: () => this.roomBoxWalls,
      getSelectedBoxId: () => this.viewerState.getSelectedBox(),
      isTransformDragging: () => this.viewerState.getTransformControlsDragging(),
      projectWorldToScreen: (worldPoint) => this.projectWorldToScreen(worldPoint),
      getProjectMeasurements: () => this.getProjectMeasurementsFn(),
      onMeasurementSaved: (entry) => this.onInternalMeasurementSavedFn(entry),
      getNearestBoxDistance: () => this.computeDistanceToNearestBox(),
      getNearestWallDistance: () => this.computeDistanceToNearestWall(),
      getFloorDistance: () => this.computeDistanceToFloor(),
    });
    this.internalRuler = this.measurementEngine.facade;

    this.smartSnappingEngine = new SmartSnapping({
      getCamera: () => this.cameraManager.camera,
      getCanvas: () => this.rendererManager.renderer.domElement,
      getContainer: () => this.container,
      projectWorldToScreen: (worldPoint) => this.projectWorldToScreen(worldPoint),
      isInternalRulerActive: () => this.measurementEngine.isActive(),
      getRoomBounds: () => this.roomBounds,
      getRoomOpenings: () => this.getRoomOpeningsForSnapping(),
    });
    this.remateSmartSnapping = new RemateSmartSnapping({
      getContainer: () => this.container,
      projectWorldToScreen: (worldPoint) => this.projectWorldToScreen(worldPoint),
    });
    this.remateSmartSnapping.enable();

    this.smartAlignSnapOverlay = new SmartAlignSnapOverlay({
      getContainer: () => this.container,
      projectWorldToScreen: (worldPoint) => this.projectWorldToScreen(worldPoint),
    });
    this.smartAlignOverlay = createSmartAlignOverlayFacade(this.smartAlignSnapOverlay);

    this.smartAlignSnapEngine = new SmartAlignSnapEngine({
      isInternalRulerActive: () => this.measurementEngine.isActive(),
    });
    this.smartAlignSnapEngine.enable();

    this.snapping = createSnappingFacade(this.smartSnappingEngine);

    bindViewerOverlayCoordinator({
      coordinator: this.overlayCoordinator,
      unifiedMeasurement: this.measurementEngine.engine,
      smartSnappingEngine: this.smartSnappingEngine,
      smartAlignSnapEngine: this.smartAlignSnapEngine,
      syncSmartAlignSnapOverlay: () => this.syncSmartAlignSnapOverlayFromEngine(),
      clearSmartAlignSnapOverlay: () => this.clearSmartAlignSnapOverlay(),
    });

    const smartLayoutDeps = createDisabledSmartLayoutDeps({
      getBridge: () => this.smartLayoutBridge,
      buildSnapContext: () => this.buildDisabledSmartSnapContext(),
      getBoxEntry: (boxId) => this.boxes.get(boxId),
    });
    this.layoutEngine = new LayoutEngine(smartLayoutDeps);
    const facades = createViewerCoreFacades({
      layoutEngine: this.layoutEngine,
      designConversationState: this.designConversationState,

      previewSmartWallFill: (wallId, moduleBoxId) => this.previewSmartWallFill(wallId, moduleBoxId),
      acceptPredictiveLayoutPending: () => this.acceptPredictiveLayoutPending(),
      clearSmartAlignSnapOverlay: () => this.clearSmartAlignSnapOverlay(),

      ensureIntelligentDesigner: () => this.ensureIntelligentDesigner(),
      generateIntelligentDesigns: (seedBoxId) => this.generateIntelligentDesigns(seedBoxId),
      generateIntelligentVariations: () => this.generateIntelligentVariations(),
      previewIntelligentDesign: (id) => this.previewIntelligentDesign(id),
      applyIntelligentDesign: (id) => this.applyIntelligentDesign(id),
      previewIntelligentStyle: (styleId, seedBoxId) => this.previewIntelligentStyle(styleId, seedBoxId),
      applyIntelligentStyle: (styleId, seedBoxId) => this.applyIntelligentStyle(styleId, seedBoxId),

      ensureConversationalDesignerEngine: () => this.ensureConversationalDesignerEngine(),

      ensureManufacturingReportEngine: () => this.ensureManufacturingReportEngine(),
      previewManufacturingFixes: () => this.previewManufacturingFixes(),
      applyManufacturingSuggestedFixes: () => this.applyManufacturingSuggestedFixes(),

      ensureCostReportEngine: () => this.ensureCostReportEngine(),
      previewCostSuggestionByTier: (seedBoxId, tier) => this.previewCostSuggestionByTier(seedBoxId, tier),
    });

    this.autoLayout = facades.autoLayout;
    this.smartLayout = facades.smartLayout;
    this.intelligentDesigner = facades.intelligentDesigner;
    this.conversationalDesigner = facades.conversationalDesigner;
    this.manufacturing = facades.manufacturing;
    this.costEstimator = facades.costEstimator;
    const visualFacades = createViewerVisualFacades({
      syncOrlaVisuals: () => this.syncOrlaVisuals(),
      syncRemateVisuals: () => this.syncRemateVisuals(),
      syncHematiVisuals: () => this.syncHematiVisuals(),
      syncRodapeVisuals: () => this.syncRodapeVisuals(),
    });
    this.orlaVisual = visualFacades.orlaVisual;
    this.remateVisual = visualFacades.remateVisual;
    this.hematiVisual = visualFacades.hematiVisual;
    this.rodapeVisual = visualFacades.rodapeVisual;

    this.unregisterAdminSnappingRules = registerAdminSnappingRules(
      this.smartSnappingEngine,
      {
        snapRules: rulesStore.snapRules,
        roomRules: rulesStore.roomRules,
      },
      this.smartAlignSnapEngine
    );

    this.transformControls = new TransformControls(
      this.cameraManager.camera,
      this.rendererManager.renderer.domElement
    );
    this.transformControls.setSpace("world");
    this.transformControls.enabled = true;
    this.transformControls.showX = true;
    this.transformControls.showY = true;
    this.transformControls.showZ = true;
    this.transformControls.addEventListener("mouseDown", () => {
      historyManager.beginDragSession("transform.drag", "Transformação");
      this.onTransformDragStart?.();
      this.smartAlignSnapEngine.onDragStart();
      if (this.viewerState.getSelectedRemate()) {
        const remateId = this.viewerState.getSelectedRemate()!;
        const rawMesh = this.getRemateMesh(remateId);
        const obj = resolveRemateTransformRoot(rawMesh) ?? rawMesh ?? this.transformControls!.object;
        if (obj) this.remateSmartSnapping.onDragStart(obj as THREE.Object3D);
      } else if (this.viewerState.getSelectedDivSep()) {
        const sel = this.viewerState.getSelectedDivSep()!;
        const mesh = this.getDivSepMesh(sel);
        if (mesh) {
          mesh.userData.divSepDragStart = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          };
        }
      } else if (this.groupGizmo?.isActive()) {
        const members = this.groupGizmo.getMembers();
        for (const member of members) {
          const decoded = decodeSelectionId(member.encodedId);
          if (decoded?.kind !== "box") continue;
          this.smartSnappingEngine.onDragStart(member.mesh);
          break;
        }
      } else if (this.viewerState.getSelectedBox()) {
        const obj = this.transformControls!.object;
        if (obj && "position" in obj) {
          this.dragStartZForShiftLock = (obj as THREE.Object3D).position.z;
          this.smartSnappingEngine.onDragStart(obj as THREE.Object3D);
        }
      }
      this.viewerState.setTransformControlsDragging(true);
      this.logTransformDiagnostic("dragStart(mouseDown)");
    });
    this.transformControls.addEventListener("mouseUp", () => {
      this.finishTransformDrag("mouseUp");
      this.logTransformDiagnostic("dragEnd(mouseUp)");
    });
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.viewerState.setTransformControlsDragging(Boolean(event.value));
      this.logTransformDiagnostic("dragging-changed", {
        value: Boolean(event.value),
      });
      if (!event.value) {
        this.finishTransformDrag("dragging-changed");
      }
    });
    this.transformControls.addEventListener("objectChange", () => {
      this.handleTransformObjectChange();
    });
    this.transformControlsHelper = this.transformControls.getHelper();
    this.transformControlsHelper.visible = false;
    this.sceneManager.scene.add(this.transformControlsHelper);
    this.groupGizmo = new GroupGizmo(this.sceneManager.scene);
    this.measurementAnchorsVisualizer = new MeasurementAnchorsVisualizer(this.sceneManager.scene);
    this.dimensionsOverlay = new DimensionsOverlayController({
      scene: this.sceneManager.scene,
      camera: this.cameraManager.camera,
      getViewportSize: () => ({
        width: this.container?.clientWidth ?? 1280,
        height: this.container?.clientHeight ?? 720,
      }),
      collectBoxBounds: () => this.collectBoxBoundsForDimensions(),
      projectWorldToScreen: (world) => this.projectWorldToScreen(world),
    });
    this.logTransformDiagnostic("transform-listeners-ready", {
      domTag: this.rendererManager.renderer.domElement.tagName,
      helperVisible: this.transformControlsHelper.visible,
    });

    this.wallGizmo = new WallGizmo(this.cameraManager.camera);
    this.wallGizmo.setOnTransform(() => this.notifyWallTransform());
    this.sceneManager.scene.add(this.wallGizmo.group);
    this.sceneManager.scene.add(this.remateVisualizer.getRoot());
    this.sceneManager.scene.add(this.tampoVisualizer.getRoot());
    this.sceneManager.scene.add(this.hematiVisualizer.getRoot());
    this.sceneManager.scene.add(this.rodapeVisualizer.getRoot());
    this.setWallEditMode(false);

    this.roomManager = new RoomManager(this as unknown as IRoomManagerViewer);
    if (import.meta.env.DEV) {
      this.snapDebugOverlay = new SnapDebugOverlay();
    }

    this.snapshotRenderer = new SnapshotRenderer({
      getCamera: () => ({
        position: this.cameraManager.camera.position,
        quaternion: this.cameraManager.camera.quaternion,
        zoom: "zoom" in this.cameraManager.camera ? (this.cameraManager.camera as { zoom: number }).zoom : 1,
        type: this.cameraManager.camera.type,
      }),
      getControls: () =>
        this.controls?.controls
          ? { target: this.controls.controls.target, update: () => this.controls!.controls!.update() }
          : null,
      getScene: () => this.sceneManager.scene,
      getRenderer: () => this.rendererManager.renderer,
      getContainer: () => this.container,
    });

    this.constraints = new TransformConstraints();
    this.snapEngine = ensureViewerSnapEngine(null, {
      getAlignEngine: () => this.smartAlignSnapEngine,
      isAlignEnabled: () => this.settings.enableSmartAlignSnap,
      buildAlignContext: () => this.buildSmartAlignSnapContextForDrag(),
      syncAlignOverlay: () => this.syncSmartAlignSnapOverlayFromEngine(),
      getConstraints: () => this.constraints,
    });
    this.renderExporter = new ViewerRenderExporter({
      getBoxes: () => this.boxes,
      getRenderer: () => this.rendererManager.renderer,
      getScene: () => this.sceneManager.scene,
      getCamera: () => this.cameraManager.camera,
      getControls: () =>
        this.controls?.controls
          ? { target: this.controls.controls.target, update: () => this.controls!.controls!.update() }
          : null,
      getLights: () => ({
        keyLight: this.lights.keyLight,
        fillLight: this.lights.fillLight,
        ambient: this.lights.ambient,
        rimLight: this.lights.rimLight,
        hemisphere: this.lights.hemisphere,
      }),
      getGroundVisible: () => this.sceneEngine.getGroundVisible(),
      setGroundVisible: (visible) => this.sceneEngine.setGroundVisible(visible),
      getGridVisible: () => this.sceneEngine.getGridVisible(),
      setGridVisible: (visible) => this.sceneEngine.setGridVisible(visible),
      getRoomGroup: () => this.roomBuilder.getGroup(),
      getRoomWalls: () => this.roomBoxWalls,
      getSelectionOutline: () => this.selectionOutline.getGroup(),
      getWallSelectionOutline: () => this.wallSelectionOutline.getHelper(),
      getDimensionsOverlayGroup: () => this.dimensionsOverlay.group,
      getWallGizmoGroup: () => this.wallGizmo?.group ?? null,
      ensureShowcaseComposer: () => {
        this.ensureComposerEngine().ensureShowcase();
      },
      ensureMainComposer: () => {
        this.ensureComposerEngine().ensureMain();
      },
      getShowcaseComposer: () => this.composerEngine?.showcase ?? null,
      getMainComposer: () => this.composerEngine?.main ?? null,
      getShowcaseBloomPass: () => this.composerEngine?.bloom ?? null,
      getMainBloomPass: () => this.composerEngine?.mainBloom ?? null,
      getBokehPass: () => this.composerEngine?.bokeh ?? null,
      setComposerExportSize: (width, height, pixelRatio) => {
        this.composerEngine?.setExportSize(width, height, pixelRatio);
      },
      updateShowcaseComposerSize: () => this.composerEngine?.updateShowcaseSize(),
      updateMainComposerSize: () => this.composerEngine?.updateMainSize(),
      updateCanvasSize: () => this.updateCanvasSize(),
    });
    this.runtimeLoop = new ViewerRuntimeLoop({
      getRenderer: () => this.rendererManager.renderer,
      renderScene: () => this.rendererManager.render(this.sceneManager.scene, this.cameraManager.camera),
      getCamera: () => this.cameraManager.camera,
      setCameraAspect: (aspect) => {
        this.cameraManager.camera.aspect = aspect;
      },
      updateCameraProjection: () => this.cameraManager.camera.updateProjectionMatrix(),
      getContainer: () => this.container,
      ensureMainComposer: () => {
        this.ensureComposerEngine().ensureMain();
      },
      getShowcaseComposer: () => this.composerEngine?.showcase ?? null,
      getMainComposer: () => this.composerEngine?.main ?? null,
      getBokehPass: () => this.composerEngine?.bokeh ?? null,
      updateShowcaseComposerSize: () => this.composerEngine?.updateShowcaseSize(),
      updateMainComposerSize: () => this.composerEngine?.updateMainSize(),
      getCurrentMode: () => this.viewerState.getCurrentMode(),
      isUltraPerformanceMode: () => this.ultraPerformanceMode,
      isTurntableEnabled: () => this.turntableEnabled && this.viewerState.getCurrentMode() === "showcase",
      getTurntableSpeed: () => this.turntableSpeed,
      getTurntableTarget: () => this.controls?.controls?.target?.clone() ?? null,
      getBoxes: () => this.boxes,
      onBeforeRenderTick: () => this.onBeforeRenderTick(),
    });

    this.updateCameraTarget();

    this.eventsManager = new EventsManager(this.getEventEngineApi());
    this.eventsManager.register(this.rendererManager.renderer.domElement);

    this.materialPipeline.setLacqueredClearcoatPipeline(this.materialQuality === "lacquered");

    this.start();
    queueMicrotask(() => this.notifyViewerReady());
    this.unregisterWindowEvents = registerViewerWindowEvents({
      resize: this.updateCanvasSize,
      keydown: this.boundShiftKeyDown,
      keyup: this.boundShiftKeyUp,
    });
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
    const canvasRect = canvas.getBoundingClientRect();
    const selectionRect = {
      left: Math.min(rect.left, rect.right),
      top: Math.min(rect.top, rect.bottom),
      right: Math.max(rect.left, rect.right),
      bottom: Math.max(rect.top, rect.bottom),
    };
    const camera = this.cameraManager.camera;
    const ids: string[] = [];

    this.boxes.forEach((entry, boxId) => {
      entry.mesh.updateMatrixWorld(true);
      if (isObjectInScreenRect(entry.mesh, selectionRect, camera, canvasRect)) {
        ids.push(`box:${boxId}`);
      }
    });

    const rematePieces = this.remateVisualBridge?.listRematePieces() ?? [];
    for (const piece of rematePieces) {
      const mesh = this.getRemateMesh(piece.id);
      if (!mesh) continue;
      mesh.updateMatrixWorld(true);
      if (isObjectInScreenRect(mesh, selectionRect, camera, canvasRect)) {
        ids.push(`remate:${piece.id}`);
      }
    }

    const rodapes = (this.rodapeVisualBridge?.listBoxRodapeConfigs() ?? []).flatMap((c) => c.rodapes);
    for (const rodape of rodapes) {
      const mesh = this.rodapeVisualizer.getMeshByRodapeId(rodape.id);
      if (!mesh) continue;
      mesh.updateMatrixWorld(true);
      if (isObjectInScreenRect(mesh, selectionRect, camera, canvasRect)) {
        ids.push(`rodape:${rodape.id}`);
      }
    }

    return ids;
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
    if (!this.groupGizmo?.isActive()) return false;
    if (this.viewerState.getCurrentTool() !== "translate") return false;
    if (!this.viewerState.getTransformControlsDragging()) return false;

    const members = this.groupGizmo.getMembers();
    let primaryBoxId: string | null = null;
    let primaryMesh: THREE.Object3D | null = null;
    for (const member of members) {
      const decoded = decodeSelectionId(member.encodedId);
      if (decoded?.kind !== "box") continue;
      primaryBoxId = decoded.id;
      primaryMesh = member.mesh;
      break;
    }
    if (!primaryBoxId || !primaryMesh) return false;

    const before = primaryMesh.position.clone();
    this.applyDynamicAlignSnap({
      mesh: primaryMesh,
      entity: { kind: "box", id: primaryBoxId },
      isDragging: true,
      currentTool: "translate",
    });
    const delta = primaryMesh.position.clone().sub(before);
    if (delta.lengthSq() < 1e-10) return false;

    primaryMesh.position.copy(before);
    this.groupGizmo.getPivot().position.add(delta);
    this.groupGizmo.applyPivotTransform();
    return true;
  }

  resolveMemberMesh(encoded: string): THREE.Object3D | null {
    return this.resolveMultiOutlineTarget(encoded)?.mesh ?? null;
  }

  applyGroupPivotTransform(): void {
    this.groupGizmo?.applyPivotTransform();
  }

  notifyGroupTransform(options?: { recordHistory?: boolean }): void {
    if (!this.groupGizmo?.isActive()) return;
    for (const member of this.groupGizmo.getMembers()) {
      const decoded = decodeSelectionId(member.encodedId);
      if (!decoded) continue;
      if (decoded.kind === "box") {
        const entry = this.boxes.get(decoded.id);
        if (entry?.locked) continue;
        const { x, y, z } = member.mesh.position;
        const r = member.mesh.rotation;
        this.onBoxTransform?.(decoded.id, { x, y, z }, { x: r.x, y: r.y, z: r.z });
      } else if (decoded.kind === "remate") {
        this.viewerState.setSelectedRemate(decoded.id);
        this.notifyRemateTransform();
      } else if (decoded.kind === "rodape") {
        this.viewerState.setSelectedRodape(decoded.id);
        this.notifyRodapeTransform();
      }
    }
    if (options?.recordHistory) {
      historyManager.recordEvent("group.transform", "Transformar grupo");
    }
  }

  clampGroupTransform(): void {
    if (!this.groupGizmo?.isActive()) return;
    if (this.viewerState.getCurrentTool() !== "translate") return;
    if (!this.viewerState.getTransformControlsDragging()) return;

    this.applySmartSnapForGroup();

    const members = this.groupGizmo.getMembers();
    if (members.length === 0) return;

    const groupBoxIds = new Set<string>();
    for (const member of members) {
      const decoded = decodeSelectionId(member.encodedId);
      if (decoded?.kind === "box") groupBoxIds.add(decoded.id);
    }

    if (this.lockEnabled) {
      this._boundingBox.makeEmpty();
      for (const member of members) {
        member.mesh.updateMatrixWorld(true);
        expandBox3ByObjectExcludingLayoutProxy(this._boundingBox, member.mesh);
      }
      if (!this._boundingBox.isEmpty() && this._boundingBox.min.y < 0) {
        const shiftY = -this._boundingBox.min.y;
        this.groupGizmo.getPivot().position.y += shiftY;
        for (const member of members) {
          member.mesh.position.y += shiftY;
        }
      }

      for (const member of members) {
        const decoded = decodeSelectionId(member.encodedId);
        if (decoded?.kind !== "box") continue;
        const entry = this.boxes.get(decoded.id);
        if (!entry || entry.mesh !== member.mesh) continue;
        this.applyFloorConstraint(member.mesh);
        this.constraints.applyCollisionConstraint(member.mesh, this.boxes, decoded.id, groupBoxIds);
        if (this.roomBounds && this.isMeshInsideOrTouchingRoom(member.mesh)) {
          const wallsMain = this.roomBoxWalls
            .map((w) => w.mesh)
            .filter((w) => w.userData?.isMainWall === true);
          const allRoomWalls = this.roomBoxWalls.map((w) => w.mesh);
          this.snapEngine.snapMeshToNearestMainWall(member.mesh, wallsMain);
          preventModelWallIntersection(member.mesh, allRoomWalls);
          keepModelInsideRoom(member.mesh, this.roomBounds);
          this.applyRoomConstraint(member.mesh, { ignoreY: entry.manualPosition });
        }
      }
    }

    this.updateBoxesIntersectingWalls();
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

  private resolveMultiOutlineTarget(encoded: string): MultiOutlineTarget | null {
    const decoded = decodeSelectionId(encoded);
    if (!decoded) return null;

    if (decoded.kind === "box") {
      const entry = this.boxes.get(decoded.id);
      if (!entry) return null;
      return {
        mesh: entry.mesh,
        layoutDims: {
          w: Math.max(0.001, entry.width),
          h: Math.max(0.001, entry.height),
          d: Math.max(0.001, entry.carcassDepth ?? entry.depth),
        },
      };
    }

    if (decoded.kind === "remate") {
      const mesh = this.getRemateMesh(decoded.id);
      return mesh ? { mesh } : null;
    }

    if (decoded.kind === "rodape") {
      const mesh = this.rodapeVisualizer.getMeshByRodapeId(decoded.id);
      return mesh ? { mesh } : null;
    }

    if (decoded.kind === "door") {
      for (const entry of this.boxes.values()) {
        const doorGroup = entry.mesh.children.find((c) => c.name === `door-layer-${decoded.id}`);
        if (doorGroup) return { mesh: doorGroup };
      }
      return null;
    }

    if (decoded.kind === "drawer") {
      for (const entry of this.boxes.values()) {
        const drawerGroup = entry.mesh.children.find((c) => c.name === `drawer-layer-${decoded.id}`);
        if (drawerGroup) return { mesh: drawerGroup };
      }
      return null;
    }

    return null;
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
    const prev = this.viewerState.getInternalSelection();
    const next = selection ? cloneInternalSelectionState(selection) : null;
    const same =
      prev?.type === next?.type &&
      prev?.boxId === next?.boxId &&
      prev?.faceId === next?.faceId &&
      prev?.edgeId === next?.edgeId &&
      prev?.pointId === next?.pointId;
    if (same) return;

    this.viewerState.setInternalSelection(next);
    this.internalSelectionOutline?.sync(next, (boxId) => this.boxes.get(boxId)?.mesh ?? null);

    if (!next) return;
    if (next.type === "internal-face") this.onInternalSurfaceSelected?.(next);
    else if (next.type === "internal-edge") this.onInternalEdgeSelected?.(next);
    else if (next.type === "internal-point") this.onInternalPointSelected?.(next);
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
    return this.getBoxIdAtPointer(event);
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
    const controls = this.controls?.controls;
    if (!controls) return;
    this.applyMousePresetToControls();
  }

  private logTransformDiagnostic(event: string, payload?: Record<string, unknown>): void {
    if (!this.transformDiagnosticsEnabled) return;
    const orbit = this.controls?.controls;
    const target = this.transformControls?.object ?? null;
    devLogger.debug(`[Viewer][TransformDiag] ${event}`, {
      mode: this.viewerState.getCurrentTool(),
      dragging: this.viewerState.getTransformControlsDragging(),
      selectedBoxId: this.viewerState.getSelectedBox(),
      orbitEnabled: orbit?.enabled ?? null,
      transformAttached: Boolean(target),
      targetUuid: target?.uuid ?? null,
      targetName: target?.name ?? null,
      targetMatrixAutoUpdate: target?.matrixAutoUpdate ?? null,
      targetPosition: target
        ? {
            x: Number(target.position.x.toFixed(4)),
            y: Number(target.position.y.toFixed(4)),
            z: Number(target.position.z.toFixed(4)),
          }
        : null,
      ...(payload ?? {}),
    });
  }

  private getTransformGizmoIntersections(event: { clientX: number; clientY: number }): number {
    return this.pointerPicking.getTransformGizmoIntersections(event);
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
    this.panelVisibility.setExplodedViewEnabled(enabled);
  }

  setHighlightEnabled(enabled: boolean): void {
    this.viewerState.setHighlightEnabled(Boolean(enabled));
    this.highlightManager?.setEnabled(this.viewerState.getHighlightEnabled());
    this.refreshOutlineTarget();
    this.applyPanelVisibilityForAllBoxes();
  }

  getExplodedViewEnabled(): boolean {
    return this.panelVisibility.getExplodedViewEnabled();
  }

  setExplodedViewIntensity(value: number): void {
    this.panelVisibility.setExplodedViewIntensity(value);
  }

  getExplodedViewIntensity(): number {
    return this.panelVisibility.getExplodedViewIntensity();
  }

  private applyPanelIdsToBox(
    root: THREE.Object3D,
    boxId: string,
    panelIds?: Partial<BoxPanelIds> | null,
    materialPresetId?: string
  ): void {
    this.panelVisibility.applyPanelIdsToBox(root, boxId, panelIds, materialPresetId);
  }

  private applyPanelVisibilityForObject(root: THREE.Object3D): void {
    this.panelVisibility.applyPanelVisibilityForObject(root);
  }

  private applyPanelVisibilityForAllBoxes(): void {
    this.panelVisibility.applyPanelVisibilityForAllBoxes();
  }

  private applyExplodedViewForObject(root: THREE.Object3D): void {
    this.panelVisibility.applyExplodedViewForObject(root);
  }

  setPanelEdgesVisible(visible: boolean): void {
    this.panelVisibility.setPanelEdgesVisible(visible);
  }

  setPanelHidden(panel: "left" | "right" | "top" | "bottom" | "back", hidden: boolean): void {
    this.panelVisibility.setPanelHidden(panel, hidden);
  }

  setHiddenPanels(keys: string[]): void {
    this.panelVisibility.setHiddenPanels(keys);
  }

  getHiddenPanels(): string[] {
    return this.panelVisibility.getHiddenPanels();
  }

  setAllPanelsHidden(hidden: boolean): void {
    this.panelVisibility.setAllPanelsHidden(hidden);
  }

  setPanelRenderingEnabled(enabled: boolean): void {
    this.panelVisibility.setPanelRenderingEnabled(enabled);
  }

  getPanelRenderingEnabled(): boolean {
    return this.panelVisibility.getPanelRenderingEnabled();
  }

  /** Workspace Industrial de Design — activa/desactiva modo de inserção de furos. */
  setIndustrialDesignWorkspaceEnabled(enabled: boolean): void {
    this.industrialDesignMode.setEnabled(enabled);
  }

  getIndustrialDesignWorkspaceEnabled(): boolean {
    return this.industrialDesignMode.isEnabled();
  }

  setIndustrialDesignActiveHoleType(id: HoleTypeId | null): void {
    this.industrialDesignMode.setActiveHoleTypeId(id);
  }

  getIndustrialDesignActiveHoleType(): HoleTypeId | null {
    return this.industrialDesignMode.getActiveHoleTypeId();
  }

  setIndustrialDesignBox(box: IndustrialDesignBox | null, targetBoxId?: string | null): void {
    this.industrialDesignMode.setDesignBox(box, targetBoxId);
  }

  getIndustrialDesignBox(): IndustrialDesignBox | null {
    return this.industrialDesignMode.getDesignBox();
  }

  getIndustrialDesignSelectedPanelId(): string | null {
    return this.industrialDesignMode.getSelectedPanelId();
  }

  private industrialDesignCallbacks: {
    onPanelSelected?: (panelId: string | null, boxId: string | null) => void;
    onHolePlaced?: (
      panelId: string,
      hole: DesignDrillHole,
      paired?: { panelId: string; hole: DesignDrillHole }
    ) => void;
    onDesignChanged?: (box: IndustrialDesignBox) => void;
    onValidationChanged?: (issues: DesignValidationIssue[]) => void;
    onValidationFailed?: (error: DesignValidationError) => void;
  } = {};

  setOnIndustrialDesignPanelSelected(
    callback: ((panelId: string | null, boxId: string | null) => void) | null
  ): void {
    this.industrialDesignCallbacks.onPanelSelected = callback ?? undefined;
    this.industrialDesignMode.setCallbacks({ ...this.industrialDesignCallbacks });
  }

  setOnIndustrialDesignHolePlaced(
    callback: ((
      panelId: string,
      hole: DesignDrillHole,
      paired?: { panelId: string; hole: DesignDrillHole }
    ) => void) | null
  ): void {
    this.industrialDesignCallbacks.onHolePlaced = callback ?? undefined;
    this.industrialDesignMode.setCallbacks({ ...this.industrialDesignCallbacks });
  }

  setOnIndustrialDesignChanged(
    callback: ((box: IndustrialDesignBox) => void) | null
  ): void {
    this.industrialDesignCallbacks.onDesignChanged = callback ?? undefined;
    this.industrialDesignMode.setCallbacks({ ...this.industrialDesignCallbacks });
  }

  setOnIndustrialDesignValidationChanged(
    callback: ((issues: DesignValidationIssue[]) => void) | null
  ): void {
    this.industrialDesignCallbacks.onValidationChanged = callback ?? undefined;
    this.industrialDesignMode.setCallbacks({ ...this.industrialDesignCallbacks });
  }

  setOnIndustrialDesignValidationFailed(
    callback: ((error: DesignValidationError) => void) | null
  ): void {
    this.industrialDesignCallbacks.onValidationFailed = callback ?? undefined;
    this.industrialDesignMode.setCallbacks({ ...this.industrialDesignCallbacks });
  }

  getIndustrialDesignValidationIssues(): DesignValidationIssue[] {
    return this.industrialDesignMode.getValidationIssues();
  }

  refreshIndustrialDesignValidation(): DesignValidationIssue[] {
    return this.industrialDesignMode.refreshValidation();
  }

  /** Destaca painéis com erro de validação (contorno vermelho). */
  setIndustrialDesignValidationHighlight(boxId: string, panelIds: string[]): void {
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    const idSet = new Set(panelIds);
    entry.mesh.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const panelId = node.userData?.panelId as string | undefined;
      if (!panelId) return;
      node.userData.industrialDesignValidationError = idSet.has(panelId);
    });
    this.applyPanelVisibilityForObject(entry.mesh);
  }

  /** Destaca painel seleccionado no modo design (contorno azul). */
  setIndustrialDesignSelectionHighlight(boxId: string, panelId: string | null): void {
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    entry.mesh.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const pid = node.userData?.panelId as string | undefined;
      if (!pid) return;
      node.userData.industrialDesignSelected = panelId != null && pid === panelId;
    });
    this.applyPanelVisibilityForObject(entry.mesh);
  }

  private syncIndustrialDesignViewerOverlay(boxId: string): void {
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    const enabled = this.industrialDesignMode.isEnabled();
    const designBox = this.industrialDesignMode.getDesignBox();
    const targetId = this.industrialDesignMode.getTargetBoxId();
    if (!enabled || targetId !== boxId) {
      this.industrialDesignViewerOverlay.clear(boxId, entry.mesh);
      return;
    }
    this.industrialDesignViewerOverlay.syncPairingLines(boxId, entry.mesh, designBox, enabled);
  }

  /** Raycast em meshes de painéis das caixas (para modo design industrial). */
  private getBoxPanelRaycastHits(event: { clientX: number; clientY: number }): THREE.Intersection[] {
    const canvas = this.rendererManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.cameraManager.camera);
    this.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    this.boxes.forEach((entry) => roots.push(entry.mesh));
    if (!roots.length) return [];
    return this.raycaster.intersectObjects(roots, true);
  }

  setRoomCeilingVisible(visible: boolean): void {
    this.roomCeilingVisible = Boolean(visible);
    if (this.roomBoxCeiling) {
      this.roomBoxCeiling.visible = this.roomCeilingVisible;
    }
    if (this.roomBoxGroup) {
      this.roomBoxGroup.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        if (node.userData?.isRoomCeiling === true) {
          node.visible = this.roomCeilingVisible;
        }
      });
    }
  }

  setRoomFloorMode(mode: RoomFloorMode): void {
    this.roomFloorMode = mode === "full" || mode === "hybrid" || mode === "room" ? mode : "room";
    this.rebuildRoomFloorAndCeiling();
  }

  setRoomHiddenWalls(wallIds: string[]): void {
    const byStringId = new Map(this.roomBoxWalls.map((entry) => [String(entry.mesh.userData.wallProjectId ?? entry.mesh.userData.wallId ?? entry.id), entry.id]));
    this.hiddenRoomWallIds = new Set(
      (Array.isArray(wallIds) ? wallIds : [])
        .map((id) => byStringId.get(id))
        .filter((id): id is number => typeof id === "number")
    );
    this.applyRoomWallVisibility();
  }

  setRoomUtilities(utilities: ProjectRoomUtility[]): void {
    this.rebuildRoomUtilities(Array.isArray(utilities) ? utilities : []);
  }

  setWallEditMode(enabled: boolean): void {
    this.viewerState.setWallEditMode(Boolean(enabled));
    if (this.wallGizmo) {
      this.wallGizmo.group.visible = this.viewerState.getWallEditMode();
      if (!this.viewerState.getWallEditMode()) this.wallGizmo.detach();
      if (this.viewerState.getWallEditMode() && this.viewerState.getSelectedWallIndex() !== null) {
        const wall = this.roomBoxWalls.find((w) => w.id === this.viewerState.getSelectedWallIndex())?.mesh;
        if (wall) this.wallGizmo.attach(wall);
      }
    }
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
        this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap()),
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
          this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap()),
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
          this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap()),
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
          this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap()),
        requestRender: () => this.requestRender(),
      });
    } finally {
      this.pendingMaterialSyncContext.delete(id);
    }
  }

  /** Agenda um frame de render no próximo requestAnimationFrame. Usado após rebuild de mesh para atualizar a tela imediatamente. */
  private requestRender(): void {
    this.runtimeLoop.requestRender();
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
    this.boxSceneController.applyViewerDrillHoleSceneRules(root);
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
        this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap()),
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

  private clearRoomBox(): void {
    if (this.roomBoxGroup) {
      this.sceneManager.root.remove(this.roomBoxGroup);
    }
    this.roomBoxWalls.forEach((w) => {
      w.mesh.geometry.dispose();
      if (Array.isArray(w.mesh.material)) {
        w.mesh.material.forEach((m) => m.dispose());
      } else {
        w.mesh.material.dispose();
      }
    });
    if (this.roomBoxFloor) {
      this.roomBoxFloor.geometry.dispose();
      if (Array.isArray(this.roomBoxFloor.material)) {
        this.roomBoxFloor.material.forEach((m) => m.dispose());
      } else {
        this.roomBoxFloor.material.dispose();
      }
    }
    if (this.roomBoxCeiling) {
      this.roomBoxCeiling.geometry.dispose();
      if (Array.isArray(this.roomBoxCeiling.material)) {
        this.roomBoxCeiling.material.forEach((m) => m.dispose());
      } else {
        this.roomBoxCeiling.material.dispose();
      }
    }
    if (this.roomFloorRoot) {
      this.disposeObject(this.roomFloorRoot);
      this.roomFloorRoot.removeFromParent();
    }
    if (this.roomUtilitiesRoot) {
      this.disposeObject(this.roomUtilitiesRoot);
      this.roomUtilitiesRoot.removeFromParent();
    }
    this.roomBoxGroup = null;
    this.roomBoxWalls = [];
    this.roomBoxFloor = null;
    this.roomBoxFloorOutline = null;
    this.roomBoxCeiling = null;
    this.roomFloorRoot = null;
    this.roomUtilitiesRoot = null;
  }

  /** Room 2.1: chão global fixo (25 m), independente da sala. Não redimensionar com bounds. */
  private ensureStaticSceneGround(): void {
    this.sceneManager.setGroundSize(this.defaultGroundSize, this.defaultGroundSize);
    this.sceneManager.setGroundPosition(0, 0);
  }

  /** Chamado pelo RoomManager quando a sala é criada/atualizada. Adiciona o grupo à cena e regista paredes/bounds. */
  setRoomFromManager(
    walls: WallEntryForViewer[],
    bounds: RoomBounds,
    group: THREE.Group
  ): void {
    if (this.roomBoxGroup && this.roomBoxGroup !== group) {
      this.sceneManager.root.remove(this.roomBoxGroup);
    }
    this.roomBoxGroup = group;
    this.roomBoxWalls = walls;
    this.roomBoxFloor = null;
    this.roomBoxFloorOutline = null;
    this.roomBoxCeiling = null;
    this.roomBounds = bounds;
    this.boundsCache.invalidateRoom();
    this.sceneManager.root.add(group);
    this.ensureStaticSceneGround();
    this.rebuildRoomFloorAndCeiling();
    this.applyRoomWallVisibility();
    this.setRoomCeilingVisible(this.roomCeilingVisible);
  }

  /** Chamado pelo RoomManager quando a sala é removida. Remove o grupo da cena e limpa estado. */
  clearRoomFromManager(): void {
    this.roomBuilder.clearRoom(true);
    if (this.roomBoxGroup) {
      this.sceneManager.root.remove(this.roomBoxGroup);
    }
    this.roomBoxWalls = [];
    this.roomBoxGroup = null;
    this.roomBoxFloor = null;
    this.roomBoxFloorOutline = null;
    this.roomBoxCeiling = null;
    this.roomFloorRoot = null;
    this.roomUtilitiesRoot = null;
    this.roomBounds = null;
    this.boundsCache.invalidateRoom();
    this.viewerState.setSelectedWallIndex(null);
    if (this.wallGizmo) this.wallGizmo.detach();
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
    this.ensureStaticSceneGround();
  }

  private getRoomFloorShape(expandM = 0): THREE.Shape | null {
    if (!this.roomBounds) return null;
    const { minX, maxX, minZ, maxZ } = this.roomBounds;
    const shape = new THREE.Shape();
    shape.moveTo(minX - expandM, minZ - expandM);
    shape.lineTo(maxX + expandM, minZ - expandM);
    shape.lineTo(maxX + expandM, maxZ + expandM);
    shape.lineTo(minX - expandM, maxZ + expandM);
    shape.lineTo(minX - expandM, minZ - expandM);
    return shape;
  }

  private clearRoomFloorRoot(): void {
    if (!this.roomFloorRoot) return;
    this.disposeObject(this.roomFloorRoot);
    this.roomFloorRoot.removeFromParent();
    this.roomFloorRoot = null;
    this.roomBoxFloor = null;
    this.roomBoxFloorOutline = null;
    this.roomBoxCeiling = null;
  }

  private rebuildRoomFloorAndCeiling(): void {
    if (!this.roomBoxGroup || !this.roomBounds) return;
    this.clearRoomFloorRoot();
    const sceneConfig = this.materialPipeline.getSceneMaterialConfig();
    const group = new THREE.Group();
    group.name = "room-floor-root";
    const expandM = getRoomFloorExpandM(this.roomFloorMode);
    const shape = this.getRoomFloorShape(expandM);
    if (!shape) return;
    const floorAppearance = getRoomFloorOverlayAppearance(this.backgroundMode);
    const floorGeom = new THREE.ShapeGeometry(shape);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = createRoomFloorOverlayMaterial(floorAppearance);
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.y = this.roomBounds.minY + 0.002;
    floor.name = "room-floor-root";
    floor.userData.isRoomFloor = true;
    floor.renderOrder = 1;
    group.add(floor);

    const outline = createRoomFloorOutline(
      this.roomBounds.minX,
      this.roomBounds.maxX,
      this.roomBounds.minZ,
      this.roomBounds.maxZ,
      expandM,
      this.roomBounds.minY + 0.004,
      floorAppearance.outlineColor
    );
    group.add(outline);

    const ceilingGeom = new THREE.ShapeGeometry(shape);
    ceilingGeom.rotateX(Math.PI / 2);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: sceneConfig.roomBox.color,
      roughness: sceneConfig.roomBox.roughness,
      metalness: sceneConfig.roomBox.metalness,
      transparent: true,
      opacity: Math.min(0.45, sceneConfig.roomBox.opacity),
      side: THREE.DoubleSide,
    });
    const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
    ceiling.position.y = this.roomBounds.maxY;
    ceiling.name = "room-ceiling";
    ceiling.userData.isRoomCeiling = true;
    ceiling.visible = this.roomCeilingVisible;
    group.add(ceiling);

    this.roomBoxGroup.add(group);
    this.roomFloorRoot = group;
    this.roomBoxFloor = floor;
    this.roomBoxFloorOutline = outline;
    this.roomBoxCeiling = ceiling;
    this.applyBackgroundMode();
  }

  private clearRoomUtilitiesRoot(): void {
    this.roomBoxWalls.forEach((entry) => {
      const toRemove = entry.mesh.children.filter((child) => child.userData?.roomUtilityId);
      toRemove.forEach((child) => {
        entry.mesh.remove(child);
        this.disposeObject(child);
      });
    });
    if (!this.roomUtilitiesRoot) return;
    this.roomUtilitiesRoot.removeFromParent();
    this.roomUtilitiesRoot = null;
  }

  private utilityColor(type: ProjectRoomUtility["type"]): number {
    if (type === "WaterPoint") return 0x38bdf8;
    if (type === "DrainPoint") return 0x64748b;
    return 0xfacc15;
  }

  private rebuildRoomUtilities(utilities: ProjectRoomUtility[]): void {
    this.clearRoomUtilitiesRoot();
    if (!this.roomBoxGroup || !utilities.length) return;
    const root = new THREE.Group();
    root.name = "room-utilities-root";
    const wallsByProjectId = new Map<string, THREE.Mesh>();
    this.roomBoxWalls.forEach((entry) => {
      const key = String(entry.mesh.userData.wallProjectId ?? entry.mesh.userData.wallId ?? entry.id);
      wallsByProjectId.set(key, entry.mesh);
    });
    utilities.forEach((utility) => {
      const wall = wallsByProjectId.get(utility.wallId);
      if (!wall) return;
      const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 1000;
      const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2600;
      const wallLenM = wallLenMm / 1000;
      const wallHeightM = wallHeightMm / 1000;
      const t = (wall.userData.wallThicknessM as number | undefined) ?? 0.12;
      const marker = new THREE.Group();
      marker.name = `room-utility-${utility.type}`;
      marker.userData.roomUtilityId = utility.id;
      marker.userData.roomUtility = { ...utility };
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.018),
        new THREE.MeshStandardMaterial({ color: this.utilityColor(utility.type), roughness: 0.55, metalness: 0.05 })
      );
      plate.userData.roomUtilityId = utility.id;
      marker.add(plate);
      const x = -wallLenM / 2 + Math.max(0, Math.min(wallLenMm, utility.positionAlongWall)) / 1000;
      const y = -wallHeightM / 2 + Math.max(0, Math.min(wallHeightMm, utility.heightMm)) / 1000;
      marker.position.set(x, y, t / 2 + 0.04);
      wall.add(marker);
    });
    this.roomBoxGroup.add(root);
    this.roomUtilitiesRoot = root;
    this.applyRoomWallVisibility();
  }

  private getRoomUtilityById(utilityId: string): THREE.Object3D | null {
    for (const wall of this.roomBoxWalls) {
      const found = wall.mesh.children.find((child) => child.userData?.roomUtilityId === utilityId);
      if (found) return found;
    }
    return null;
  }

  setRoomBounds(bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }): void {
    void bounds;
    // Compatibilidade legada: bounds diretos foram substituídos por RoomManager/createRoomWithDimensions.
    this.clearRoomBounds();
  }

  clearRoomBounds(): void {
    if (this.roomManager?.room) {
      this.roomManager.removeRoom();
      return;
    }
    this.roomBounds = null;
    this.ensureStaticSceneGround();
    this.clearRoomBox();
    this.roomBuilder.clearRoom(true);
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
    this.viewerState.setSelectedWallIndex(index !== null && this.roomBoxWalls.some((w) => w.id === index) ? index : null);
    if (this.wallGizmo) {
      if (this.viewerState.getWallEditMode() && this.viewerState.getSelectedWallIndex() !== null) {
        const wall = this.roomBoxWalls.find((w) => w.id === this.viewerState.getSelectedWallIndex())?.mesh;
        if (wall) this.wallGizmo.attach(wall);
      } else {
        this.wallGizmo.detach();
      }
    }
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
    this.onWallSelected?.(this.viewerState.getSelectedWallIndex());
  }

  selectRoomElementById(elementId: string | null): void {
    this.viewerState.setSelectedRoomElementId(elementId);
    if (elementId) this.viewerState.setSelectedRoomUtilityId(null);
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
  }

  selectRoomUtilityById(utilityId: string | null): void {
    this.viewerState.setSelectedRoomUtilityId(utilityId);
    if (utilityId) this.viewerState.setSelectedRoomElementId(null);
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
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
    this.viewerState.setCurrentTool(mode);
    this.refreshTransformControlsAttachment();
    this.applyTransformControlsMouseGuard();
  }

  /** Delega ao GizmoEngine / ViewerTools. */
  private refreshTransformControlsAttachment(): void {
    this.gizmoEngine.refreshAttachment();
  }

  /**
   * Extension point interno preservado para EventsManager.
   * Contrato atual: NO-OP, porque o refresh é controlado pelo lifecycle de drag.
   */
  private setTransformAttachmentRefreshSuspended(_v: boolean): void {
    void _v;
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
    this.selectionOutline.sanitizeStaleTarget((object) => this.isObjectAttachedToScene(object));
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
        this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap());
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
    this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap());
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
    this.edgeOutlineSystem?.syncRoot(this.sceneManager.root, this.getEdgeOutlineBoxesMap());
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
    return {
      viewerState: this.viewerState,
      getTurntableEnabled: () => this.turntableEnabled,
      setTurntableEnabled: (enabled) => {
        this.turntableEnabled = enabled;
      },
      isMobile: this.isMobile,
      lights: this.lights,
      ensureLightingEngine: () => this.ensureLightingEngine(),
      getLightingEngine: () => this.lightingEngine,
      ensureComposerEngine: () => this.ensureComposerEngine(),
      getComposerEngine: () => this.composerEngine,
      getUltraPerformanceMode: () => this.ultraPerformanceMode,
      setUltraPerformanceModeFlag: (active) => {
        this.ultraPerformanceMode = active;
      },
      getUltraPerformanceModeOptions: () => this.ultraPerformanceModeOptions,
      setUltraPerformanceModeOptionsState: (options) => {
        this.ultraPerformanceModeOptions = options;
      },
      getUltraRenderState: () => this.ultraRenderState,
      setUltraRenderState: (state) => {
        this.ultraRenderState = state;
      },
      getMaterialQuality: () => this.materialQuality,
      setMaterialQualityState: (quality) => {
        this.materialQuality = quality;
      },
      getReflectionsEnabled: () => this.reflectionsEnabled,
      setReflectionsEnabledState: (enabled) => {
        this.reflectionsEnabled = enabled;
      },
      getPhotoModeEnabled: () => this.photoModeEnabled,
      setPhotoModeEnabledState: (enabled) => {
        this.photoModeEnabled = enabled;
      },
      getMatteMode: () => this.matteMode,
      setMatteModeState: (enabled) => {
        this.matteMode = enabled;
      },
      getBackgroundMode: () => this.backgroundMode,
      setBackgroundModeState: (mode) => {
        this.backgroundMode = mode;
      },
      getGlossIntensity: () => this.glossIntensity,
      setGlossIntensityState: (value) => {
        this.glossIntensity = value;
      },
      getReflectionUpdateIntervalFrames: () => this.reflectionUpdateIntervalFrames,
      setReflectionUpdateIntervalFrames: (frames) => {
        this.reflectionUpdateIntervalFrames = frames;
      },
      baseToneMappingExposure: this.baseToneMappingExposure,
      defaultPixelRatio: this.defaultPixelRatio,
      rendererManager: this.rendererManager,
      sceneEngine: this.sceneEngine,
      sceneManager: this.sceneManager,
      getRoomBoxFloor: () => this.roomBoxFloor,
      getRoomBoxFloorOutline: () => this.roomBoxFloorOutline,
      displayMaterials: this.displayMaterials,
      ultraMaterials: this.ultraMaterials,
      materialPipeline: this.materialPipeline,
      getRoomBounds: () => this.roomBounds,
      boxes: this.boxes,
      boundingBox: this._boundingBox,
      center: this._center,
      setMaterialMode: (mode) => this.setMaterialMode(mode),
      updateCanvasSize: () => this.updateCanvasSize(),
      requestRender: () => this.requestRender(),
    };
  }

  private getFinishOpsDeps(): ViewerCoreFinishOpsDeps {
    return {
      orlaVisualizer: this.orlaVisualizer,
      remateVisualizer: this.remateVisualizer,
      tampoVisualizer: this.tampoVisualizer,
      hematiVisualizer: this.hematiVisualizer,
      rodapeVisualizer: this.rodapeVisualizer,
      getRemateVisualBridge: () => this.remateVisualBridge,
      setRemateVisualBridge: (bridge) => {
        this.remateVisualBridge = bridge;
      },
      setRodapeVisualBridge: (bridge) => {
        this.rodapeVisualBridge = bridge;
      },
      setDivSepVisualBridge: (bridge) => {
        this.divSepVisualBridge = bridge;
      },
      boxes: this.boxes,
      pendingViewerVisualSync: this.pendingViewerVisualSync,
      isTransformDragging: () => this.viewerState.getTransformControlsDragging(),
      refreshViewerAttachmentsAfterMeshMutation: () => this.refreshViewerAttachmentsAfterMeshMutation(),
      applyPanelVisibilityForObject: (root) => this.applyPanelVisibilityForObject(root),
      viewerState: this.viewerState,
      onRemateSelected: this.onRemateSelected,
      onRodapeSelected: this.onRodapeSelected,
      refreshTransformControlsAttachment: () => this.refreshTransformControlsAttachment(),
      refreshOutlineTarget: () => this.refreshOutlineTarget(),
      notifyRemateTransform: () => this.notifyRemateTransform(),
      syncRemateVisuals: () => this.syncRemateVisuals(),
      lockEnabled: this.lockEnabled,
      resolveFinishCollisionAfterSync: (params) => this.resolveFinishCollisionAfterSync(params),
      getRemateMesh: (remateId) => this.getRemateMesh(remateId),
    };
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
    return {
      getCanvas: () => this.rendererManager.renderer.domElement,
      getTransformControlsDragging: () => this.viewerState.getTransformControlsDragging(),
      getSuppressNextCanvasClick: () => this.viewerState.getSuppressNextCanvasClick(),
      setSuppressNextCanvasClick: (v) => { this.viewerState.setSuppressNextCanvasClick(v); },
      getHighlightEnabled: () => this.viewerState.getHighlightEnabled(),
      getHighlightManager: () => this.highlightManager,
      getHighlightIntersects: (e) => this.getHighlightIntersects(e),
      getBoxIdByMesh: (mesh) => this.getBoxIdByMesh(mesh),
      setSelectedBox: (id, options) => this.setSelectedBox(id, options),
      setHoveredBox: (id) => this.setHoveredBox(id),
      setHoveredRemate: (id) => this.setHoveredRemate(id),
      getOnRoomElementSelected: () => this.onRoomElementSelected,
      getOnRoomUtilitySelected: () => this.onRoomUtilitySelected,
      getOnWallSelected: () => this.onWallSelected,
      getOnBoxSelected: () => this.onBoxSelected,
      getOnMultiSelectToggle: () => this.onMultiSelectToggle,
      getOnRemateSelected: () => this.onRemateSelected,
      getPlacementMode: () => this.viewerState.getPlacementMode(),
      getOnRoomElementPlaced: () => this.onRoomElementPlaced,
      getWallHitAtPointer: (e) => this.getWallHitAtPointer(e),
      getRoomBuilder: () => this.roomBuilder,
      setPlacementMode: (mode) => this.viewerState.setPlacementMode(mode),
      getBoxIdAtPointer: (e) => this.getBoxIdAtPointer(e),
      getHematiIdAtPointer: (e) => this.getHematiIdAtPointer(e),
      getRodapeIdAtPointer: (e) => this.getRodapeIdAtPointer(e),
      getRemateIdAtPointer: (e) => this.getRemateIdAtPointer(e),
      getDivSepHitAtPointer: (e) => this.getDivSepHitAtPointer(e),
      selectHemati: (id) => this.selectHemati(id),
      selectRodape: (id) => this.selectRodape(id),
      selectRemate: (id) => this.selectRemate(id),
      selectDivSep: (hit) => this.selectDivSep(hit),
      getSelectedBoxId: () => this.viewerState.getSelectedBox(),
      getSelectedRemateId: () => this.viewerState.getSelectedRemate(),
      getSelectedDivSep: () => this.viewerState.getSelectedDivSep(),
      getRoomElementAtPointer: (e) => this.getRoomElementAtPointer(e),
      getSelectedWallIndex: () => this.viewerState.getSelectedWallIndex(),
      setSelectedWallIndex: (v) => { this.viewerState.setSelectedWallIndex(v); },
      getSelectedRoomElementId: () => this.viewerState.getSelectedRoomElementId(),
      setSelectedRoomElementId: (v) => { this.viewerState.setSelectedRoomElementId(v); },
      getSelectedRoomUtilityId: () => this.viewerState.getSelectedRoomUtilityId(),
      setSelectedRoomUtilityId: (v) => { this.viewerState.setSelectedRoomUtilityId(v); },
      getRoomUtilityAtPointer: (e) => this.getRoomUtilityAtPointer(e),
      refreshTransformControlsAttachment: () => this.refreshTransformControlsAttachment(),
      setTransformAttachmentRefreshSuspended: (v) => this.setTransformAttachmentRefreshSuspended(v),
      refreshOutlineTarget: () => this.refreshOutlineTarget(),
      getRoomBoxWalls: () => this.roomBoxWalls,
      getWallGizmo: () => this.wallGizmo,
      getWallEditMode: () => this.viewerState.getWallEditMode(),
      getWallIdAtPointer: (e) => this.getWallIdAtPointer(e),
      logTransformDiagnostic: (name, data) => this.logTransformDiagnostic(name, data),
      getTransformGizmoIntersections: (e) => this.getTransformGizmoIntersections(e),
      getWallGizmoDragging: () => this.viewerState.getWallGizmoDragging(),
      setWallGizmoDragging: (v) => { this.viewerState.setWallGizmoDragging(v); },
      getDoorHitAtPointer: (e) => this.getDoorHitAtPointer(e),
      getDrawerHitAtPointer: (e) => this.getDrawerHitAtPointer(e),
      getBoxBodyHitAtPointer: (e) => this.getBoxBodyHitAtPointer(e),
      getLayerSelectionHitAtPointer: (e) => this.getContextMenuLayerHit(e),
      encodeLayerHitToSelectionId: (hit) => encodeSelectionIdFromLayerHit(hit),
      getPointerSelectionEncodedId: (e) => this.getPointerSelectionEncodedId(e),
      getOnDoorLayerDoubleClick: () => this.onDoorLayerDoubleClick,
      getOnDrawerLayerDoubleClick: () => this.onDrawerLayerDoubleClick,
      getOnDrawerLayerClick: () => this.onDrawerLayerClick,
      getOnBoxDoubleClick: () => this.onBoxDoubleClick,
      getPointerActionForButton: (button) => {
        const mapping = getMouseInputMapping(this.mouseInputPreset);
        return getPointerActionForButton(mapping, button);
      },
      shouldBlockPointerDownForSelection: (button) => {
        const mapping = getMouseInputMapping(this.mouseInputPreset);
        return shouldBlockPointerDownForSelection(mapping, button);
      },
      setCameraControlsEnabled: (enabled) => {
        if (this.controls?.controls) {
          applyCameraNavigationLock(this.controls.controls, enabled);
        }
      },
      getInternalSelectionEnabled: () => this.viewerState.getInternalSelectionEnabled(),
      getInternalSelectionHit: (e) => this.getInternalSelectionHit(e),
      setInternalSelection: (selection) => this.setInternalSelection(selection),
      getPointerWorldHit: (event) => {
        const hit = this.pointerPicking.getPointerWorldHit(event);
        return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
      },
      setTransformGizmoAnchor: (point) => this.viewerState.setTransformGizmoAnchor(point),
      getIndustrialDesignWorkspaceEnabled: () => this.industrialDesignMode.isEnabled(),
      handleIndustrialDesignPointerClick: (event) => this.industrialDesignMode.handlePointerClick(event),
    };
  }

  /** API mínima para o ViewerTools (attachment, outline, clamp). */
  private getToolsEngineApi(): IViewerToolsEngine {
    return {
      getTransformControls: () => this.transformControls,
      getTransformControlsHelper: () => this.transformControlsHelper,
      getCurrentTool: () => this.viewerState.getCurrentTool(),
      getSelectedBoxId: () => this.viewerState.getSelectedBox(),
      getSelectedHematiId: () => this.viewerState.getSelectedHemati(),
      getSelectedRodapeId: () => this.viewerState.getSelectedRodape(),
      getSelectedRemateId: () => this.viewerState.getSelectedRemate(),
      getSelectedDivSep: () => this.viewerState.getSelectedDivSep(),
      getDivSepMesh: (selection) => this.getDivSepMesh(selection),
      getHematiMesh: (hematiId) => this.getHematiMesh(hematiId),
      getRodapeMesh: (rodapeId) => this.getRodapeMesh(rodapeId),
      getRemateMesh: (remateId) => this.getRemateMesh(remateId),
      getBoxEntry: (id) => this.boxes.get(id),
      getSelectedWallIndex: () => this.viewerState.getSelectedWallIndex(),
      getRoomBoxWalls: () => this.roomBoxWalls,
      getSelectedRoomElementId: () => this.viewerState.getSelectedRoomElementId(),
      getRoomElementById: (id) => this.roomBuilder.getElementById(id),
      getSelectedRoomUtilityId: () => this.viewerState.getSelectedRoomUtilityId(),
      getRoomUtilityById: (id) => this.getRoomUtilityById(id),
      getTransformGizmoSizeForBox: (entry) => this.getTransformGizmoSizeForBox(entry),
      setTransformHelperVisible: (visible) => {
        if (this.transformControlsHelper) this.transformControlsHelper.visible = visible;
      },
      applyTransformControlsMouseGuard: () => this.applyTransformControlsMouseGuard(),
      logTransformDiagnostic: (name, data) => this.logTransformDiagnostic(name, data),
      getSelectionOutline: () => this.selectionOutline.getGroup(),
      getSelectionOutlineMaterial: () => this.selectionOutline.getMaterial(),
      getHoveredBoxId: () => this.viewerState.getHoveredBox(),
      getHoveredRemateId: () => this.viewerState.getHoveredRemate(),
      getBoxesIntersectingWalls: () => this.boxesIntersectingWalls,
      setOutlineTarget: (mesh, opacity, colorHex) => this.setOutlineTarget(mesh, opacity, colorHex),
      clampTransform: () => this.clampTransform(),
      getGroupGizmo: () => {
        if (!this.groupGizmo) throw new Error("GroupGizmo not initialized");
        return this.groupGizmo;
      },
      getGroupTransformMemberIds: () => this.viewerState.getGroupTransformMemberIds(),
      resolveMemberMesh: (encoded) => this.resolveMemberMesh(encoded),
      applyGroupPivotTransform: () => this.applyGroupPivotTransform(),
      notifyGroupTransform: () => this.notifyGroupTransform(),
      clampGroupTransform: () => this.clampGroupTransform(),
    };
  }

  private setOutlineTarget(mesh: THREE.Object3D | null, opacity: number, colorHex: number): void {
    this.selectionOutline.setTarget(mesh, opacity, colorHex);
  }

  /** Obtém boxId a partir de um mesh (grupo ou filho/GLB); sobe na hierarquia até encontrar userData.boxId ou o grupo da caixa. */
  private getBoxIdByMesh(mesh: THREE.Object3D): string | null {
    return this.pointerPicking.getBoxIdByMesh(mesh);
  }

  private setSelectedBox(id: string | null, options?: { preserveGroupMembers?: boolean }) {
    if (import.meta.env.DEV) {
      devLogger.debug("[SELECTION][ViewerCore] setSelectedBox:entrada", {
        nextBoxId: id,
        currentSelectionBefore: this.viewerState.getSelectedBox(),
        callerStack:
          id == null
            ? new Error("[SELECTION] setSelectedBox(null) trace").stack
            : undefined,
      });
    }
    if (this.viewerState.getSelectedBox() === id) {
      if (import.meta.env.DEV) {
        devLogger.debug("[SELECTION][ViewerCore] setSelectedBox:sem-mudanca", {
          sameBoxId: id,
        });
      }
      if (import.meta.env.DEV) {
        devLogger.debug("[SELECTION][ViewerCore] onBoxSelected:emit", {
          boxId: id,
          reason: "same-selection-short-circuit",
        });
      }
      this.onBoxSelected?.(id);
      return;
    }
    this.viewerState.setSelectedBox(id);
    this.viewerState.setSelectedRemate(null);
    this.viewerState.setSelectedDivSep(null);
    this.viewerState.setSelectedWallIndex(null);
    this.viewerState.setSelectedRoomElementId(null);
    if (!options?.preserveGroupMembers) {
      this.viewerState.clearGroupTransformMemberIds();
    }
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
    if (import.meta.env.DEV) {
      devLogger.debug("[SELECTION][ViewerCore] setSelectedBox:apos-update-state", {
        nextBoxId: id,
        currentSelectionAfter: this.viewerState.getSelectedBox(),
      });
      devLogger.debug("[SELECTION][ViewerCore] onBoxSelected:emit", {
        boxId: id,
      });
    }
    this.onBoxSelected?.(id);
    this.selectedBoxChangeListeners.forEach((cb) => {
      try {
        cb(id);
      } catch {
        /* ignore */
      }
    });
    if (id == null) {
      this.measurementEngine.onSelectionChanged(null);
      this.setInternalSelection(null);
      return;
    }
    this.measurementEngine.onSelectionChanged(id);
  }

  /**
   * Listener único de objectChange — protegido contra reentrância quando Lock/colisão
   * altera mesh.position e o TransformControls re-emite objectChange na mesma stack.
   */
  private handleTransformObjectChange(): void {
    if (this.isApplyingTransformConstraints) return;
    this.isApplyingTransformConstraints = true;
    try {
      if (this.groupGizmo?.isActive()) {
        this.groupGizmo.applyPivotTransform();
      }
      if (
        this.viewerState.getTransformControlsDragging() &&
        this.viewerState.getSelectedBox() &&
        this.shiftKeyHeld &&
        this.dragStartZForShiftLock !== undefined
      ) {
        const obj = this.transformControls!.object;
        if (obj && "position" in obj) (obj as THREE.Object3D).position.z = this.dragStartZForShiftLock;
      }
      this.viewerTools.applyCurrentTool();
      this.measurementEngine.onRulerMovementTick("transform");
      if (this.groupGizmo?.isActive()) {
        this.notifyGroupTransform();
      } else if (this.viewerState.getSelectedRemate()) {
        this.notifyRemateTransform();
      } else {
        this.notifyBoxTransform();
      }
      this.logTransformDiagnostic("drag(objectChange)");
    } finally {
      this.isApplyingTransformConstraints = false;
    }
  }

  /** Fim de drag unificado — evita duplicação mouseUp + dragging-changed. */
  private finishTransformDrag(_source: "mouseUp" | "dragging-changed"): void {
    const stamp = performance.now();
    if (!shouldProcessTransformDragEnd(this.transformDragEndStamp, stamp)) return;
    this.transformDragEndStamp = stamp;
    this.dragStartZForShiftLock = undefined;
    this.viewerState.setTransformControlsDragging(false);
    this.overlayCoordinator.clearTransientOverlays();
    this.smartSnappingEngine.onDragEnd();
    this.smartAlignSnapEngine.onDragEnd();
    this.remateSmartSnapping.onDragEnd();
    this.viewerState.setSuppressNextCanvasClick(true);
    if (this.groupGizmo?.isActive()) {
      this.notifyGroupTransform({ recordHistory: true });
    }
    this.viewerTools.restoreTransformGizmoPivot();
    this.viewerTools.applyCurrentTool();
    this.notifyBoxTransform();
    this.notifyRemateTransform();
    this.notifyHematiTransform();
    this.notifyRodapeTransform();
    this.notifyDivSepTransform();
    this.notifyWallTransform();
    this.notifyRoomElementTransform();
    this.notifyRoomUtilityTransform();
    historyManager.endDragSession();
    this.onTransformDragEnd?.();
    this.flushDeferredBoxStructureUpdates();
    this.flushDeferredViewerVisualSyncs();
    this.refreshViewerAttachmentsAfterMeshMutation();
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

  private collectAllSnapEntities(): SmartSnapEntity[] {
    const entities: SmartSnapEntity[] = [];
    this.boxes.forEach((entry, id) => {
      entities.push({ kind: "box", id, mesh: entry.mesh as THREE.Mesh });
    });
    for (const piece of this.remateVisualBridge?.listRematePieces() ?? []) {
      const raw = this.getRemateMesh(piece.id);
      const mesh = resolveRemateTransformRoot(raw) ?? raw;
      if (!mesh || !(mesh instanceof THREE.Mesh)) continue;
      entities.push({
        kind: "remate",
        id: piece.id,
        mesh,
        parentBoxId: piece.parentBoxId,
      });
    }
    for (const cfg of this.rodapeVisualBridge?.listBoxRodapeConfigs() ?? []) {
      for (const rodape of cfg.rodapes) {
        const mesh = this.rodapeVisualizer.getMeshByRodapeId(rodape.id);
        if (!mesh || !(mesh instanceof THREE.Mesh)) continue;
        entities.push({
          kind: "rodape",
          id: rodape.id,
          mesh,
          parentBoxId: cfg.boxId,
        });
      }
    }
    return entities;
  }

  private buildSmartAlignSnapContextForDrag(): SmartAlignSnapContext {
    return {
      boxes: this.boxes,
      captureRadiusM: mmToM(DEFAULT_UNIFIED_CAPTURE_MM),
      magnetStrength: DEFAULT_UNIFIED_MAGNET,
      rematePieces: this.remateVisualBridge?.listRematePieces() ?? [],
      rodapes: (this.rodapeVisualBridge?.listBoxRodapeConfigs() ?? []).flatMap((c) => c.rodapes),
      getBoxConfig: (boxId) => this.remateVisualBridge?.getBoxConfig(boxId) ?? null,
      getWorldAabb: (mesh) => getEntityWorldBoxAabb(mesh, "box"),
      roomBounds: this.roomBounds,
      roomBoundsFull: this.roomBounds,
      roomOpenings: this.getRoomOpeningsForSnapping(),
      wallOffsetMm: this.smartSnappingEngine.getWallOffset(),
      explicitModeActive: false,
      allEntities: this.collectAllSnapEntities(),
    };
  }

  private syncSmartAlignSnapOverlayFromEngine(): void {
    if (!this.settings.enableSmartAlignSnap) return;
    const state = this.smartAlignSnapEngine.getOverlayState();
    if (state.visible) {
      this.smartAlignOverlay.setState(state);
    } else {
      this.clearSmartAlignSnapOverlay();
    }
  }

  private applyDynamicAlignSnap(params: SnapAlignTarget): void {
    this.snapEngine.applyDuringTranslate(params);
  }

  private buildDisabledSmartSnapContext(): SmartAlignSnapContext {
    return {
      boxes: this.boxes,
      captureRadiusM: 0,
      magnetStrength: 0,
      rematePieces: [],
      rodapes: [],
      getBoxConfig: () => null,
      getWorldAabb: (mesh) => {
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        return { min: box.min.clone(), max: box.max.clone(), center: box.getCenter(new THREE.Vector3()) };
      },
      roomBounds: null,
      roomBoundsFull: this.roomBounds,
      roomOpenings: [],
      wallOffsetMm: this.smartSnappingEngine.getWallOffset(),
      explicitModeActive: false,
      allEntities: [],
    };
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
    this.smartAlignOverlay.clear();
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
    if (this.groupGizmo?.isActive()) {
      this.clampGroupTransform();
      return;
    }
    if (this.viewerState.getSelectedRoomElementId() || this.viewerState.getSelectedRoomUtilityId()) {
      this.clampSelectedWallChildTransform();
      return;
    }

    const selectedRemateId = this.viewerState.getSelectedRemate();
    const isDragging = this.viewerState.getTransformControlsDragging();
    const currentTool = this.viewerState.getCurrentTool();

    const selectedDivSep = this.viewerState.getSelectedDivSep();
    if (selectedDivSep) {
      const mesh = this.getDivSepMesh(selectedDivSep);
      const obj = this.transformControls?.object;
      if (isDragging && mesh && obj === mesh && currentTool === "translate") {
        const entry = this.boxes.get(selectedDivSep.boxId);
        const ctx = this.divSepVisualBridge?.getDivSepDragContext(
          selectedDivSep.boxId,
          selectedDivSep.kind,
          selectedDivSep.itemId
        );
        if (entry && ctx) {
          const dragStart = mesh.userData.divSepDragStart as
            | { x: number; y: number; z: number }
            | undefined;
          if (selectedDivSep.kind === "sep") {
            mesh.position.x = dragStart?.x ?? mesh.position.x;
            mesh.position.z = dragStart?.z ?? mesh.position.z;
            mesh.position.y = clampSeparadorLocalY(
              mesh.position.y,
              entry.height,
              ctx.box,
              ctx.item as SeparadorItem
            );
          } else {
            mesh.position.y = dragStart?.y ?? mesh.position.y;
            mesh.position.z = dragStart?.z ?? mesh.position.z;
            mesh.position.x = clampDivisorLocalX(
              mesh.position.x,
              entry.width,
              ctx.box,
              ctx.item as DivisorItem
            );
          }
        }
      }
      return;
    }

    if (selectedRemateId) {
      const rawMesh = this.getRemateMesh(selectedRemateId);
      const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
      const obj = this.transformControls?.object;
      if (isDragging && mesh && obj === mesh) {
        const piece = this.remateVisualBridge?.listRematePieces().find((r) => r.id === selectedRemateId);
        const angular = isTampoAngularConfig(piece?.angleConfig, piece?.height);
        const boxId = piece?.parentBoxId ?? (mesh.userData.boxId as string | undefined);
        const entry = boxId ? this.boxes.get(boxId) : undefined;

        const snapTarget = mesh as THREE.Mesh;
        const isLCimaComposite = mesh.userData?.isRemateLComposite === true;

        if (currentTool === "translate" && entry && piece && boxId && !isLCimaComposite && !angular) {
          const cfg = this.remateVisualBridge?.getBoxConfig(boxId);
          if (cfg) {
            this.remateSmartSnapping.applyDuringTranslate({
              mesh: snapTarget,
              boxEntry: entry,
              boxConfig: cfg,
            });
          }
        } else if (currentTool === "translate" && piece && (!boxId || angular) && !isLCimaComposite) {
          this.remateSmartSnapping.applyStandaloneGridSnap(snapTarget);
        } else if (currentTool === "rotate" && !isLCimaComposite && !angular) {
          applyRemateRotationSnapToMesh(snapTarget, entry?.mesh ?? null);
        }

        if (currentTool === "translate" && !isLCimaComposite && !angular) {
          this.applyDynamicAlignSnap({
            mesh: snapTarget,
            entity: { kind: "remate", id: selectedRemateId, parentBoxId: boxId },
            isDragging,
            currentTool,
          });
        }

        if (currentTool === "translate" && mesh && obj === mesh && !angular) {
          const boxId = piece?.parentBoxId ?? (mesh.userData.boxId as string | undefined);
          this.applyFinishCollisionConstraint(mesh, boxId, selectedRemateId);
        }
      }
      return;
    }

    if (this.viewerState.getSelectedHemati()) {
      return;
    }

    const selectedRodapeId = this.viewerState.getSelectedRodape();
    if (selectedRodapeId) {
      const mesh = this.rodapeVisualizer.getMeshByRodapeId(selectedRodapeId);
      const obj = this.transformControls?.object;
      if (isDragging && mesh && obj === mesh && currentTool === "translate") {
        const boxId = mesh.userData.boxId as string | undefined;
        this.applyDynamicAlignSnap({
          mesh,
          entity: { kind: "rodape", id: selectedRodapeId, parentBoxId: boxId },
          isDragging,
          currentTool,
        });
        this.applyFinishCollisionConstraint(mesh, boxId, undefined, selectedRodapeId);
      }
      return;
    }

    const selectedBoxId = this.viewerState.getSelectedBox();
    if (selectedBoxId && isDragging && currentTool === "translate") {
      const entry = this.boxes.get(selectedBoxId);
      const obj = this.transformControls?.object;
      if (entry && obj === entry.mesh) {
        this.snapEngine.applyBoxTranslatePipeline({
          align: {
            mesh: entry.mesh,
            entity: { kind: "box", id: selectedBoxId },
            isDragging,
            currentTool,
          },
          clampCtx: this.getClampTransformContext(),
        });
        return;
      }
    }

    this.constraints.clampTransform(this.getClampTransformContext());
  }

  private getClampTransformContext(): ClampTransformContext {
    return {
      transformControls: this.transformControls,
      selectedBoxId: this.viewerState.getSelectedBox(),
      selectedWallIndex: this.viewerState.getSelectedWallIndex(),
      boxes: this.boxes,
      currentTool: this.viewerState.getCurrentTool(),
      lockEnabled: this.lockEnabled,
      roomBounds: this.roomBounds,
      roomBoxWalls: this.roomBoxWalls,
      applyFloorConstraint: (obj) => this.applyFloorConstraint(obj),
      applyRoomConstraint: (obj, options) => this.applyRoomConstraint(obj, options),
      isMeshInsideOrTouchingRoom: (obj) => this.isMeshInsideOrTouchingRoom(obj),
      clearSnapState: (obj) => this.clearSnapState(obj),
      shouldUseFeetLock: (entry) => this.shouldUseFeetLock(entry),
      getFixedYForCabinet: (entry) => this.getFixedYForCabinet(entry),
      updateBoxesIntersectingWalls: () => this.updateBoxesIntersectingWalls(),
      setLastSnapDebugData: (data) => {
        this.lastSnapDebugData = data;
      },
      snapMeshToNearestMainWall: (mesh, walls) => this.snapEngine.snapMeshToNearestMainWall(mesh, walls),
    };
  }

  private clampSelectedWallChildTransform(): void {
    const selectedId = this.viewerState.getSelectedRoomElementId() ?? this.viewerState.getSelectedRoomUtilityId();
    if (!selectedId) return;
    const object =
      this.viewerState.getSelectedRoomElementId()
        ? this.roomBuilder.getElementById(selectedId)
        : this.getRoomUtilityById(selectedId);
    if (!object || !(object.parent instanceof THREE.Mesh)) return;
    const wall = object.parent as THREE.Mesh;
    const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 1000;
    const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2600;
    const wallLenM = wallLenMm / 1000;
    const wallHeightM = wallHeightMm / 1000;
    object.position.z = ((wall.userData.wallThicknessM as number | undefined) ?? 0.12) / 2 + 0.04;
    const widthMm =
      this.viewerState.getSelectedRoomElementId()
        ? ((object.userData.config as DoorWindowConfig | undefined)?.widthMm ?? 0)
        : 0;
    const heightMm =
      this.viewerState.getSelectedRoomElementId()
        ? ((object.userData.config as DoorWindowConfig | undefined)?.heightMm ?? 0)
        : 0;
    const minX = -wallLenM / 2 + widthMm / 2000;
    const maxX = wallLenM / 2 - widthMm / 2000;
    const minY = -wallHeightM / 2 + heightMm / 2000;
    const maxY = wallHeightM / 2 - heightMm / 2000;
    object.position.x = THREE.MathUtils.clamp(object.position.x, minX, maxX);
    object.position.y = THREE.MathUtils.clamp(object.position.y, minY, maxY);
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
    if (!this.roomBounds) return;
    const cam = this.cameraManager.camera;
    const wallsMain = this.roomBoxWalls
      .map((w) => w.mesh)
      .filter((m) => m.userData?.isMainWall === true);

    updateWallCulling(cam, this.roomBounds, wallsMain);
    this.applyRoomWallVisibility();
  }

  private applyRoomWallVisibility(): void {
    this.roomBoxWalls.forEach((entry) => {
      if (!this.hiddenRoomWallIds.has(entry.id)) return;
      entry.mesh.visible = false;
      entry.mesh.children.forEach((child) => {
        if (child.userData?.elementId || child.userData?.roomUtilityId) child.visible = false;
      });
    });

    // Override manual continua com prioridade.
    if (this.manualHiddenWallId !== null) {
      this.roomBoxWalls.forEach((entry) => {
        if (entry.id === this.manualHiddenWallId) {
          entry.mesh.visible = false;
        }
      });
    }
  }

  private getWallIdInFrontOfCamera(): number | null {
    return this.pointerPicking.getWallIdInFrontOfCamera();
  }

  /** Esconde/mostra uma parede manualmente. Auto-hide continua ativo. */
  setManualWallHidden(active: boolean): void {
    if (!active) {
      this.manualHiddenWallId = null;
      this.roomBoxWalls.forEach((w) => {
        w.mesh.visible = true;
      });
      return;
    }
    const wallId = this.viewerState.getSelectedWallIndex() ?? this.getWallIdInFrontOfCamera();
    if (wallId === null) return;
    this.manualHiddenWallId = wallId;
    this.roomBoxWalls.forEach((w) => {
      if (w.id === wallId) w.mesh.visible = false;
    });
  }

  getManualWallHidden(): boolean {
    return this.manualHiddenWallId !== null;
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

  private getEdgeOutlineBoxesMap(): ReadonlyMap<string, EdgeOutlineBoxEntry> {
    const map = new Map<string, EdgeOutlineBoxEntry>();
    this.boxes.forEach((entry, id) => {
      map.set(id, {
        mesh: entry.mesh,
        width: entry.width,
        height: entry.height,
        carcassDepth: entry.carcassDepth,
        depth: entry.depth,
        cadOnly: entry.cadOnly,
      });
    });
    return map;
  }

  private isMeshInsideOrTouchingRoom(movingMesh: THREE.Object3D, tolerance = 0.02): boolean {
    return isMeshInsideOrTouchingRoomImpl(this.getRoomUtilsDeps(), movingMesh, tolerance);
  }

  private getRoomOpeningsForSnapping(): import("./snapping/smartSnappingTypes").RoomOpeningLike[] {
    return getRoomOpeningsForSnappingImpl(this.getRoomUtilsDeps());
  }

  private notifyBoxTransform() {
    if (!this.viewerState.getSelectedBox()) return;
    const entry = this.boxes.get(this.viewerState.getSelectedBox());
    if (!entry) return;
    const p = entry.mesh.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      console.warn("[sanity] posição inválida em notifyBoxTransform — ignorado");
      return;
    }
    const { x, y, z } = p;
    const r = entry.mesh.rotation;
    this.onBoxTransform?.(this.viewerState.getSelectedBox(), { x, y, z }, { x: r.x, y: r.y, z: r.z });
  }

  private clearSnapState(object: THREE.Object3D): void {
    clearSnapUserData(object);
  }

  private getTransformGizmoSizeForBox(entry: { width: number; height: number; depth: number }): number {
    return computeTransformGizmoSizeForBox(entry);
  }

  private notifyWallTransform() {
    if (this.viewerState.getSelectedWallIndex() === null) return;
    const wall = this.roomBoxWalls.find((w) => w.id === this.viewerState.getSelectedWallIndex())?.mesh;
    if (!wall) return;
    const rotationDeg = (wall.rotation.y * 180) / Math.PI;
    if (
      this.roomManager?.room &&
      this.roomManager.locked &&
      this.viewerState.getSelectedWallIndex() >= 0 &&
      this.viewerState.getSelectedWallIndex() <= 3
    ) {
      this.roomManager.onMainWallTransformed(
        this.viewerState.getSelectedWallIndex(),
        { x: wall.position.x, z: wall.position.z },
        rotationDeg
      );
    }
    const wallAfter = this.roomBoxWalls.find((w) => w.id === this.viewerState.getSelectedWallIndex())?.mesh;
    if (wallAfter && this.onWallTransform) {
      const { x, z } = wallAfter.position;
      const rotDeg = (wallAfter.rotation.y * 180) / Math.PI;
      this.onWallTransform(this.viewerState.getSelectedWallIndex(), { x, z }, rotDeg);
    }
    this.roomManager?.refreshDynamicBounds();
  }

  private notifyRoomElementTransform() {
    if (!this.viewerState.getSelectedRoomElementId() || !this.onRoomElementTransform) return;
    const element = this.roomBuilder.getElementById(this.viewerState.getSelectedRoomElementId());
    if (!element || !element.parent) return;
    const wall = element.parent as THREE.Mesh;
    const wallLenMm = (wall.userData.wallLengthMm as number) ?? 4000;
    const wallHeightMm = (wall.userData.wallHeightMm as number) ?? 2800;
    const wallLenM = wallLenMm * 0.001;
    element.updateMatrixWorld(true);
    wall.updateMatrixWorld(true);
    const localPos = new THREE.Vector3();
    element.getWorldPosition(localPos);
    wall.worldToLocal(localPos);
    const cur = element.userData.config as DoorWindowConfig;
    let horizontalOffsetMm = (localPos.x + wallLenM / 2) * 1000 - cur.widthMm / 2;
    let floorOffsetMm = localPos.y * 1000 - cur.heightMm / 2;
    horizontalOffsetMm = Math.max(0, Math.min(wallLenMm - cur.widthMm, horizontalOffsetMm));
    floorOffsetMm = Math.max(0, Math.min(wallHeightMm - cur.heightMm, floorOffsetMm));
    horizontalOffsetMm = snapHorizontalOffset(horizontalOffsetMm, cur.widthMm, wallLenMm, true);
    const config: DoorWindowConfig = {
      ...cur,
      horizontalOffsetMm,
      floorOffsetMm,
    };
    this.onRoomElementTransform(this.viewerState.getSelectedRoomElementId(), config);
  }

  private notifyRoomUtilityTransform() {
    const utilityId = this.viewerState.getSelectedRoomUtilityId();
    if (!utilityId || !this.onRoomUtilityTransform) return;
    const utility = this.getRoomUtilityById(utilityId);
    if (!utility || !(utility.parent instanceof THREE.Mesh)) return;
    const wall = utility.parent as THREE.Mesh;
    const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 1000;
    const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2600;
    const wallLenM = wallLenMm / 1000;
    let positionAlongWall = (utility.position.x + wallLenM / 2) * 1000;
    let heightMm = (utility.position.y + wallHeightMm / 2000) * 1000;
    positionAlongWall = Math.max(0, Math.min(wallLenMm, positionAlongWall));
    heightMm = Math.max(0, Math.min(wallHeightMm, heightMm));
    this.onRoomUtilityTransform(utilityId, { positionAlongWall, heightMm });
  }

  private loadMaterial(materialName: string): LoadedWoodMaterial | null {
    ensureMaterialEngine();
    return this.materialPipeline.loadMaterial(materialName, this.materialQuality);
  }

  /** Delega ao ViewerTools. */
  private refreshOutlineTarget(): void {
    this.viewerTools.updateOutline();
  }

  private setHoveredBox(id: string | null) {
    if (this.viewerState.getHoveredBox() === id) return;
    this.viewerState.setHoveredBox(id);
    if (id != null) this.viewerState.setHoveredRemate(null);
    this.refreshOutlineTarget();
  }

  private setHoveredRemate(id: string | null) {
    if (this.viewerState.getHoveredRemate() === id) return;
    this.viewerState.setHoveredRemate(id);
    if (id != null) this.viewerState.setHoveredBox(null);
    this.refreshOutlineTarget();
  }

  private getHighlightIntersects(event: { clientX: number; clientY: number }): THREE.Intersection[] {
    return this.pointerPicking.getHighlightIntersects(event);
  }

  private getBoxIdAtPointer(event: { clientX: number; clientY: number }) {
    return this.pointerPicking.getBoxIdAtPointer(event);
  }

  /**
   * Obtém boxId a partir de um mesh (para uso externo, ex.: régua).
   */
  getBoxIdByMeshPublic(mesh: THREE.Object3D): string | null {
    return this.getBoxIdByMesh(mesh);
  }

  private getDoorHitAtPointer(event: { clientX: number; clientY: number }): { boxId: string; doorLayerId: string } | null {
    return this.pointerPicking.getDoorHitAtPointer(event);
  }

  private getDrawerHitAtPointer(event: { clientX: number; clientY: number }): { boxId: string; drawerLayerId: string } | null {
    return this.pointerPicking.getDrawerHitAtPointer(event);
  }

  private getBoxBodyHitAtPointer(event: { clientX: number; clientY: number }): { boxId: string } | null {
    return this.pointerPicking.getBoxBodyHitAtPointer(event);
  }

  /**
   * Retorna o alvo do ponteiro para o menu de contexto: porta, gaveta ou null (módulo/canvas).
   * Raycast nos boxes; para o primeiro hit que tenha getDoorLayerIdByMesh ou getDrawerLayerIdByMesh, devolve boxId + type + doorLayerId/drawerLayerId.
   * Depende de userData.doorLayerId propagado em createDoorObject e de userData.boxId em applyPanelIdsToBox.
   */
  getContextMenuLayerHit(event: { clientX: number; clientY: number }): MouseMenuTarget | null {
    return this.pointerPicking.getContextMenuLayerHit(event);
  }

  private getWallIdAtPointer(event: { clientX: number; clientY: number }): number | null {
    return this.pointerPicking.getWallIdAtPointer(event);
  }

  private getWallHitAtPointer(event: { clientX: number; clientY: number }): {
    wallId: number;
    config: DoorWindowConfig;
    type: "door" | "window";
  } | null {
    return this.pointerPicking.getWallHitAtPointer(event);
  }

  private getRoomElementAtPointer(event: { clientX: number; clientY: number }): {
    elementId: string;
    wallId: number;
    type: "door" | "window";
    config: DoorWindowConfig;
  } | null {
    return this.pointerPicking.getRoomElementAtPointer(event);
  }

  private getRoomUtilityAtPointer(event: { clientX: number; clientY: number }): {
    utilityId: string;
    wallId: number;
    config: ProjectRoomUtility;
  } | null {
    return this.pointerPicking.getRoomUtilityAtPointer({
      event,
      canvas: this.rendererManager.renderer.domElement,
      pointer: this.pointer,
      raycaster: this.raycaster,
      camera: this.cameraManager.camera,
      roomBoxWalls: this.roomBoxWalls,
    });
  }

  private updateCanvasSize = () => {
    this.runtimeLoop.onResize();
    this.measurementEngine.resize();
    this.smartSnappingEngine.resize();
    this.smartAlignOverlay.resize();
  };

  private start() {
    this.runtimeLoop.start();
  }

  private onBeforeRenderTick(): void {
    if (!this._diagnosticsLogged) {
      this._diagnosticsLogged = true;
      const exp = this.rendererManager.renderer.toneMappingExposure;
      if (exp <= 0) {
        this.rendererManager.renderer.toneMappingExposure = 1.05;
      }
      const { keyLight, fillLight, ambient, hemisphere } = this.lights;
      if (keyLight.intensity <= 0) keyLight.intensity = 0.55;
      if (fillLight.intensity <= 0) fillLight.intensity = 0.15;
      if (ambient.intensity <= 0) ambient.intensity = 0.4;
      if (hemisphere.intensity <= 0) hemisphere.intensity = 0.35;
    }
    if (this.cameraManager.camera.position.y < 0.3) {
      this.cameraManager.camera.position.y = 0.3;
    }
    this.controls?.update();
    if (!this.ultraPerformanceMode) {
      const r = this.rendererManager.renderer;
      r.shadowMap.enabled = true;
      if (r.shadowMap.type !== THREE.PCFSoftShadowMap) r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.lights.keyLight.castShadow = true;
    }
    this.lerpLightsToTarget();
    this.updateDimensionsOverlay();
    this.updateWallVisibilityBasedOnCamera();
    this.wallGizmo?.update();
    if (this.snapDebugOverlay && this.lastSnapDebugData) {
      this.snapDebugOverlay.update(this.lastSnapDebugData);
    }
    this.selectionOutline.updateFrame();
    this.multiSelectionOutline?.updateMatrices();

    this.highlightManager?.update();
    this.edgeOutlineSystem?.update();
    this.overlayCoordinator.refreshFrame(performance.now());

    if (this.reflectionsEnabled) {
      this.reflectionFrameCounter += 1;
      if (this.reflectionFrameCounter >= this.reflectionUpdateIntervalFrames) {
        this.reflectionFrameCounter = 0;
        this.updateReflectionProbe(false);
      }
    }

    const wallEntry = this.viewerState.getSelectedWallIndex() !== null
      ? this.roomBoxWalls.find((w) => w.id === this.viewerState.getSelectedWallIndex())
      : null;
    this.wallSelectionOutline.update(wallEntry ? { mesh: wallEntry.mesh } : null);
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
    this.selectionOutline.dispose();
    this.multiSelectionOutline?.dispose(this.sceneManager.scene);
    this.multiSelectionOutline = null;
    this.wallSelectionOutline.dispose();
    if (this.highlightManager) {
      this.highlightManager.dispose();
      this.highlightManager = null;
    }
    if (this.edgeOutlineSystem) {
      this.edgeOutlineSystem.dispose();
      this.edgeOutlineSystem = null;
    }
    if (this.internalSelectionOutline) {
      this.internalSelectionOutline.dispose();
      this.internalSelectionOutline = null;
    }
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
