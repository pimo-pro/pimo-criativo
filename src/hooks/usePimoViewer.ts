import { useMemo, useRef } from "react";
import { useViewerBoxes } from "./viewer/useViewerBoxes";
import { useViewerRoom } from "./viewer/useViewerRoom";
import { useViewerCamera } from "./viewer/useViewerCamera";
import { useViewerMaterials } from "./viewer/useViewerMaterials";
import type { Viewer } from "../3d/core/Viewer";
import type { PimoViewerApi } from "../context/PimoViewerContextCore";
import { PIMO_VIEWER_STUBS } from "../context/pimoViewerStubApi";
import { isViewerCoreReady } from "../core/viewer/viewerReadiness";

/** Nomes de métodos do viewerCore que devem ser expostos na API (override dos stubs). */
const VIEWER_CORE_SETTING_METHODS = [
  "setPanelEdgesVisible", "setAllPanelsHidden", "setHiddenPanels", "setPanelHidden",
  "setPanelRenderingEnabled", "getPanelRenderingEnabled",
  "setRoomCeilingVisible", "setWallEditMode", "setMousePreset", "setBackgroundMode",
  "setRoomFloorMode", "setRoomHiddenWalls", "setRoomUtilities",
  "getBackgroundMode",
  "setMaterialQuality", "setReflectionsEnabled",
  "setGlossIntensity", "getGlossIntensity", "setMatteMode", "getMatteMode",
  "setPhotoModeEnabled",
  "setExplodedViewEnabled", "setExplodedViewIntensity", "setHighlightEnabled",
  "setUltraPerformanceModeOptions", "setUltraPerformanceMode",
  "setGlobalLightIntensity", "getGlobalLightIntensity",
  "setShadowIntensity", "getShadowIntensity",
  "setLockEnabled",
  "highlightBox",
  "setMode", "setShowcaseMode", "getCurrentMode", "getShowcaseMode",
] as const;

/**
 * Métodos utilitários do viewerCore que não vêm dos hooks especializados
 * (e eram servidos por stubs), mas são usados por overlays/medição/sync.
 */
const VIEWER_CORE_UTILITY_METHODS = [
  "getRightmostX",
  "getSelectedBoxDimensions",
  "subscribeSelectedBoxChange",
  "setDimensionsOverlayVisible",
  "getDimensionsOverlayVisible",
  "toggleDimensionsOverlay",
  "getDimensionsOverlayData",
  "getPrintReadyDimensions",
  "getSelectedObjects",
  "align",
  "getSelectedBoxScreenPosition",
  "projectWorldToScreen",
  "getSelectedBoxDepthAxisWorldSegment",
  "getBoxIdAtPointerPublic",
  "setMeasurementMode",
  "getMeasurementMode",
  "getInternalSelectionHit",
  "getInternalSelection",
  "setInternalSelection",
  "setInternalSelectionEnabled",
  "getInternalSelectionEnabled",
  "setOnInternalSurfaceSelected",
  "setOnInternalEdgeSelected",
  "setOnInternalPointSelected",
  "getInternalMeasurements",
  "isInternalRulerOverlayActive",
  "setManualWallHidden",
  "getManualWallHidden",
  "renderScene",
  "saveSnapshot",
  "restoreSnapshot",
  "getUltraPerformanceMode",
  "getLockEnabled",
  "getCombinedBoundingBox",
] as const;

const VIEWER_CORE_INDUSTRIAL_DESIGN_METHODS = [
  "setIndustrialDesignWorkspaceEnabled",
  "getIndustrialDesignWorkspaceEnabled",
  "setIndustrialDesignActiveHoleType",
  "getIndustrialDesignActiveHoleType",
  "setIndustrialDesignBox",
  "getIndustrialDesignBox",
  "getIndustrialDesignSelectedPanelId",
  "setOnIndustrialDesignPanelSelected",
  "setOnIndustrialDesignHolePlaced",
  "setOnIndustrialDesignChanged",
  "setOnIndustrialDesignValidationChanged",
  "setOnIndustrialDesignValidationFailed",
  "getIndustrialDesignValidationIssues",
  "refreshIndustrialDesignValidation",
] as const;

/**
 * Retorna uma API plana para o viewer (boxes, room, camera, materials, ruler).
 * Métodos do ViewerCore só são expostos após `viewerReady === true`.
 */
export function usePimoViewer() {
  const boxes = useViewerBoxes();
  const room = useViewerRoom();
  const camera = useViewerCamera();
  const materials = useViewerMaterials();
  const viewerCore =
    typeof window !== "undefined" ? window.viewerCore ?? undefined : undefined;
  const coreReady = isViewerCoreReady(viewerCore);
  const viewerRef = useRef<Viewer | null>(null);

  return useMemo(
    (): PimoViewerApi =>
      ({
        ...PIMO_VIEWER_STUBS,
        viewerRef,
        viewerReady: coreReady,
        ...boxes,
        ...room,
        ...camera,
        ...materials,
        ...(coreReady && viewerCore
          ? [
              ...VIEWER_CORE_SETTING_METHODS,
              ...VIEWER_CORE_UTILITY_METHODS,
              ...VIEWER_CORE_INDUSTRIAL_DESIGN_METHODS,
            ].reduce<Record<string, unknown>>((acc, name) => {
              const fn = (viewerCore as Record<string, unknown>)[name];
              if (typeof fn === "function") acc[name] = fn.bind(viewerCore);
              return acc;
            }, {})
          : {}),
        getBoxIdByMesh:
          coreReady &&
          viewerCore &&
          typeof (viewerCore as { getBoxIdByMeshPublic?: unknown }).getBoxIdByMeshPublic === "function"
            ? (viewerCore as { getBoxIdByMeshPublic: (..._args: unknown[]) => unknown }).getBoxIdByMeshPublic.bind(viewerCore)
            : PIMO_VIEWER_STUBS.getBoxIdByMesh,
        internalRuler:
          coreReady && viewerCore && (viewerCore as { internalRuler?: PimoViewerApi["internalRuler"] }).internalRuler
            ? (viewerCore as { internalRuler: NonNullable<PimoViewerApi["internalRuler"]> }).internalRuler
            : PIMO_VIEWER_STUBS.internalRuler,
        snapping:
          coreReady && viewerCore && (viewerCore as { snapping?: PimoViewerApi["snapping"] }).snapping
            ? (viewerCore as { snapping: NonNullable<PimoViewerApi["snapping"]> }).snapping
            : PIMO_VIEWER_STUBS.snapping,
        autoLayout:
          coreReady && viewerCore && (viewerCore as { autoLayout?: PimoViewerApi["autoLayout"] }).autoLayout
            ? (viewerCore as { autoLayout: NonNullable<PimoViewerApi["autoLayout"]> }).autoLayout
            : PIMO_VIEWER_STUBS.autoLayout,
        smartLayout: coreReady ? viewerCore?.smartLayout : undefined,
        intelligentDesigner: coreReady ? viewerCore?.intelligentDesigner : undefined,
        conversationalDesigner: coreReady ? viewerCore?.conversationalDesigner : undefined,
        manufacturing: coreReady ? viewerCore?.manufacturing : undefined,
        costEstimator: coreReady ? viewerCore?.costEstimator : undefined,
      }) as PimoViewerApi,
    [boxes, room, camera, materials, viewerCore, coreReady]
  );
}
