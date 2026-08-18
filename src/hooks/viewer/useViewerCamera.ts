/**
 * Hook especializado para câmera do viewer.
 * Obtém a API de câmera a partir do runtime canónico (`getActiveViewerCore`).
 */
import { useMemo } from "react";
import { isViewerCoreReady } from "../../core/viewer/viewerReadiness";
import { getActiveViewerCore } from "../../core/viewer/pimoViewerRuntime";

const NOOP = () => {};
const NOOP_RETURN_UNDEFINED = () => undefined;

/** API NOOP com exatamente as mesmas chaves que a API real. Referência estável. */
const CAMERA_NOOP_API = {
  setCameraView: NOOP,
  resetCamera: NOOP,
  frameSelection: () => false,
  getCameraPosition: NOOP_RETURN_UNDEFINED,
  setCameraPosition: NOOP,
  setCameraZoom: NOOP,
  getCameraZoom: NOOP_RETURN_UNDEFINED,
} as const;

export function useViewerCamera() {
  const viewerCore = getActiveViewerCore() ?? undefined;

  return useMemo(() => {
    if (!isViewerCoreReady(viewerCore) || !viewerCore) return CAMERA_NOOP_API;

    const bind = (fn: ((..._args: unknown[]) => unknown) | undefined) =>
      fn ? fn.bind(viewerCore) : NOOP;

    return {
      setCameraView: bind(viewerCore.setCameraView),
      resetCamera: bind(viewerCore.resetCamera),
      frameSelection: bind(viewerCore.frameSelection),
      getCameraPosition: bind(viewerCore.getCameraPosition),
      setCameraPosition: bind(viewerCore.setCameraPosition),
      setCameraZoom: bind(viewerCore.setCameraZoom),
      getCameraZoom: bind(viewerCore.getCameraZoom),
    };
  }, [viewerCore]);
}
