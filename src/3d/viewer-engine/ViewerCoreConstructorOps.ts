import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { ViewerOptions } from "@/viewer/core/viewerTypes";
import type { MaterialSet } from "../materials/MaterialLibrary";
import type { DoorWindowConfig } from "../room/types";
import type { ViewerMaterialQuality } from "../../context/projectTypes";
import { createViewerFoundation, createViewerDisplayFacade, createViewerSelectionSystems, createViewerMaterialSystems, createViewerControls } from "./composition/ViewerCompositionRoot";
import type { ViewerDisplayFacade, ViewerLightIntensities } from "./composition/ViewerCompositionRoot";
import { ensureViewerSceneEngine } from "./engines/SceneEngine";
import { ensureViewerCameraEngine } from "./engines/CameraEngine";
import { createViewerSelectionEngine } from "./engines/SelectionEngine";
import { ensureViewerMeasurementEngine } from "./engines/MeasurementEngine";
import { ensureViewerSnapEngine } from "./engines/SnapEngine";
import { RoomBuilder } from "../room/RoomBuilder";
import { ViewerRaycastSystem } from "./raycast/ViewerRaycastSystem";
import { PointerPickingFacade } from "./input/PointerPickingFacade";
import { IndustrialDesignWorkspaceMode } from "./modes/IndustrialDesignWorkspaceMode";
import { ViewerPanelVisibility } from "./panels/ViewerPanelVisibility";
import { createInitialMaterialSet } from "./materials/materialSetState";
import { SmartSnapping } from "./snapping/SmartSnapping";
import { RemateSmartSnapping } from "./snapping/RemateSmartSnapping";
import { SmartAlignSnapOverlay } from "./snapping/smartAlignSnapOverlay";
import { SmartAlignSnapEngine } from "./snapping/SmartAlignSnapEngine";
import { createSmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import { createSnappingFacade } from "./snapping/snappingFacade";
import type { SnappingFacade } from "./snapping/snappingFacade";
import { bindViewerOverlayCoordinator } from "./overlays/bindViewerOverlayCoordinator";
import { createDisabledSmartLayoutDeps } from "./snapping/smartLayoutDepsFactory";
import { LayoutEngine } from "./layout/LayoutEngine";
import { createViewerCoreFacades } from "./ViewerCoreFacades";
import type {
  ViewerCoreAutoLayoutFacade,
  ViewerCoreSmartLayoutFacade,
  ViewerCoreIntelligentDesignerFacade,
  ViewerCoreConversationalDesignerFacade,
  ViewerCoreManufacturingFacade,
  ViewerCoreCostEstimatorFacade,
} from "./ViewerCoreFacades";
import { createViewerVisualFacades } from "./overlays/viewerVisualFacades";
import type { ViewerVisualFacade } from "./overlays/viewerVisualFacades";
import { registerAdminSnappingRules } from "./snapping/adminSnappingRules";
import { rulesStore } from "../../admin/rules/rulesStore";
import { historyManager } from "../../core/viewer/historyManager";
import { decodeSelectionId } from "../../core/viewer/selectionIds";
import { resolveRemateTransformRoot } from "./remate/remateLCompositeVisual";
import { GroupGizmo } from "./tools/GroupGizmo";
import { MeasurementAnchorsVisualizer } from "./measurement/MeasurementAnchorsVisualizer";
import { DimensionsOverlayController } from "./overlays/DimensionsOverlayController";
import type { BoxBoundsInput } from "./overlays/boxDimensionsOverlay";
import { WallGizmo } from "../gizmos/WallGizmo";
import { RoomManager, type IRoomManagerViewer } from "../room/RoomManager";
import { SnapDebugOverlay } from "../../debug/SnapDebugOverlay";
import { SnapshotRenderer } from "./snapshot";
import { TransformConstraints } from "./constraints/TransformConstraints";
import { ViewerRenderExporter } from "./export/ViewerRenderExporter";
import { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
import { EventsManager } from "./events";
import { registerViewerWindowEvents } from "./input/viewerWindowEvents";
import { resolveMultiOutlineTargetImpl } from "./ViewerCoreSelectionOps";
import type { ViewerCoreSelectionOpsDeps } from "./ViewerCoreSelectionOps";
import type { ViewerCoreIndustrialModeDeps } from "./ViewerCoreIndustrialMode";
import type { ViewerCoreRoomGeometryDeps, ViewerCoreRoomWallEntry } from "./ViewerCoreRoomGeometry";
import type { ViewerCoreRoomBounds } from "./ViewerCoreRoomUtils";
import {
  getBoxPanelRaycastHitsImpl,
  updateBoxDrillMarkersImpl,
  setPanelRenderingEnabledImpl,
  setPanelEdgesVisibleImpl,
  setIndustrialDesignValidationHighlightImpl,
  setIndustrialDesignSelectionHighlightImpl,
  syncIndustrialDesignViewerOverlayImpl,
} from "./ViewerCoreIndustrialMode";
import { notifyWallTransformImpl } from "./ViewerCoreRoomGeometry";
import type { SceneManager } from "./scene";
import type { SceneEngine } from "./scene/SceneEngine";
import type { CameraManager } from "./camera";
import type { CameraEngine } from "./camera/CameraEngine";
import type { RendererManager } from "./renderer";
import type { Lights } from "./lighting";
import type { LightingEngine } from "./lighting/LightingEngine";
import type { ComposerEngine } from "./lighting/ComposerEngine";
import type { Controls } from "./controls";
import type { SelectionEngine } from "./selection/SelectionEngine";
import type { HighlightManager } from "./highlight";
import type { EdgeOutlineSystem } from "../outline";
import type { InternalSelectionOutline } from "./selection";
import type { MultiSelectionOutline } from "./selection/MultiSelectionOutline";
import type { SelectionOutlineController } from "./overlays/SelectionOutlineController";
import type { WallSelectionOutlineController } from "./overlays/WallSelectionOutlineController";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { DisplayMaterialController } from "./materials/displayMaterialController";
import type { UltraMaterialController } from "./materials/ultraMaterialController";
import type { MeasurementEngine } from "./measurement/MeasurementEngine";
import type { InternalRulerFacade } from "./measurement/internalRulerFacade";
import type { UnifiedMeasurement } from "./measurement/unifiedMeasurementTypes";
import type { RulerMeasurementHit } from "./measurement/unifiedMeasurementTypes";
import type { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import type { ViewerState, SelectedDivSep } from "./state/ViewerState";
import type { ViewerBoxEntry } from "./types";
import type { GizmoEngine } from "./tools/GizmoEngine";
import type { SnapEngine } from "./snapping/SnapEngine";
import type { SmartLayoutBridge } from "./snapping/smartLayoutTypes";
import type { SmartAlignSnapContext } from "./snapping/smartAlignSnapTypes";
import type { DesignConversationState } from "./snapping/designConversationState";
import type { IntelligentDesignerEngine } from "./snapping/intelligentDesignerEngine";
import type { ConversationalDesignerEngine } from "./snapping/conversationalDesignerEngine";
import type { ManufacturingReportEngine } from "./snapping/manufacturingReportEngine";
import type { CostReportEngine } from "./snapping/costReportEngine";
import type { DesignVariantId, EnvironmentStyleId } from "./snapping/intelligentDesignerTypes";
import type { RematePieceVisualizer } from "./remate/RematePieceVisualizer";
import type { TampoPieceVisualizer } from "./remate/TampoPieceVisualizer";
import type { HematiVisualizer } from "./hemati/HematiVisualizer";
import type { RodapeVisualizer } from "./rodape/RodapeVisualizer";
import type { IViewerEventEngine } from "./events/EventEngineTypes";
import type { AlignableObject } from "./commands/alignmentCommands";

/**
 * Host mutável do wiring do constructor.
 * O ViewerCore passa `this` via cast — as atribuições a campos readonly
 * ocorrem através deste host tipado como mutável para permitir a extracção.
 */
export type ViewerCoreConstructorOpsDeps = {
  isMobile: boolean;
  reflectionUpdateIntervalFrames: number;
  container: HTMLElement;
  sceneManager: SceneManager;
  sceneEngine: SceneEngine;
  defaultGroundSize: number;
  cameraManager: CameraManager;
  cameraEngine: CameraEngine;
  rendererManager: RendererManager;
  lights: Lights;
  baseLightIntensities: ViewerLightIntensities;
  lightingEngine: LightingEngine | null;
  composerEngine: ComposerEngine | null;
  display: ViewerDisplayFacade;
  defaultPixelRatio: number;
  baseToneMappingExposure: number;
  boxes: Map<string, ViewerBoxEntry>;
  selectionOutline: SelectionOutlineController;
  wallSelectionOutline: WallSelectionOutlineController;
  highlightManager: HighlightManager | null;
  edgeOutlineSystem: EdgeOutlineSystem | null;
  internalSelectionOutline: InternalSelectionOutline | null;
  multiSelectionOutline: MultiSelectionOutline | null;
  selectionEngine: SelectionEngine;
  viewerState: ViewerState;
  gizmoEngine: GizmoEngine;
  roomBuilder: RoomBuilder;
  roomBoxWalls: ViewerCoreRoomWallEntry[];
  roomBounds: ViewerCoreRoomBounds | null;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  raycastSystem: ViewerRaycastSystem;
  pointerPicking: PointerPickingFacade;
  transformControlsHelper: THREE.Object3D | null;
  debugMode: boolean;
  remateVisualizer: RematePieceVisualizer;
  tampoVisualizer: TampoPieceVisualizer;
  hematiVisualizer: HematiVisualizer;
  rodapeVisualizer: RodapeVisualizer;
  onRoomElementPlaced: ((wallId: number, config: DoorWindowConfig, type: "door" | "window") => void) | null;
  materialPipeline: MaterialPipelineFacade;
  displayMaterials: DisplayMaterialController;
  ultraMaterials: UltraMaterialController;
  industrialDesignMode: IndustrialDesignWorkspaceMode;
  viewerReadyFlag: boolean;
  panelVisibility: ViewerPanelVisibility;
  materialSet: MaterialSet;
  controls: Controls | null;
  measurementEngine: MeasurementEngine;
  getProjectMeasurementsFn: () => UnifiedMeasurement[];
  onInternalMeasurementSavedFn: (entry: UnifiedMeasurement) => void;
  internalRuler: InternalRulerFacade;
  smartSnappingEngine: SmartSnapping;
  remateSmartSnapping: RemateSmartSnapping;
  smartAlignSnapOverlay: SmartAlignSnapOverlay;
  smartAlignOverlay: SmartAlignOverlayFacade;
  smartAlignSnapEngine: SmartAlignSnapEngine;
  snapping: SnappingFacade;
  overlayCoordinator: ViewerOverlayCoordinator;
  smartLayoutBridge: SmartLayoutBridge | null;
  layoutEngine: LayoutEngine;
  designConversationState: DesignConversationState;
  autoLayout: ViewerCoreAutoLayoutFacade;
  smartLayout: ViewerCoreSmartLayoutFacade;
  intelligentDesigner: ViewerCoreIntelligentDesignerFacade;
  conversationalDesigner: ViewerCoreConversationalDesignerFacade;
  manufacturing: ViewerCoreManufacturingFacade;
  costEstimator: ViewerCoreCostEstimatorFacade;
  orlaVisual: ViewerVisualFacade;
  remateVisual: ViewerVisualFacade;
  hematiVisual: ViewerVisualFacade;
  rodapeVisual: ViewerVisualFacade;
  unregisterAdminSnappingRules: (() => void) | null;
  transformControls: TransformControls | null;
  onTransformDragStart: (() => void) | null;
  groupGizmo: GroupGizmo | null;
  dragStartZForShiftLock: number | undefined;
  measurementAnchorsVisualizer: MeasurementAnchorsVisualizer | null;
  dimensionsOverlay: DimensionsOverlayController;
  wallGizmo: WallGizmo | null;
  roomManager: RoomManager | null;
  snapDebugOverlay: SnapDebugOverlay | null;
  snapshotRenderer: SnapshotRenderer | null;
  constraints: TransformConstraints;
  snapEngine: SnapEngine;
  settings: { enableSmartAlignSnap: boolean };
  renderExporter: ViewerRenderExporter;
  ultraPerformanceMode: boolean;
  turntableEnabled: boolean;
  turntableSpeed: number;
  runtimeLoop: ViewerRuntimeLoop;
  eventsManager: EventsManager | null;
  materialQuality: ViewerMaterialQuality;
  unregisterWindowEvents: (() => void) | null;
  boundShiftKeyDown: (e: KeyboardEvent) => void;
  boundShiftKeyUp: (e: KeyboardEvent) => void;

  getSelectionOpsDeps: () => ViewerCoreSelectionOpsDeps;
  getIndustrialModeDeps: () => ViewerCoreIndustrialModeDeps;
  getRoomGeometryDeps: () => ViewerCoreRoomGeometryDeps;
  getSelectedObjects: (multiBoxIds?: string[]) => AlignableObject[];
  notifyAlignableTransform: (obj: AlignableObject) => void;
  projectWorldToScreen: (world: THREE.Vector3) => { x: number; y: number } | null;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
  getDivSepMesh: (selection: SelectedDivSep) => THREE.Object3D | null;
  getRoomOpeningsForSnapping: () => import("./snapping/smartSnappingTypes").RoomOpeningLike[];
  computeDistanceToNearestBox: () => RulerMeasurementHit | null;
  computeDistanceToNearestWall: () => RulerMeasurementHit | null;
  computeDistanceToFloor: () => RulerMeasurementHit | null;
  applyMousePresetToControls: () => void;
  applyBackgroundMode: () => void;
  updateShadowIntensity: (value: number) => void;
  syncSmartAlignSnapOverlayFromEngine: () => void;
  clearSmartAlignSnapOverlay: () => void;
  buildDisabledSmartSnapContext: () => SmartAlignSnapContext;
  buildSmartAlignSnapContextForDrag: () => SmartAlignSnapContext;
  previewSmartWallFill: (wallId: string | number, moduleBoxId: string) => boolean;
  acceptPredictiveLayoutPending: () => boolean;
  ensureIntelligentDesigner: () => IntelligentDesignerEngine;
  generateIntelligentDesigns: (seedBoxId: string) => boolean;
  generateIntelligentVariations: () => boolean;
  previewIntelligentDesign: (id: DesignVariantId) => boolean;
  applyIntelligentDesign: (id: DesignVariantId) => boolean;
  previewIntelligentStyle: (styleId: EnvironmentStyleId, seedBoxId: string) => boolean;
  applyIntelligentStyle: (styleId: EnvironmentStyleId, seedBoxId: string) => boolean;
  ensureConversationalDesignerEngine: () => ConversationalDesignerEngine;
  ensureManufacturingReportEngine: () => ManufacturingReportEngine;
  previewManufacturingFixes: () => boolean;
  applyManufacturingSuggestedFixes: () => boolean;
  ensureCostReportEngine: () => CostReportEngine;
  previewCostSuggestionByTier: (
    seedBoxId: string,
    tier: "cheaper" | "premium" | "balanced"
  ) => boolean;
  syncOrlaVisuals: () => void;
  syncRemateVisuals: () => void;
  syncHematiVisuals: () => void;
  syncRodapeVisuals: () => void;
  logTransformDiagnostic: (name: string, data?: Record<string, unknown>) => void;
  finishTransformDrag: (source: "mouseUp" | "dragging-changed") => void;
  handleTransformObjectChange: () => void;
  collectBoxBoundsForDimensions: () => BoxBoundsInput[];
  setWallEditMode: (enabled: boolean) => void;
  ensureComposerEngine: () => ComposerEngine;
  updateCameraTarget: () => void;
  updateCanvasSize: () => void;
  getEventEngineApi: () => IViewerEventEngine;
  start: () => void;
  notifyViewerReady: () => void;
  onBeforeRenderTick: () => void;
};

export function wireViewerCoreConstructorImpl(
  host: ViewerCoreConstructorOpsDeps,
  container: HTMLElement,
  options: ViewerOptions = {}
): void {

    if (!container) {
      throw new Error("Viewer: container is required");
    }
    const userAgent =
      typeof window !== "undefined" && window.navigator ? window.navigator.userAgent : "";
    host.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent ?? ""
    );
    host.reflectionUpdateIntervalFrames = host.isMobile ? 36 : 24;
    host.container = container;
    const foundation = createViewerFoundation(container, options, host.isMobile);
    host.sceneManager = foundation.sceneManager;
    host.sceneEngine = ensureViewerSceneEngine(host.sceneEngine ?? null, host.sceneManager);
    host.defaultGroundSize = foundation.defaultGroundSize;
    host.cameraManager = foundation.cameraManager;
    host.cameraEngine = ensureViewerCameraEngine(host.cameraEngine ?? null, host.cameraManager);
    host.rendererManager = foundation.rendererManager;
    host.lights = foundation.lights;
    host.baseLightIntensities = foundation.baseLightIntensities;
    host.display = createViewerDisplayFacade({
      getShadowIntensity: () => host.lightingEngine?.shadowIntensity ?? 1,
      updateShadowIntensity: (value) => host.updateShadowIntensity(value),
    });
    host.defaultPixelRatio = foundation.defaultPixelRatio;
    host.baseToneMappingExposure = foundation.baseToneMappingExposure;
    const selectionSystems = createViewerSelectionSystems({
      scene: host.sceneManager.scene,
      getBoxes: () => host.boxes,
    });
    host.selectionOutline = selectionSystems.selectionOutline;
    host.wallSelectionOutline = selectionSystems.wallSelectionOutline;
    host.highlightManager = selectionSystems.highlightManager;
    host.edgeOutlineSystem = selectionSystems.edgeOutlineSystem;
    host.internalSelectionOutline = selectionSystems.internalSelectionOutline;
    host.multiSelectionOutline = selectionSystems.multiSelectionOutline;
    host.selectionEngine = createViewerSelectionEngine({
      multiSelectionOutline: host.multiSelectionOutline,
      resolveMultiOutlineTarget: (encoded) => resolveMultiOutlineTargetImpl(host.getSelectionOpsDeps(), encoded),
      setGroupMemberIds: (ids) => host.viewerState.setGroupTransformMemberIds(ids),
      clearGroupMemberIds: () => host.viewerState.clearGroupTransformMemberIds(),
      refreshGizmo: () => host.gizmoEngine.refreshAttachment(),
      getSelectedObjects: (multiBoxIds) => host.getSelectedObjects(multiBoxIds),
      notifyAligned: (obj) => host.notifyAlignableTransform(obj),
    });

    host.roomBuilder = new RoomBuilder(() => host.roomBoxWalls.map((w) => w.mesh));
    host.sceneEngine.add(host.roomBuilder.getGroup());

    host.raycastSystem = new ViewerRaycastSystem({
      raycaster: host.raycaster,
      pointer: host.pointer,
      camera: host.cameraManager.camera,
      getBoxes: () => host.boxes,
      getRoomBoxWalls: () => host.roomBoxWalls,
      getRoomBuilderGroup: () => host.roomBuilder.getGroup(),
      getScene: () => host.sceneManager.scene,
      getCanvas: () => host.rendererManager.renderer.domElement,
      getRoomBounds: () => host.roomBounds,
      getTransformControlsHelper: () => host.transformControlsHelper,
      getDebugMode: () => host.debugMode,
      getBoxEntry: (boxId) => host.boxes.get(boxId),
      projectWorldToScreen: (world) => host.projectWorldToScreen(world),
      getRemateRoot: () => host.remateVisualizer.getRoot(),
      getTampoRoot: () => host.tampoVisualizer.getRoot(),
      getHematiRoot: () => host.hematiVisualizer.getRoot(),
      getRodapeRoot: () => host.rodapeVisualizer.getRoot(),
    });
    host.pointerPicking = new PointerPickingFacade({
      raycastSystem: host.raycastSystem,
      getPlacementMode: () => host.viewerState.getPlacementMode(),
      hasRoomElementPlacementHandler: () => Boolean(host.onRoomElementPlaced),
    });

    const materialSystems = createViewerMaterialSystems();
    host.materialPipeline = materialSystems.materialPipeline;
    host.displayMaterials = materialSystems.displayMaterials;
    host.ultraMaterials = materialSystems.ultraMaterials;

    host.industrialDesignMode = new IndustrialDesignWorkspaceMode({
      getBoxEntry: (id) => host.boxes.get(id),
      getBoxMesh: (id) => host.boxes.get(id)?.mesh ?? null,
      raycastIntersects: (event) =>
        getBoxPanelRaycastHitsImpl(host.getIndustrialModeDeps(), event),
      updateBoxDrillMarkers: (boxId, markers) => {
        updateBoxDrillMarkersImpl(host.getIndustrialModeDeps(), boxId, markers);
      },
      setPanelRenderingEnabled: (enabled) => {
        setPanelRenderingEnabledImpl(host.getIndustrialModeDeps(), enabled);
        if (enabled) setPanelEdgesVisibleImpl(host.getIndustrialModeDeps(), true);
      },
      setValidationHighlightPanels: (boxId, panelIds) => {
        setIndustrialDesignValidationHighlightImpl(
          host.getIndustrialModeDeps(),
          boxId,
          panelIds
        );
      },
      setSelectionHighlightPanel: (boxId, panelId) => {
        setIndustrialDesignSelectionHighlightImpl(
          host.getIndustrialModeDeps(),
          boxId,
          panelId
        );
      },
      syncDesignVisuals: (boxId) => {
        syncIndustrialDesignViewerOverlayImpl(host.getIndustrialModeDeps(), boxId);
      },
      getViewerReady: () => host.viewerReadyFlag,
    });

    host.panelVisibility = new ViewerPanelVisibility({
      getBoxes: () => host.boxes,
      getHighlightEnabled: () => host.viewerState.getHighlightEnabled(),
      getBoxIdByMesh: (mesh) => host.pointerPicking.getBoxIdByMesh(mesh),
      getSharedPanelEdgeMaterial: () => host.materialPipeline.getSharedPanelEdgeMaterial(),
      getIndustrialDesignWorkspaceEnabled: () => host.industrialDesignMode.isEnabled(),
    });

    host.materialSet = createInitialMaterialSet();

    host.controls = createViewerControls(
      host.cameraManager.camera,
      host.rendererManager.renderer.domElement,
      options
    );
    host.applyMousePresetToControls();
    host.applyBackgroundMode();
    host.measurementEngine = ensureViewerMeasurementEngine(null, {
      getCamera: () => host.cameraManager.camera,
      getCanvas: () => host.rendererManager.renderer.domElement,
      getContainer: () => host.container,
      getBoxes: () => host.boxes,
      getRoomWalls: () => host.roomBoxWalls,
      getSelectedBoxId: () => host.viewerState.getSelectedBox(),
      isTransformDragging: () => host.viewerState.getTransformControlsDragging(),
      projectWorldToScreen: (worldPoint) => host.projectWorldToScreen(worldPoint),
      getProjectMeasurements: () => host.getProjectMeasurementsFn(),
      onMeasurementSaved: (entry) => host.onInternalMeasurementSavedFn(entry),
      getNearestBoxDistance: () => host.computeDistanceToNearestBox(),
      getNearestWallDistance: () => host.computeDistanceToNearestWall(),
      getFloorDistance: () => host.computeDistanceToFloor(),
    });
    host.internalRuler = host.measurementEngine.facade;

    host.smartSnappingEngine = new SmartSnapping({
      getCamera: () => host.cameraManager.camera,
      getCanvas: () => host.rendererManager.renderer.domElement,
      getContainer: () => host.container,
      projectWorldToScreen: (worldPoint) => host.projectWorldToScreen(worldPoint),
      isInternalRulerActive: () => host.measurementEngine.isActive(),
      getRoomBounds: () => host.roomBounds,
      getRoomOpenings: () => host.getRoomOpeningsForSnapping(),
    });
    host.remateSmartSnapping = new RemateSmartSnapping({
      getContainer: () => host.container,
      projectWorldToScreen: (worldPoint) => host.projectWorldToScreen(worldPoint),
    });
    host.remateSmartSnapping.enable();

    host.smartAlignSnapOverlay = new SmartAlignSnapOverlay({
      getContainer: () => host.container,
      projectWorldToScreen: (worldPoint) => host.projectWorldToScreen(worldPoint),
    });
    host.smartAlignOverlay = createSmartAlignOverlayFacade(host.smartAlignSnapOverlay);

    host.smartAlignSnapEngine = new SmartAlignSnapEngine({
      isInternalRulerActive: () => host.measurementEngine.isActive(),
    });
    host.smartAlignSnapEngine.enable();

    host.snapping = createSnappingFacade(host.smartSnappingEngine);

    bindViewerOverlayCoordinator({
      coordinator: host.overlayCoordinator,
      unifiedMeasurement: host.measurementEngine.engine,
      smartSnappingEngine: host.smartSnappingEngine,
      smartAlignSnapEngine: host.smartAlignSnapEngine,
      syncSmartAlignSnapOverlay: () => host.syncSmartAlignSnapOverlayFromEngine(),
      clearSmartAlignSnapOverlay: () => host.clearSmartAlignSnapOverlay(),
    });

    const smartLayoutDeps = createDisabledSmartLayoutDeps({
      getBridge: () => host.smartLayoutBridge,
      buildSnapContext: () => host.buildDisabledSmartSnapContext(),
      getBoxEntry: (boxId) => host.boxes.get(boxId),
    });
    host.layoutEngine = new LayoutEngine(smartLayoutDeps);
    const facades = createViewerCoreFacades({
      layoutEngine: host.layoutEngine,
      designConversationState: host.designConversationState,

      previewSmartWallFill: (wallId, moduleBoxId) => host.previewSmartWallFill(wallId, moduleBoxId),
      acceptPredictiveLayoutPending: () => host.acceptPredictiveLayoutPending(),
      clearSmartAlignSnapOverlay: () => host.clearSmartAlignSnapOverlay(),

      ensureIntelligentDesigner: () => host.ensureIntelligentDesigner(),
      generateIntelligentDesigns: (seedBoxId) => host.generateIntelligentDesigns(seedBoxId),
      generateIntelligentVariations: () => host.generateIntelligentVariations(),
      previewIntelligentDesign: (id) => host.previewIntelligentDesign(id),
      applyIntelligentDesign: (id) => host.applyIntelligentDesign(id),
      previewIntelligentStyle: (styleId, seedBoxId) => host.previewIntelligentStyle(styleId, seedBoxId),
      applyIntelligentStyle: (styleId, seedBoxId) => host.applyIntelligentStyle(styleId, seedBoxId),

      ensureConversationalDesignerEngine: () => host.ensureConversationalDesignerEngine(),

      ensureManufacturingReportEngine: () => host.ensureManufacturingReportEngine(),
      previewManufacturingFixes: () => host.previewManufacturingFixes(),
      applyManufacturingSuggestedFixes: () => host.applyManufacturingSuggestedFixes(),

      ensureCostReportEngine: () => host.ensureCostReportEngine(),
      previewCostSuggestionByTier: (seedBoxId, tier) => host.previewCostSuggestionByTier(seedBoxId, tier),
    });

    host.autoLayout = facades.autoLayout;
    host.smartLayout = facades.smartLayout;
    host.intelligentDesigner = facades.intelligentDesigner;
    host.conversationalDesigner = facades.conversationalDesigner;
    host.manufacturing = facades.manufacturing;
    host.costEstimator = facades.costEstimator;
    const visualFacades = createViewerVisualFacades({
      syncOrlaVisuals: () => host.syncOrlaVisuals(),
      syncRemateVisuals: () => host.syncRemateVisuals(),
      syncHematiVisuals: () => host.syncHematiVisuals(),
      syncRodapeVisuals: () => host.syncRodapeVisuals(),
    });
    host.orlaVisual = visualFacades.orlaVisual;
    host.remateVisual = visualFacades.remateVisual;
    host.hematiVisual = visualFacades.hematiVisual;
    host.rodapeVisual = visualFacades.rodapeVisual;

    host.unregisterAdminSnappingRules = registerAdminSnappingRules(
      host.smartSnappingEngine,
      {
        snapRules: rulesStore.snapRules,
        roomRules: rulesStore.roomRules,
      },
      host.smartAlignSnapEngine
    );

    host.transformControls = new TransformControls(
      host.cameraManager.camera,
      host.rendererManager.renderer.domElement
    );
    host.transformControls.setSpace("world");
    host.transformControls.enabled = true;
    host.transformControls.showX = true;
    host.transformControls.showY = true;
    host.transformControls.showZ = true;
    host.transformControls.addEventListener("mouseDown", () => {
      historyManager.beginDragSession("transform.drag", "Transformação");
      host.onTransformDragStart?.();
      host.smartAlignSnapEngine.onDragStart();
      if (host.viewerState.getSelectedRemate()) {
        const remateId = host.viewerState.getSelectedRemate()!;
        const rawMesh = host.getRemateMesh(remateId);
        const obj = resolveRemateTransformRoot(rawMesh) ?? rawMesh ?? host.transformControls!.object;
        if (obj) host.remateSmartSnapping.onDragStart(obj as THREE.Object3D);
      } else if (host.viewerState.getSelectedDivSep()) {
        const sel = host.viewerState.getSelectedDivSep()!;
        const mesh = host.getDivSepMesh(sel);
        if (mesh) {
          mesh.userData.divSepDragStart = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
          };
        }
      } else if (host.groupGizmo?.isActive()) {
        const members = host.groupGizmo.getMembers();
        for (const member of members) {
          const decoded = decodeSelectionId(member.encodedId);
          if (decoded?.kind !== "box") continue;
          host.smartSnappingEngine.onDragStart(member.mesh);
          break;
        }
      } else if (host.viewerState.getSelectedBox()) {
        const obj = host.transformControls!.object;
        if (obj && "position" in obj) {
          host.dragStartZForShiftLock = (obj as THREE.Object3D).position.z;
          host.smartSnappingEngine.onDragStart(obj as THREE.Object3D);
        }
      }
      host.viewerState.setTransformControlsDragging(true);
      host.logTransformDiagnostic("dragStart(mouseDown)");
    });
    host.transformControls.addEventListener("mouseUp", () => {
      host.finishTransformDrag("mouseUp");
      host.logTransformDiagnostic("dragEnd(mouseUp)");
    });
    host.transformControls.addEventListener("dragging-changed", (event) => {
      host.viewerState.setTransformControlsDragging(Boolean(event.value));
      host.logTransformDiagnostic("dragging-changed", {
        value: Boolean(event.value),
      });
      if (!event.value) {
        host.finishTransformDrag("dragging-changed");
      }
    });
    host.transformControls.addEventListener("objectChange", () => {
      host.handleTransformObjectChange();
    });
    host.transformControlsHelper = host.transformControls.getHelper();
    host.transformControlsHelper.visible = false;
    host.sceneManager.scene.add(host.transformControlsHelper);
    host.groupGizmo = new GroupGizmo(host.sceneManager.scene);
    host.measurementAnchorsVisualizer = new MeasurementAnchorsVisualizer(host.sceneManager.scene);
    host.dimensionsOverlay = new DimensionsOverlayController({
      scene: host.sceneManager.scene,
      camera: host.cameraManager.camera,
      getViewportSize: () => ({
        width: host.container?.clientWidth ?? 1280,
        height: host.container?.clientHeight ?? 720,
      }),
      collectBoxBounds: () => host.collectBoxBoundsForDimensions(),
      projectWorldToScreen: (world) => host.projectWorldToScreen(world),
    });
    host.logTransformDiagnostic("transform-listeners-ready", {
      domTag: host.rendererManager.renderer.domElement.tagName,
      helperVisible: host.transformControlsHelper.visible,
    });

    host.wallGizmo = new WallGizmo(host.cameraManager.camera);
    host.wallGizmo.setOnTransform(() => notifyWallTransformImpl(host.getRoomGeometryDeps()));
    host.sceneManager.scene.add(host.wallGizmo.group);
    host.sceneManager.scene.add(host.remateVisualizer.getRoot());
    host.sceneManager.scene.add(host.tampoVisualizer.getRoot());
    host.sceneManager.scene.add(host.hematiVisualizer.getRoot());
    host.sceneManager.scene.add(host.rodapeVisualizer.getRoot());
    host.setWallEditMode(false);

    host.roomManager = new RoomManager(host as unknown as IRoomManagerViewer);
    if (import.meta.env.DEV) {
      host.snapDebugOverlay = new SnapDebugOverlay();
    }

    host.snapshotRenderer = new SnapshotRenderer({
      getCamera: () => ({
        position: host.cameraManager.camera.position,
        quaternion: host.cameraManager.camera.quaternion,
        zoom: "zoom" in host.cameraManager.camera ? (host.cameraManager.camera as { zoom: number }).zoom : 1,
        type: host.cameraManager.camera.type,
      }),
      getControls: () =>
        host.controls?.controls
          ? { target: host.controls.controls.target, update: () => host.controls!.controls!.update() }
          : null,
      getScene: () => host.sceneManager.scene,
      getRenderer: () => host.rendererManager.renderer,
      getContainer: () => host.container,
    });

    host.constraints = new TransformConstraints();
    host.snapEngine = ensureViewerSnapEngine(null, {
      getAlignEngine: () => host.smartAlignSnapEngine,
      isAlignEnabled: () => host.settings.enableSmartAlignSnap,
      buildAlignContext: () => host.buildSmartAlignSnapContextForDrag(),
      syncAlignOverlay: () => host.syncSmartAlignSnapOverlayFromEngine(),
      getConstraints: () => host.constraints,
    });
    host.renderExporter = new ViewerRenderExporter({
      getBoxes: () => host.boxes,
      getRenderer: () => host.rendererManager.renderer,
      getScene: () => host.sceneManager.scene,
      getCamera: () => host.cameraManager.camera,
      getControls: () =>
        host.controls?.controls
          ? { target: host.controls.controls.target, update: () => host.controls!.controls!.update() }
          : null,
      getLights: () => ({
        keyLight: host.lights.keyLight,
        fillLight: host.lights.fillLight,
        ambient: host.lights.ambient,
        rimLight: host.lights.rimLight,
        hemisphere: host.lights.hemisphere,
      }),
      getGroundVisible: () => host.sceneEngine.getGroundVisible(),
      setGroundVisible: (visible) => host.sceneEngine.setGroundVisible(visible),
      getGridVisible: () => host.sceneEngine.getGridVisible(),
      setGridVisible: (visible) => host.sceneEngine.setGridVisible(visible),
      getRoomGroup: () => host.roomBuilder.getGroup(),
      getRoomWalls: () => host.roomBoxWalls,
      getSelectionOutline: () => host.selectionOutline.getGroup(),
      getWallSelectionOutline: () => host.wallSelectionOutline.getHelper(),
      getDimensionsOverlayGroup: () => host.dimensionsOverlay.group,
      getWallGizmoGroup: () => host.wallGizmo?.group ?? null,
      ensureShowcaseComposer: () => {
        host.ensureComposerEngine().ensureShowcase();
      },
      ensureMainComposer: () => {
        host.ensureComposerEngine().ensureMain();
      },
      getShowcaseComposer: () => host.composerEngine?.showcase ?? null,
      getMainComposer: () => host.composerEngine?.main ?? null,
      getShowcaseBloomPass: () => host.composerEngine?.bloom ?? null,
      getMainBloomPass: () => host.composerEngine?.mainBloom ?? null,
      getBokehPass: () => host.composerEngine?.bokeh ?? null,
      setComposerExportSize: (width, height, pixelRatio) => {
        host.composerEngine?.setExportSize(width, height, pixelRatio);
      },
      updateShowcaseComposerSize: () => host.composerEngine?.updateShowcaseSize(),
      updateMainComposerSize: () => host.composerEngine?.updateMainSize(),
      updateCanvasSize: () => host.updateCanvasSize(),
    });
    host.runtimeLoop = new ViewerRuntimeLoop({
      getRenderer: () => host.rendererManager.renderer,
      renderScene: () => host.rendererManager.render(host.sceneManager.scene, host.cameraManager.camera),
      getCamera: () => host.cameraManager.camera,
      setCameraAspect: (aspect) => {
        host.cameraManager.camera.aspect = aspect;
      },
      updateCameraProjection: () => host.cameraManager.camera.updateProjectionMatrix(),
      getContainer: () => host.container,
      ensureMainComposer: () => {
        host.ensureComposerEngine().ensureMain();
      },
      getShowcaseComposer: () => host.composerEngine?.showcase ?? null,
      getMainComposer: () => host.composerEngine?.main ?? null,
      getBokehPass: () => host.composerEngine?.bokeh ?? null,
      updateShowcaseComposerSize: () => host.composerEngine?.updateShowcaseSize(),
      updateMainComposerSize: () => host.composerEngine?.updateMainSize(),
      getCurrentMode: () => host.viewerState.getCurrentMode(),
      isUltraPerformanceMode: () => host.ultraPerformanceMode,
      isTurntableEnabled: () => host.turntableEnabled && host.viewerState.getCurrentMode() === "showcase",
      getTurntableSpeed: () => host.turntableSpeed,
      getTurntableTarget: () => host.controls?.controls?.target?.clone() ?? null,
      getBoxes: () => host.boxes,
      onBeforeRenderTick: () => host.onBeforeRenderTick(),
    });

    host.updateCameraTarget();

    host.eventsManager = new EventsManager(host.getEventEngineApi());
    host.eventsManager.register(host.rendererManager.renderer.domElement);

    host.materialPipeline.setLacqueredClearcoatPipeline(host.materialQuality === "lacquered");

    host.start();
    queueMicrotask(() => host.notifyViewerReady());
    host.unregisterWindowEvents = registerViewerWindowEvents({
      resize: host.updateCanvasSize,
      keydown: host.boundShiftKeyDown,
      keyup: host.boundShiftKeyUp,
    });
}
