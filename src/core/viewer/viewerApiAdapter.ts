import type {
  DoorWindowConfig,
  RoomConfig,
  ViewerApi,
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerSnapshot,
  ViewerToolMode,
} from "../../context/projectTypes";
import type { PimoViewerApi } from "../../context/PimoViewerContextCore";

/** Mapeia ViewerToolMode para setTransformMode do Viewer (select = sem gizmo). */
function toolModeToTransformMode(mode: ViewerToolMode): "translate" | "rotate" | null {
  if (mode === "select") return null;
  if (mode === "move") return "translate";
  return "rotate";
}

/**
 * Adaptador que converte PimoViewerApi para ViewerApi.
 * Permite que useViewerSync (ProjectContext) utilize o viewer registrado via PimoViewerContext.
 *
 * setTool liga às ferramentas reais do Viewer (setTransformMode). Snapshot/2D/render são stubs.
 */
export function createViewerApiAdapter(
  pimoApi: PimoViewerApi | null
): ViewerApi | null {
  if (!pimoApi) return null;

  return {
    saveSnapshot: (): ViewerSnapshot | null => {
      // TODO: implementar no Viewer quando suportar serialização de estado da câmera
      return null;
    },

    restoreSnapshot: (_snapshot: ViewerSnapshot | null): void => {
      // TODO: implementar no Viewer quando suportar restauração
    },

    enable2DView: (_angle: "top" | "front" | "left" | "right"): void => {
      // TODO: implementar no Viewer — fixar câmera em ângulo ortográfico
    },

    disable2DView: (): void => {
      // TODO: implementar no Viewer — restaurar controle orbit
    },

    renderScene: (options: ViewerRenderOptions): Promise<ViewerRenderResult | null> => {
      if (pimoApi.renderScene) {
        return pimoApi.renderScene(options);
      }
      return Promise.resolve(null);
    },

    setTool: (mode: ViewerToolMode): void => {
      pimoApi.setTransformMode(toolModeToTransformMode(mode));
    },

    setUltraPerformanceMode: (active: boolean): void => {
      pimoApi.setUltraPerformanceMode?.(active);
    },

    getUltraPerformanceMode: (): boolean => {
      return pimoApi.getUltraPerformanceMode?.() ?? false;
    },

    createRoom: (config: RoomConfig): void => {
      pimoApi.createRoom?.(config);
    },

    removeRoom: (): void => {
      pimoApi.removeRoom?.();
    },

    selectWallByIndex: (index: number | null): void => {
      pimoApi.selectWallByIndex?.(index);
    },

    selectRoomElementById: (elementId: string | null): void => {
      pimoApi.selectRoomElementById?.(elementId);
    },

    setPlacementMode: (mode: "door" | "window" | null): void => {
      pimoApi.setPlacementMode?.(mode);
    },

    addDoorToRoom: (wallId: number, config: DoorWindowConfig): string => {
      return pimoApi.addDoorToRoom?.(wallId, config) ?? "";
    },

    addWindowToRoom: (wallId: number, config: DoorWindowConfig): string => {
      return pimoApi.addWindowToRoom?.(wallId, config) ?? "";
    },

    setOnRoomElementPlaced: (
      cb: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
    ): void => {
      pimoApi.setOnRoomElementPlaced?.(cb);
    },

    setOnRoomElementSelected: (
      cb: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
    ): void => {
      pimoApi.setOnRoomElementSelected?.(cb);
    },

    updateRoomElementConfig: (elementId: string, config: DoorWindowConfig): boolean => {
      return pimoApi.updateRoomElementConfig?.(elementId, config) ?? false;
    },
    setLockEnabled: (enabled: boolean): void => {
      pimoApi.setLockEnabled?.(enabled);
    },
    getLockEnabled: (): boolean => {
      return pimoApi.getLockEnabled?.() ?? false;
    },
    getCombinedBoundingBox: () => {
      const bbox = pimoApi.getCombinedBoundingBox?.();
      return bbox ? { width: bbox.width, height: bbox.height, depth: bbox.depth } : null;
    },
    getSelectedBoxDimensions: () => pimoApi.getSelectedBoxDimensions?.() ?? null,
    setDimensionsOverlayVisible: (visible: boolean): void => {
      pimoApi.setDimensionsOverlayVisible?.(visible);
    },
    getDimensionsOverlayVisible: (): boolean => {
      return pimoApi.getDimensionsOverlayVisible?.() ?? false;
    },
    getSelectedBoxScreenPosition: (): { x: number; y: number } | null => {
      return pimoApi.getSelectedBoxScreenPosition?.() ?? null;
    },
    getRightmostX: (): number => {
      return pimoApi.getRightmostX?.() ?? -0.1;
    },
  };
}
