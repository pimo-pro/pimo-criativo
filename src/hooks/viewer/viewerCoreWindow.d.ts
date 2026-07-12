/* eslint-disable no-unused-vars -- declaração de tipos; nomes de parâmetros são apenas documentação */
/**
 * Declaração global única para window.viewerCore.
 * Usado por hooks de integração com o viewer.
 */
declare global {
  interface Window {
    viewerCore?: {
      addBox?: (...args: unknown[]) => unknown;
      removeBox?: (...args: unknown[]) => unknown;
      updateBox?: (...args: unknown[]) => unknown;
      setBoxIndex?: (...args: unknown[]) => unknown;
      setBoxPosition?: (...args: unknown[]) => unknown;
      addModelToBox?: (...args: unknown[]) => unknown;
      removeModelFromBox?: (...args: unknown[]) => unknown;
      clearModelsFromBox?: (...args: unknown[]) => unknown;
      listModels?: (...args: unknown[]) => unknown;
      getBoxDimensions?: (...args: unknown[]) => unknown;
      getModelPosition?: (...args: unknown[]) => unknown;
      getModelBoundingBoxSize?: (...args: unknown[]) => unknown;
      setModelPosition?: (...args: unknown[]) => unknown;
      setBoxGap?: (gap: number) => void;
      setBoxSpacing?: (spacing: number) => void;
      updateBoxSpacing?: (spacing: number) => void;
      setOnBoxSelected?: (callback: (id: string | null) => void) => void;
      setOnMultiSelectToggle?: (callback: ((encodedId: string) => void) | null) => void;
      setMultiSelectionOutlines?: (ids: string[]) => void;
      setGroupTransformMembers?: (ids: string[]) => void;
      clearGroupTransformMembers?: () => void;
      setOnTransformDragStart?: (callback: (() => void) | null) => void;
      setOnTransformDragEnd?: (callback: (() => void) | null) => void;
      syncMeasurementAnchors?: (
        anchors: import("../../core/viewer/measurementAnchors").MeasurementAnchorEntry[],
        selectedMesh?: unknown
      ) => void;
      addMeasurementAnchorAtPointer?: (event: { clientX: number; clientY: number }) => {
        id: string;
        position: { x: number; y: number; z: number };
        label?: string;
        createdAt: number;
      } | null;
      applySmartSnapForGroup?: (pointerPosition?: { x: number; y: number; z: number }) => boolean;
      isPointerOnSelectableObject?: (event: { clientX: number; clientY: number }) => boolean;
      getSelectionIdsInScreenRect?: (
        rect: { left: number; top: number; right: number; bottom: number },
        canvas: HTMLCanvasElement
      ) => string[];
      setOnDoorLayerDoubleClick?: (callback: ((boxId: string, doorLayerId: string) => void) | null) => void;
      setOnDrawerLayerDoubleClick?: (callback: ((boxId: string, drawerLayerId: string) => void) | null) => void;
      setOnDrawerLayerClick?: (callback: ((boxId: string, drawerLayerId: string) => void) | null) => void;
      setOnBoxDoubleClick?: (callback: ((boxId: string) => void) | null) => void;
      setOnBoxTransform?: (
        callback: ((
          boxId: string,
          position: { x: number; y: number; z: number },
          rotation: { x: number; y: number; z: number }
        ) => void) | null
      ) => void;
      setOnModelLoaded?: (callback: ((boxId: string, modelId: string, object: unknown) => void) | null) => void;
      selectBox?: (id: string | null) => void;
      setTransformMode?: (mode: "translate" | "rotate" | "scale" | null) => void;
      getContextMenuLayerHit?: (
        event: { clientX: number; clientY: number }
      ) => import("../../ui/context-menu/ContextMenuEngine").MouseMenuTarget | null;
      setCameraView?: (preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric") => void;
      resetCamera?: () => void;
      frameSelection?: (boxId: string) => boolean;
      internalRuler?: {
        enableForBox: (boxId: string) => void;
        disable: () => void;
        isActive: () => boolean;
        getLastMeasurement: () => { valueMm: number } | null;
        getActiveBoxId: () => string | null;
        syncFromProject: (entries: import("../3d/viewer-engine/measurement/internalRulerTypes").InternalMeasurementEntry[]) => void;
      };
      bindInternalMeasurementBridge?: (
        getMeasurements: () => import("../3d/viewer-engine/measurement/internalRulerTypes").InternalMeasurementEntry[],
        onSaved: (entry: import("../3d/viewer-engine/measurement/internalRulerTypes").InternalMeasurementEntry) => void
      ) => void;
      bindAutoLayoutBridge?: (
        bridge: Pick<
          import("../3d/viewer-engine/autoLayout/autoLayoutTypes").AutoLayoutBridge,
          "getWorkspaceBoxes" | "applyPlan"
        > & {
          runProjectRoomFill?: () => boolean;
          getRoomLabelHint?: () => string | undefined;
        }
      ) => void;
      bindOrlaBridge?: (
        bridge: Pick<
          import("../3d/viewer-engine/orla/OrlaVisualizer").OrlaVisualBridge,
          "getBoxOrlaConfig"
        > | null
      ) => void;
      syncOrlaVisuals?: () => void;
      orlaVisual?: {
        syncAll: () => void;
      };
      bindRemateBridge?: (
        bridge: Pick<
          import("../3d/viewer-engine/remate/RematePieceVisualizer").RematePieceVisualBridge,
          "listRematePieces" | "getBoxConfig" | "getBoxWorldMatrix"
        > | null
      ) => void;
      setOnRemateTransform?: (
        callback:
          | ((
              remateId: string,
              patch: import("../../core/remate/rematePieceTypes").UpdateRematePieceInput
            ) => void)
          | null
      ) => void;
      setOnRemateSelected?: (callback: ((_remateId: string | null) => void) | null) => void;
      setOnRodapeSelected?: (callback: ((_rodapeId: string | null) => void) | null) => void;
      selectRemate?: (remateId: string | null) => void;
      selectDivSep?: (
        selection: { boxId: string; kind: "div" | "sep"; itemId: string } | null
      ) => void;
      bindDivSepBridge?: (
        bridge: import("../3d/viewer-engine/divSep/DivSepVisualBridge").DivSepVisualBridge | null
      ) => void;
      setOnDivSepTransform?: (
        callback:
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
      getRemateMesh?: (remateId: string) => unknown;
      getBoxDimensions?: (boxId: string) => { width: number; height: number; depth: number } | null;
      getBoxWorldMatrix?: (boxId: string) => unknown;
      syncRemateVisuals?: () => void;
      resolveFinishCollisionAfterSync?: (params: { remateId?: string; rodapeId?: string }) => void;
      refreshTransformControlsAttachment?: () => void;
      remateVisual?: {
        syncAll: () => void;
      };
      bindHematiBridge?: (
        bridge: Pick<
          import("../3d/viewer-engine/hemati/HematiVisualizer").HematiVisualBridge,
          "getBoxHematiConfig" | "listBoxHematiConfigs" | "getBoxWorldMatrix"
        > | null
      ) => void;
      syncHematiVisuals?: () => void;
      hematiVisual?: { syncAll: () => void };
      setOnHematiTransform?: (
        callback:
          | ((
              hematiId: string,
              patch: {
                transform: {
                  xMm: number;
                  yMm: number;
                  zMm: number;
                  rotacaoXRad: number;
                  rotacaoYRad: number;
                  rotacaoZRad: number;
                };
                placementFree: boolean;
              }
            ) => void)
          | null
      ) => void;
      selectHemati?: (hematiId: string | null) => void;
      bindRodapeBridge?: (
        bridge: Pick<
          import("../3d/viewer-engine/rodape/RodapeVisualizer").RodapeVisualBridge,
          "getBoxRodapeConfig" | "listBoxRodapeConfigs" | "getBoxWorldMatrix"
        > | null
      ) => void;
      syncRodapeVisuals?: () => void;
      rodapeVisual?: { syncAll: () => void };
      setOnRodapeTransform?: (
        callback:
          | ((
              rodapeId: string,
              patch: {
                transform: {
                  xMm: number;
                  yMm: number;
                  zMm: number;
                  rotacaoXRad: number;
                  rotacaoYRad: number;
                  rotacaoZRad: number;
                };
                placementFree: boolean;
              }
            ) => void)
          | null
      ) => void;
      selectRodape?: (rodapeId: string | null) => void;
      settings?: {
        enableSmartAlignSnap: boolean;
      };
      snapping?: {
        enable: () => void;
        disable: () => void;
        isEnabled: () => boolean;
        setGridSize: (mm: number) => void;
        setCaptureRadius: (mm: number) => void;
        setMagnetStrength: (value: number) => void;
        setMode: (mode: "basic" | "advanced") => void;
        getMode: () => "basic" | "advanced";
        setRoomSnappingEnabled: (enabled: boolean) => void;
        isRoomSnappingEnabled: () => boolean;
        setAutoAlignmentEnabled: (enabled: boolean) => void;
        isAutoAlignmentEnabled: () => boolean;
        setAutoSpacingEnabled: (enabled: boolean) => void;
        isAutoSpacingEnabled: () => boolean;
        setWallOffset: (mm: number) => void;
        getWallOffset: () => number;
        getActiveAlignmentType: () => "flush" | "center" | "corner" | "stack" | "depth" | "height" | "spacing" | null;
      };
      autoLayout?: {
        fillWallWithModule: (wallId: string | number, moduleBoxId: string) => boolean;
        extendAlongWallFromBox: (boxId: string) => boolean;
        distributeBoxesEvenly: (boxIds: string[]) => boolean;
        autoStackShelvesInBox: (
          boxId: string,
          options: { count: number; topMarginMm: number; bottomMarginMm: number }
        ) => boolean;
      };
      smartLayout?: {
        autoWallFill: (wallId: string | number, moduleBoxId: string) => boolean;
        previewAutoWallFill: (wallId: string | number, moduleBoxId: string) => boolean;
        autoRoomFill: (seedBoxId?: string) => boolean;
        autoDistribute: (boxIds: string[]) => boolean;
        autoStackShelves: (
          boxId: string,
          options: { count: number; topMarginMm: number; bottomMarginMm: number }
        ) => boolean;
        applyPredictiveLayout: () => boolean;
        rejectPredictiveLayout: () => void;
        hasPredictiveLayout: () => boolean;
      };
      intelligentDesigner?: {
        generateDesigns: (seedBoxId: string) => boolean;
        generateVariations: () => boolean;
        previewDesign: (id: "A" | "B" | "C") => boolean;
        applyDesign: (id: "A" | "B" | "C") => boolean;
        refineLayout: () => boolean;
        learnPreferences: () => string;
        explainDecision: (id?: "A" | "B" | "C") => string;
        previewStyle: (
          styleId:
            | "modern"
            | "nordic"
            | "industrial"
            | "minimalist"
            | "classic"
            | "scandinavian"
            | "japandi"
            | "luxury",
          seedBoxId: string
        ) => boolean;
        applyStyle: (
          styleId:
            | "modern"
            | "nordic"
            | "industrial"
            | "minimalist"
            | "classic"
            | "scandinavian"
            | "japandi"
            | "luxury",
          seedBoxId: string
        ) => boolean;
        explainStyle: (
          styleId?:
            | "modern"
            | "nordic"
            | "industrial"
            | "minimalist"
            | "classic"
            | "scandinavian"
            | "japandi"
            | "luxury"
        ) => string;
        listStyles: () => Array<{
          id:
            | "modern"
            | "nordic"
            | "industrial"
            | "minimalist"
            | "classic"
            | "scandinavian"
            | "japandi"
            | "luxury";
          label: string;
        }>;
      };
      costEstimator?: {
        generateCostReport: (
          seedBoxId?: string
        ) => import("../../3d/viewer-engine/snapping/costTypes").CostFullReport;
        summarizeForUI: (
          seedBoxId?: string
        ) => import("../../3d/viewer-engine/snapping/costTypes").CostUiSummary;
        score: () => number;
        compareDesigns: (seedBoxId: string) => unknown;
        compareStyles: () => unknown;
        estimateChangeImpact: (change: {
          depthDeltaMm?: number;
          heightDeltaMm?: number;
          moduleCountDelta?: number;
          remateCountDelta?: number;
          rodapeCountDelta?: number;
        }) => { summary: string; deltaPercent: number; projectedCost: number };
        suggestCheaper: (seedBoxId: string) => boolean;
        suggestPremium: (seedBoxId: string) => boolean;
        suggestBalanced: (seedBoxId: string) => boolean;
      };
      manufacturing?: {
        generateReport: () => import("../../3d/viewer-engine/snapping/manufacturingTypes").ManufacturingFullReport;
        getReport: () => import("../../3d/viewer-engine/snapping/manufacturingTypes").ManufacturingUiReport;
        autoFix: () => { ok: boolean; message: string; score: number };
        score: () => number;
        previewFixes: () => boolean;
        applySuggestedFixes: () => boolean;
      };
      conversationalDesigner?: {
        sendMessage: (
          text: string,
          seedBoxId: string
        ) => {
          assistantText: string;
          applied: boolean;
          suggestion?: string;
        };
        quickAction: (
          action: "moreSpace" | "moreSymmetry" | "minimal" | "optimizeWall" | "variations",
          seedBoxId: string
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
      getCameraPosition?: () => unknown;
      setCameraPosition?: (...args: unknown[]) => void;
      setCameraZoom?: (...args: unknown[]) => void;
      getCameraZoom?: () => unknown;
      createRoom?: (...args: unknown[]) => unknown;
      createRoomWithDimensions?: (...args: unknown[]) => unknown;
      removeRoom?: (...args: unknown[]) => unknown;
      setRoomDimensions?: (...args: unknown[]) => unknown;
      addExtraWall?: (...args: unknown[]) => unknown;
      setRoomLocked?: (locked: boolean) => void;
      getRoomLocked?: () => boolean;
      roomManager?: {
        createRoom?: (...args: unknown[]) => unknown;
        removeRoom?: (...args: unknown[]) => unknown;
        addDoorToRoom?: (...args: unknown[]) => unknown;
        addWindowToRoom?: (...args: unknown[]) => unknown;
        getRoomExists?: () => boolean;
        getRoomDimensions?: () => unknown;
        getRoomVisible?: () => boolean;
        hideRoom?: () => void;
        showRoom?: () => void;
      };
      selectWallByIndex?: (index: number | null) => void;
      selectRoomElementById?: (elementId: string | null) => void;
      selectRoomUtilityById?: (utilityId: string | null) => void;
      setPlacementMode?: (mode: "door" | "window" | null) => void;
      setOnRoomElementPlaced?: (callback: unknown) => void;
      setOnRoomElementSelected?: (callback: unknown) => void;
      setOnRoomUtilitySelected?: (callback: unknown) => void;
      setOnWallSelected?: (callback: ((wallId: number | null) => void) | null) => void;
      setOnWallTransform?: (
        callback: ((wallIndex: number, position: { x: number; z: number }, rotation: number) => void) | null
      ) => void;
      setOnRoomElementTransform?: (callback: ((elementId: string, config: unknown) => void) | null) => void;
      setOnRoomUtilityTransform?: (callback: ((utilityId: string, patch: unknown) => void) | null) => void;
      updateRoomElementConfig?: (...args: unknown[]) => unknown;
      setRoomFloorMode?: (mode: "full" | "room" | "hybrid") => void;
      setRoomHiddenWalls?: (wallIds: string[]) => void;
      setRoomUtilities?: (utilities: unknown[]) => void;
      setRoomBounds?: (bounds: unknown) => void;
      clearRoomBounds?: () => void;
      getRoomExists?: () => boolean;
      getRoomDimensions?: () => unknown;
      getRoomVisible?: () => boolean;
      hideRoom?: () => void;
      showRoom?: () => void;
      addDoorToRoom?: (...args: unknown[]) => unknown;
      addWindowToRoom?: (...args: unknown[]) => unknown;
      updateBoxMaterial?: (id: string, materialName: string) => void;
      setBoxNoBackPanel?: (boxId: string, enabled: boolean) => boolean;
      updateDoorMaterial?: (
        boxId: string,
        doorLayerId: string,
        materialName: string,
        grainOptions?: { allowPieceRotation?: boolean; pieceTipo?: string }
      ) => void;
      updateDrawerMaterial?: (
        boxId: string,
        drawerLayerId: string,
        materialName: string,
        grainOptions?: { allowPieceRotation?: boolean }
      ) => void;
      setMaterialMode?: (mode: unknown) => void;
      getMaterialMode?: () => unknown;
      setMaterialQuality?: (quality: unknown) => void;
      getMaterialQuality?: () => unknown;
      applyMaterialPreset?: (presetId: unknown) => void;
      setGlobalLightIntensity?: (value: number) => void;
      getGlobalLightIntensity?: () => number;
      setShadowIntensity?: (value: number) => void;
      getShadowIntensity?: () => number;
      setGlossIntensity?: (value: number) => void;
      getGlossIntensity?: () => number;
      setMatteMode?: (enabled: boolean) => void;
      getMatteMode?: () => boolean;
      setPanelRenderingEnabled?: (enabled: boolean) => void;
      getPanelRenderingEnabled?: () => boolean;
      display?: {
        shadowIntensity: number;
      };
      events?: {
        emit?: (event: string, ...args: unknown[]) => void;
      };
    };
  }
}

export {};
