/**
 * Hook especializado para materiais no viewer.
 * Obtém a API de materiais a partir do runtime canónico (`getActiveViewerCore`).
 */
import { useMemo } from "react";
import { isViewerCoreReady } from "../../core/viewer/viewerReadiness";
import { getActiveViewerCore } from "../../core/viewer/pimoViewerRuntime";

const NOOP = () => {};
const NOOP_RETURN_UNDEFINED = () => undefined;

/** API NOOP com exatamente as mesmas chaves que a API real. Referência estável. */
const MATERIALS_NOOP_API = {
  updateBoxMaterial: NOOP,
  updateDoorMaterial: NOOP,
  updateDrawerMaterial: NOOP,
  updateFixedFrontMaterial: NOOP,
  updateFrontMaterial: NOOP,
  setMaterialMode: NOOP,
  getMaterialMode: NOOP_RETURN_UNDEFINED,
  setMaterialQuality: NOOP,
  getMaterialQuality: NOOP_RETURN_UNDEFINED,
  applyMaterialPreset: NOOP,
  setGlossIntensity: NOOP,
  getGlossIntensity: NOOP_RETURN_UNDEFINED,
  setMatteMode: NOOP,
  getMatteMode: NOOP_RETURN_UNDEFINED,
} as const;

export function useViewerMaterials() {
  const viewerCore = getActiveViewerCore() ?? undefined;

  return useMemo(() => {
    if (!isViewerCoreReady(viewerCore) || !viewerCore) return MATERIALS_NOOP_API;

    const bind = (fn: ((..._args: unknown[]) => unknown) | undefined) =>
      fn ? fn.bind(viewerCore) : NOOP;

    return {
      updateBoxMaterial: bind(viewerCore.updateBoxMaterial),
      updateDoorMaterial: bind(viewerCore.updateDoorMaterial),
      updateDrawerMaterial: bind(viewerCore.updateDrawerMaterial),
      updateFixedFrontMaterial: bind(viewerCore.updateFixedFrontMaterial),
      updateFrontMaterial: bind(viewerCore.updateFrontMaterial),
      setMaterialMode: bind(viewerCore.setMaterialMode),
      getMaterialMode: bind(viewerCore.getMaterialMode),
      setMaterialQuality: bind(viewerCore.setMaterialQuality),
      getMaterialQuality: bind(viewerCore.getMaterialQuality),
      applyMaterialPreset: bind(viewerCore.applyMaterialPreset),
      setGlossIntensity: bind(viewerCore.setGlossIntensity),
      getGlossIntensity: bind(viewerCore.getGlossIntensity),
      setMatteMode: bind(viewerCore.setMatteMode),
      getMatteMode: bind(viewerCore.getMatteMode),
    };
  }, [viewerCore]);
}
