import { createContext } from "react";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import type {
  DoorWindowConfig,
  RoomConfig,
  UltraPerformanceModeOptions,
  ViewerMaterialQuality,
  ViewerMousePreset,
  ViewerBackgroundMode,
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerSnapshot,
} from "./projectTypes";
import type { Viewer } from "../3d/core/Viewer";
import type { MouseMenuTarget } from "../ui/context-menu/ContextMenuEngine";
import type { MeasurementAnchorEntry } from "../core/viewer/measurementAnchors";

export type IntelligentDesignerStyleId =
  | "modern"
  | "nordic"
  | "industrial"
  | "minimalist"
  | "classic"
  | "scandinavian"
  | "japandi"
  | "luxury";

export type FinishFreeTransformPatch = {
  transform: {
    xMm: number;
    yMm: number;
    zMm: number;
    rotacaoXRad: number;
    rotacaoYRad: number;
    rotacaoZRad: number;
  };
  placementFree: boolean;
};

export type PimoViewerSmartLayoutApi = {
  autoWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
  previewAutoWallFill: (_wallId: string | number, _moduleBoxId: string) => boolean;
  autoRoomFill: (_seedBoxId?: string) => boolean;
  autoDistribute: (_boxIds: string[]) => boolean;
  autoStackShelves: (
    _boxId: string,
    _options: { count: number; topMarginMm: number; bottomMarginMm: number }
  ) => boolean;
  applyPredictiveLayout: () => boolean;
  rejectPredictiveLayout: () => void;
  hasPredictiveLayout: () => boolean;
};

export type PimoViewerIntelligentDesignerApi = {
  generateDesigns: (_seedBoxId: string) => boolean;
  generateVariations: () => boolean;
  previewDesign: (_id: "A" | "B" | "C") => boolean;
  applyDesign: (_id: "A" | "B" | "C") => boolean;
  refineLayout: () => boolean;
  learnPreferences: () => string;
  explainDecision: (_id?: "A" | "B" | "C") => string;
  previewStyle: (_styleId: IntelligentDesignerStyleId, _seedBoxId: string) => boolean;
  applyStyle: (_styleId: IntelligentDesignerStyleId, _seedBoxId: string) => boolean;
  explainStyle: (_styleId?: IntelligentDesignerStyleId) => string;
  listStyles: () => Array<{ id: IntelligentDesignerStyleId; label: string }>;
};

export type PimoViewerCostEstimatorApi = {
  generateCostReport: (
    _seedBoxId?: string
  ) => import("../3d/viewer-engine/snapping/costTypes").CostFullReport;
  summarizeForUI: (
    _seedBoxId?: string
  ) => import("../3d/viewer-engine/snapping/costTypes").CostUiSummary;
  score: () => number;
  compareDesigns: (_seedBoxId: string) => unknown;
  compareStyles: () => unknown;
  estimateChangeImpact: (_change: {
    depthDeltaMm?: number;
    heightDeltaMm?: number;
    moduleCountDelta?: number;
    remateCountDelta?: number;
    rodapeCountDelta?: number;
  }) => { summary: string; deltaPercent: number; projectedCost: number };
  suggestCheaper: (_seedBoxId: string) => boolean;
  suggestPremium: (_seedBoxId: string) => boolean;
  suggestBalanced: (_seedBoxId: string) => boolean;
};

export type PimoViewerManufacturingApi = {
  generateReport: () => import("../3d/viewer-engine/snapping/manufacturingTypes").ManufacturingFullReport;
  getReport: () => import("../3d/viewer-engine/snapping/manufacturingTypes").ManufacturingUiReport;
  autoFix: () => { ok: boolean; message: string; score: number };
  score: () => number;
  previewFixes: () => boolean;
  applySuggestedFixes: () => boolean;
};

export type PimoViewerConversationalDesignerApi = {
  sendMessage: (
    _text: string,
    _seedBoxId: string
  ) => {
    assistantText: string;
    applied: boolean;
    suggestion?: string;
  };
  quickAction: (
    _action: "moreSpace" | "moreSymmetry" | "minimal" | "optimizeWall" | "variations",
    _seedBoxId: string
  ) => {
    assistantText: string;
    applied: boolean;
    suggestion?: string;
  };
  getHistory: () => Array<{
    role: "user" | "assistant";
    text: string;
    timestamp: number;
  }>;
  explain: () => string;
};

export type PimoViewerApi = {
  viewerRef: React.MutableRefObject<Viewer | null>;
  /** True após ViewerCore.setOnViewerReady / notifyViewerReady (nunca true no stub inicial). */
  viewerReady?: boolean;
  addBox: (_id: string, _options?: BoxOptions) => boolean;
  removeBox: (_id: string) => boolean;
  updateBox: (_id: string, _options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (_id: string, _index: number) => boolean;
  setBoxPosition: (_id: string, _position: { x: number; y: number; z: number }) => boolean;
  setBoxGap: (_gap: number) => void;
  addModelToBox: (_boxId: string, _modelPath: string, _modelId?: string) => boolean;
  removeModelFromBox: (_boxId: string, _modelId: string) => boolean;
  clearModelsFromBox: (_boxId: string) => void;
  listModels: (_boxId: string) => Array<{ id: string; path: string }> | null;
  getBoxDimensions: (_boxId: string) => { width: number; height: number; depth: number } | null;
  getModelPosition: (_boxId: string, _modelId: string) => { x: number; y: number; z: number } | null;
  getModelBoundingBoxSize: (_boxId: string, _modelId: string) => { width: number; height: number; depth: number } | null;
  setModelPosition: (_boxId: string, _modelId: string, _position: { x: number; y: number; z: number }) => boolean;
  setOnBoxSelected: (_callback: (_id: string | null) => void) => void;
  setOnModelLoaded: (_callback: ((_boxId: string, _modelId: string, _object: unknown) => void) | null) => void;
  setOnBoxTransform: (_callback: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotation: { x: number; y: number; z: number }) => void) | null) => void;
  setOnDoorLayerDoubleClick?: (_callback: ((_boxId: string, _doorLayerId: string) => void) | null) => void;
  setOnDrawerLayerDoubleClick?: (_callback: ((_boxId: string, _drawerLayerId: string) => void) | null) => void;
  setOnDrawerLayerClick?: (_callback: ((_boxId: string, _drawerLayerId: string) => void) | null) => void;
  setOnBoxDoubleClick?: (_callback: ((_boxId: string) => void) | null) => void;
  setTransformMode: (_mode: "translate" | "rotate" | "scale" | null) => void;
  selectBox?: (_id: string | null) => void;
  highlightBox?: (_id: string | null) => void;
  /** Ativa/desativa modo Apresentação Realista (DOF, bloom, foco automático). turntable = rotação lenta opcional. */
  setShowcaseMode?: (_active: boolean, _turntable?: boolean) => void;
  getShowcaseMode?: () => boolean;
  getCurrentMode?: () => "performance" | "showcase";
  setMode?: (_mode: "performance" | "showcase", _turntable?: boolean) => void;
  renderScene?: (_options: ViewerRenderOptions) => Promise<ViewerRenderResult | null>;
  saveSnapshot?: () => ViewerSnapshot | null;
  restoreSnapshot?: (_snapshot: ViewerSnapshot | null) => void;
  setUltraPerformanceMode?: (_active: boolean) => void;
  getUltraPerformanceMode?: () => boolean;
  setUltraPerformanceModeOptions?: (_options: UltraPerformanceModeOptions) => void;
  getUltraPerformanceModeOptions?: () => UltraPerformanceModeOptions;
  setGlobalLightIntensity?: (_value: number) => void;
  getGlobalLightIntensity?: () => number;
  setShadowIntensity?: (_value: number) => void;
  getShadowIntensity?: () => number;
  createRoom?: (_config: RoomConfig) => void;
  removeRoom?: () => void;
  setRoomBounds?: (_bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }) => void;
  clearRoomBounds?: () => void;
  /** Seleciona parede por índice (para sincronizar lista do painel com viewer). */
  selectWallByIndex?: (_index: number | null) => void;
  /** Seleciona abertura (porta/janela) por id para mover/rodar com botões do topo. */
  selectRoomElementById?: (_elementId: string | null) => void;
  selectRoomUtilityById?: (_utilityId: string | null) => void;
  setPlacementMode?: (_mode: "door" | "window" | null) => void;
  addDoorToRoom?: (_wallId: number, _config: DoorWindowConfig, _elementId?: string) => string;
  addWindowToRoom?: (_wallId: number, _config: DoorWindowConfig, _elementId?: string) => string;
  setOnRoomElementPlaced?: (
    _cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ) => void;
  setOnRoomElementSelected?: (
    _cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ) => void;
  setOnRoomUtilitySelected?: (
    _cb: ((_data: { utilityId: string; wallId: number; config: import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomUtility } | null) => void) | null
  ) => void;
  setOnWallSelected?: (_cb: ((_wallId: number | null) => void) | null) => void;
  setOnWallTransform?: (_cb: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null) => void;
  setOnRoomElementTransform?: (_cb: ((_elementId: string, _config: DoorWindowConfig) => void) | null) => void;
  setOnRoomUtilityTransform?: (
    _cb: ((_utilityId: string, _patch: Pick<import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomUtility, "positionAlongWall" | "heightMm">) => void) | null
  ) => void;
  updateRoomElementConfig?: (_elementId: string, _config: DoorWindowConfig) => boolean;
  setRoomFloorMode?: (_mode: import("../3d/viewer-engine/room/roomEngineTypes").RoomFloorMode) => void;
  setRoomHiddenWalls?: (_wallIds: string[]) => void;
  setRoomUtilities?: (_utilities: import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomUtility[]) => void;
  setLockEnabled?: (_enabled: boolean) => void;
  getLockEnabled?: () => boolean;
  getCombinedBoundingBox?: () => { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; width: number; height: number; depth: number } | null;
  getSelectedBoxDimensions?: () => { width: number; height: number; depth: number } | null;
  /** Subscreve alterações da caixa selecionada (seleção ou updateBox na caixa selecionada). Retorna função para cancelar. */
  subscribeSelectedBoxChange?: (_callback: (_id: string | null) => void) => () => void;
  setDimensionsOverlayVisible?: (_visible: boolean) => void;
  getDimensionsOverlayVisible?: () => boolean;
  toggleDimensionsOverlay?: () => boolean;
  getDimensionsOverlayData?: () => Array<{
    text: string;
    position: { x: number; y: number; z: number };
    valueMm: number;
    axis: "x" | "y" | "z";
  }>;
  getPrintReadyDimensions?: () => import("../3d/viewer-engine/overlays/boxDimensionsLayout").PrintReadyDimensions;
  getSelectedObjects?: (
    _multiBoxIds?: string[]
  ) => Array<{ kind: "box" | "remate" | "rodape"; id: string }>;
  align?: (
    _type: "right" | "left" | "front" | "back" | "top" | "bottom",
    _multiBoxIds?: string[]
  ) => boolean;
  /** Posição em pixels (relativa ao container) do topo da caixa selecionada, para overlay de texto. */
  getSelectedBoxScreenPosition?: () => { x: number; y: number } | null;
  /** Projeta um ponto 3D (mundial) em pixels relativos ao container. Retorna null se atrás da câmera. */
  projectWorldToScreen?: (_worldPoint: import("three").Vector3) => { x: number; y: number } | null;
  /** FASE 6 — Eixo de profundidade (Z local) projetável para overlay. */
  getSelectedBoxDepthAxisWorldSegment?: (
    _lengthM: number
  ) => { start: import("three").Vector3; end: import("three").Vector3 } | null;
  /** FASE 6 — Id da caixa sob o ponteiro (raycast). */
  getBoxIdAtPointerPublic?: (_event: { clientX: number; clientY: number }) => string | null;
  /** Modo canónico da régua unificada (botão único "Régua"). */
  setMeasurementMode?: (_enabled: boolean) => void;
  getMeasurementMode?: () => boolean;
  /** Fase 5 Parte A — seleção interna (faces, arestas, pontos). */
  getInternalSelectionHit?: (_event: { clientX: number; clientY: number }) => import("../3d/viewer-engine/selection/internalSelectionTypes").InternalSelectionHit | null;
  getInternalSelection?: () => import("../3d/viewer-engine/selection/internalSelectionTypes").InternalSelectionState | null;
  setInternalSelection?: (_selection: import("../3d/viewer-engine/selection/internalSelectionTypes").InternalSelectionState | null) => void;
  setInternalSelectionEnabled?: (_enabled: boolean) => void;
  getInternalSelectionEnabled?: () => boolean;
  setOnInternalSurfaceSelected?: (_callback: ((_hit: import("../3d/viewer-engine/selection/internalSelectionTypes").InternalSelectionState) => void) | null) => void;
  setOnInternalEdgeSelected?: (_callback: ((_hit: import("../3d/viewer-engine/selection/internalSelectionTypes").InternalSelectionState) => void) | null) => void;
  setOnInternalPointSelected?: (_callback: ((_hit: import("../3d/viewer-engine/selection/internalSelectionTypes").InternalSelectionState) => void) | null) => void;
  getInternalMeasurements?: (_boxId?: string) => import("../3d/viewer-engine/measurement/internalRulerOverlayTypes").InternalCavityMeasurements | null;
  isInternalRulerOverlayActive?: () => boolean;
  internalRuler?: {
    enableForBox: (_boxId: string) => void;
    disable: () => void;
    isActive: () => boolean;
    getLastMeasurement: () => { valueMm: number } | null;
    getActiveBoxId?: () => string | null;
    syncFromProject?: (_entries: import("../3d/viewer-engine/measurement/unifiedMeasurementTypes").UnifiedMeasurement[]) => void;
  };
  snapping?: {
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    setGridSize: (_mm: number) => void;
    setCaptureRadius: (_mm: number) => void;
    setMagnetStrength: (_value: number) => void;
    setMode: (_mode: "basic" | "advanced") => void;
    getMode: () => "basic" | "advanced";
    setRoomSnappingEnabled: (_enabled: boolean) => void;
    isRoomSnappingEnabled: () => boolean;
    setAutoAlignmentEnabled: (_enabled: boolean) => void;
    isAutoAlignmentEnabled: () => boolean;
    setAutoSpacingEnabled: (_enabled: boolean) => void;
    isAutoSpacingEnabled: () => boolean;
    setWallOffset: (_mm: number) => void;
    getWallOffset: () => number;
    getActiveAlignmentType: () => "flush" | "center" | "corner" | "stack" | "depth" | "height" | "spacing" | null;
  };
  autoLayout?: {
    fillWallWithModule: (_wallId: string | number, _moduleBoxId: string) => boolean;
    extendAlongWallFromBox: (_boxId: string) => boolean;
    distributeBoxesEvenly: (_boxIds: string[]) => boolean;
    autoStackShelvesInBox: (
      _boxId: string,
      _options: { count: number; topMarginMm: number; bottomMarginMm: number }
    ) => boolean;
  };
  settings?: {
    enableSmartAlignSnap: boolean;
  };
  smartLayout?: PimoViewerSmartLayoutApi;
  intelligentDesigner?: PimoViewerIntelligentDesignerApi;
  conversationalDesigner?: PimoViewerConversationalDesignerApi;
  manufacturing?: PimoViewerManufacturingApi;
  costEstimator?: PimoViewerCostEstimatorApi;
  /** Retorna o alvo do ponteiro para o menu de contexto inteligente. */
  getContextMenuLayerHit?: (_event: { clientX: number; clientY: number }) => MouseMenuTarget | null;
  getRightmostX?: () => number;
  /** Reposiciona a câmera numa vista pré-definida (top, bottom, front, back, right, left, isometric). */
  setCameraView?: (_preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric") => void;
  /** Reposiciona a câmera para o enquadramento padrão. */
  resetCamera?: () => void;
  /** Enquadra a câmara numa caixa específica. */
  frameSelection?: (_boxId: string) => boolean;
  /** Esconde/mostra manualmente uma parede (auto-hide continua ativo). */
  setManualWallHidden?: (_active: boolean) => void;
  getManualWallHidden?: () => boolean;
  /** Sala (RoomManager): criar com dimensões, remover, adicionar parede, lock. */
  createRoomWithDimensions?: (
    _width: number,
    _depth: number,
    _height: number,
    _numWalls?: 3 | 4,
    _wallThicknessM?: number
  ) => void;
  setRoomDimensions?: (_width: number, _depth: number, _height: number) => void;
  addExtraWall?: () => void;
  setRoomLocked?: (_locked: boolean) => void;
  getRoomExists?: () => boolean;
  getRoomLocked?: () => boolean;
  getRoomDimensions?: () => { width: number; depth: number; height: number } | null;
  getRoomVisible?: () => boolean;
  hideRoom?: () => void;
  showRoom?: () => void;
  setPanelEdgesVisible?: (_visible: boolean) => void;
  setPanelHidden?: (_panel: "left" | "right" | "top" | "bottom" | "back", _hidden: boolean) => void;
  setHiddenPanels?: (_keys: string[]) => void;
  getHiddenPanels?: () => string[];
  setAllPanelsHidden?: (_hidden: boolean) => void;
  setPanelRenderingEnabled?: (_enabled: boolean) => void;
  getPanelRenderingEnabled?: () => boolean;
  setRoomCeilingVisible?: (_visible: boolean) => void;
  setWallEditMode?: (_enabled: boolean) => void;
  setMousePreset?: (_preset: ViewerMousePreset) => void;
  getMousePreset?: () => ViewerMousePreset;
  setBackgroundMode?: (_mode: ViewerBackgroundMode) => void;
  getBackgroundMode?: () => ViewerBackgroundMode;
  setMaterialQuality?: (_quality: ViewerMaterialQuality) => void;
  getMaterialQuality?: () => ViewerMaterialQuality;
  updateBoxMaterial?: (_boxId: string, _materialId: string) => void;
  setBoxNoBackPanel?: (_boxId: string, _enabled: boolean) => boolean;
  updateDoorMaterial?: (_boxId: string, _doorLayerId: string, _materialId: string) => void;
  updateDrawerMaterial?: (
    _boxId: string,
    _drawerLayerId: string,
    _materialId: string,
    _drawerLayerItems?: import("../models/BoxLayers").DrawerLayerItem[]
  ) => void;
  updateFixedFrontMaterial?: (_boxId: string, _materialId: string) => void;
  /** Facade: porta | frente gaveta | frente fixa. */
  updateFrontMaterial?: (
    _partType: "door" | "drawer-front" | "fixed-front",
    _boxId: string,
    _materialId: string,
    _layerId?: string,
    _drawerLayerItems?: import("../models/BoxLayers").DrawerLayerItem[]
  ) => void;
  setMaterialMode?: (_mode: "performance" | "showcase" | "realistic") => void;
  getMaterialMode?: () => "performance" | "showcase" | "realistic";
  setReflectionsEnabled?: (_enabled: boolean) => void;
  getReflectionsEnabled?: () => boolean;
  setGlossIntensity?: (_value: number) => void;
  getGlossIntensity?: () => number;
  setMatteMode?: (_enabled: boolean) => void;
  getMatteMode?: () => boolean;
  setPhotoModeEnabled?: (_enabled: boolean) => void;
  getPhotoModeEnabled?: () => boolean;
  setExplodedViewEnabled?: (_enabled: boolean) => void;
  getExplodedViewEnabled?: () => boolean;
  setExplodedViewIntensity?: (_value: number) => void;
  /** Ativa/desativa highlight por mesh (hover + seleção em portas, gavetas, painéis, furos). */
  setHighlightEnabled?: (_enabled: boolean) => void;
  /** Obtém boxId a partir de um mesh (para régua: referência a partir do hover). */
  getBoxIdByMesh?: (_mesh: import("three").Object3D) => string | null;
  getExplodedViewIntensity?: () => number;
  /** Workspace Industrial de Design — modo de inserção de furos. */
  setIndustrialDesignWorkspaceEnabled?: (_enabled: boolean) => void;
  getIndustrialDesignWorkspaceEnabled?: () => boolean;
  setIndustrialDesignActiveHoleType?: (_id: import("../core/drill/holeCatalog").HoleTypeId | null) => void;
  getIndustrialDesignActiveHoleType?: () => import("../core/drill/holeCatalog").HoleTypeId | null;
  setIndustrialDesignBox?: (
    _box: import("../core/industrialDesigner/types").IndustrialDesignBox | null,
    _targetBoxId?: string | null
  ) => void;
  getIndustrialDesignBox?: () => import("../core/industrialDesigner/types").IndustrialDesignBox | null;
  getIndustrialDesignSelectedPanelId?: () => string | null;
  setOnIndustrialDesignPanelSelected?: (
    _callback: ((_panelId: string | null, _boxId: string | null) => void) | null
  ) => void;
  setOnIndustrialDesignHolePlaced?: (
    _callback: ((
      _panelId: string,
      _hole: import("../core/industrialDesigner/types").DesignDrillHole,
      _paired?: { panelId: string; hole: import("../core/industrialDesigner/types").DesignDrillHole }
    ) => void) | null
  ) => void;
  setOnIndustrialDesignChanged?: (
    _callback: ((box: import("../core/industrialDesigner/types").IndustrialDesignBox) => void) | null
  ) => void;
  setOnIndustrialDesignValidationChanged?: (
    _callback: ((issues: import("../core/industrialDesigner/geometryValidation").DesignValidationIssue[]) => void) | null
  ) => void;
  setOnIndustrialDesignValidationFailed?: (
    _callback: ((error: import("../core/industrialDesigner/geometryValidation").DesignValidationError) => void) | null
  ) => void;
  getIndustrialDesignValidationIssues?: () => import("../core/industrialDesigner/geometryValidation").DesignValidationIssue[];
  refreshIndustrialDesignValidation?: () => import("../core/industrialDesigner/geometryValidation").DesignValidationIssue[];
  applyMaterialPreset?: (_presetId: unknown) => void;
  getCameraPosition?: () => unknown;
  setCameraPosition?: (..._args: unknown[]) => void;
  setCameraZoom?: (..._args: unknown[]) => void;
  getCameraZoom?: () => unknown;
  setOnMultiSelectToggle?: (_callback: ((_encodedId: string) => void) | null) => void;
  setMultiSelectionOutlines?: (_ids: string[]) => void;
  setGroupTransformMembers?: (_ids: string[]) => void;
  clearGroupTransformMembers?: () => void;
  setOnTransformDragStart?: (_callback: (() => void) | null) => void;
  setOnTransformDragEnd?: (_callback: (() => void) | null) => void;
  syncMeasurementAnchors?: (
    _anchors: MeasurementAnchorEntry[],
    _selectedMesh?: unknown
  ) => void;
  addMeasurementAnchorAtPointer?: (_event: { clientX: number; clientY: number }) => {
    id: string;
    position: { x: number; y: number; z: number };
    label?: string;
    createdAt: number;
  } | null;
  isPointerOnSelectableObject?: (_event: { clientX: number; clientY: number }) => boolean;
  getSelectionIdsInScreenRect?: (
    _rect: { left: number; top: number; right: number; bottom: number },
    _canvas: HTMLCanvasElement
  ) => string[];
  bindInternalMeasurementBridge?: (
    _getMeasurements: () => import("../3d/viewer-engine/measurement/unifiedMeasurementTypes").UnifiedMeasurement[],
    _onSaved: (_entry: import("../3d/viewer-engine/measurement/unifiedMeasurementTypes").UnifiedMeasurement) => void
  ) => void;
  bindAutoLayoutBridge?: (
    _bridge: Pick<
      import("../3d/viewer-engine/autoLayout/autoLayoutTypes").AutoLayoutBridge,
      "getWorkspaceBoxes" | "applyPlan"
    > & {
      runProjectRoomFill?: () => boolean;
      getRoomLabelHint?: () => string | undefined;
    }
  ) => void;
  bindOrlaBridge?: (
    _bridge: Pick<
      import("../3d/viewer-engine/orla/OrlaVisualizer").OrlaVisualBridge,
      "getBoxOrlaConfig"
    > | null
  ) => void;
  bindRemateBridge?: (
    _bridge: Pick<
      import("../3d/viewer-engine/remate/RematePieceVisualizer").RematePieceVisualBridge,
      "listRematePieces" | "getBoxConfig" | "getBoxWorldMatrix"
    > | null
  ) => void;
  bindHematiBridge?: (
    _bridge: Pick<
      import("../3d/viewer-engine/hemati/HematiVisualizer").HematiVisualBridge,
      "getBoxHematiConfig" | "listBoxHematiConfigs" | "getBoxWorldMatrix"
    > | null
  ) => void;
  bindRodapeBridge?: (
    _bridge: Pick<
      import("../3d/viewer-engine/rodape/RodapeVisualizer").RodapeVisualBridge,
      "getBoxRodapeConfig" | "listBoxRodapeConfigs" | "getBoxWorldMatrix"
    > | null
  ) => void;
  bindDivSepBridge?: (
    _bridge: import("../3d/viewer-engine/divSep/DivSepVisualBridge").DivSepVisualBridge | null
  ) => void;
  syncOrlaVisuals?: () => void;
  syncRemateVisuals?: () => void;
  syncHematiVisuals?: () => void;
  syncRodapeVisuals?: () => void;
  refreshTransformControlsAttachment?: () => void;
  resolveFinishCollisionAfterSync?: (_params: { remateId?: string; rodapeId?: string }) => void;
  getTransformControlsDragging?: () => boolean;
  getBoxWorldMatrix?: (_boxId: string) => import("three").Matrix4 | null;
  getRemateMesh?: (_remateId: string) => import("three").Object3D | null;
  selectRemate?: (_remateId: string | null) => void;
  selectRodape?: (_rodapeId: string | null) => void;
  selectHemati?: (_hematiId: string | null) => void;
  selectDivSep?: (
    _selection: { boxId: string; kind: "div" | "sep"; itemId: string } | null
  ) => void;
  setOnRemateTransform?: (
    _callback:
      | ((
          remateId: string,
          patch: import("../core/remate/rematePieceTypes").UpdateRematePieceInput
        ) => void)
      | null
  ) => void;
  setOnRemateSelected?: (_callback: ((_remateId: string | null) => void) | null) => void;
  setOnRodapeSelected?: (_callback: ((_rodapeId: string | null) => void) | null) => void;
  setOnHematiTransform?: (
    _callback: ((hematiId: string, patch: FinishFreeTransformPatch) => void) | null
  ) => void;
  setOnRodapeTransform?: (
    _callback: ((rodapeId: string, patch: FinishFreeTransformPatch) => void) | null
  ) => void;
  setOnDivSepTransform?: (
    _callback:
      | ((
          params: {
            boxId: string;
            kind: "div" | "sep";
            itemId: string;
            positionMm: number;
          }
        ) => void)
      | null
  ) => void;
  applyRemateKeyboardTransform?: (
    _remateId: string,
    _arrowKey: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
    _options?: { stepMm?: number; stepDeg?: number; shiftKey?: boolean }
  ) => boolean;
};

export type PimoViewerContextValue = {
  /** Sempre definida — stub NOOP antes do Workspace registar a API real. */
  viewerApi: PimoViewerApi;
  /** null desregista e repõe o stub; nunca expõe null ao contexto. */
  registerViewerApi: (_api: PimoViewerApi | null) => void;
};

/** Valor devolvido por usePimoViewerContext — viewerApi nunca null. */
export type PimoViewerContextHookValue = PimoViewerContextValue & {
  viewerReady: boolean;
};

export const PimoViewerContext = createContext<PimoViewerContextValue | null>(null);
