import type {
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

    renderScene: (_options: ViewerRenderOptions): ViewerRenderResult | null => {
      // TODO: implementar no Viewer — renderizar cena offscreen e retornar dataUrl
      return null;
    },

    setTool: (mode: ViewerToolMode): void => {
      pimoApi.setTransformMode(toolModeToTransformMode(mode));
    },
  };
}
