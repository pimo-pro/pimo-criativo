/**
 * Hook especializado para boxes no viewer.
 * Obtém a API de boxes a partir do runtime canónico (`getActiveViewerCore`).
 */
import { useMemo } from "react";
import { isViewerCoreReady } from "../../core/viewer/viewerReadiness";
import { getActiveViewerCore } from "../../core/viewer/pimoViewerRuntime";

const NOOP = () => {};
const NOOP_SELECT_BOX = () => {};
const NOOP_RETURN_FALSE = () => false;
const NOOP_RETURN_NULL = () =>
  (null as {
    boxId: string;
    type: "door" | "drawer";
    doorLayerId?: string;
    drawerLayerId?: string;
  } | null);

/** API NOOP com exatamente as mesmas chaves que a API real. Referência estável. */
const BOXES_NOOP_API = {
  addBox: () => false,
  removeBox: NOOP_RETURN_FALSE,
  updateBox: () => false,
  setBoxIndex: () => false,
  setBoxPosition: NOOP_RETURN_FALSE,
  setBoxGap: NOOP,
  setBoxSpacing: NOOP,
  updateBoxSpacing: NOOP,
  setOnBoxSelected: NOOP,
  setOnDoorLayerDoubleClick: NOOP,
  setOnDrawerLayerDoubleClick: NOOP,
  setOnDrawerLayerClick: NOOP,
  setOnBoxDoubleClick: NOOP,
  setOnBoxTransform: NOOP,
  setOnModelLoaded: NOOP,
  selectBox: NOOP_SELECT_BOX,
  setTransformMode: NOOP,
  addModelToBox: () => false,
  removeModelFromBox: () => false,
  clearModelsFromBox: NOOP,
  listModels: () => null,
  getBoxDimensions: () => null,
  getModelPosition: () => null,
  getModelBoundingBoxSize: () => null,
  setModelPosition: () => false,
  getContextMenuLayerHit: NOOP_RETURN_NULL,
} as const;

export function useViewerBoxes() {
  const viewerCore = getActiveViewerCore() ?? undefined;
  const coreReady = isViewerCoreReady(viewerCore);

  return useMemo(() => {
    if (!coreReady || !viewerCore) return BOXES_NOOP_API;

    const fromCore = (fn: ((..._args: unknown[]) => unknown) | undefined) =>
      fn ? fn.bind(viewerCore) : NOOP;

    /** Métodos que devem retornar boolean e serem chamados com this=viewerCore. */
    const bindBool = (fn: ((..._args: unknown[]) => boolean) | undefined) =>
      fn ? fn.bind(viewerCore) : NOOP_RETURN_FALSE;

    return {
      addBox: bindBool(viewerCore.addBox as ((..._args: unknown[]) => boolean) | undefined),
      removeBox: bindBool(viewerCore.removeBox as ((..._args: unknown[]) => boolean) | undefined),
      updateBox: bindBool(viewerCore.updateBox as ((..._args: unknown[]) => boolean) | undefined),
      setBoxIndex: bindBool(viewerCore.setBoxIndex as ((..._args: unknown[]) => boolean) | undefined),
      setBoxPosition: bindBool(viewerCore.setBoxPosition as ((..._args: unknown[]) => boolean) | undefined),
      setBoxGap: fromCore(viewerCore.setBoxGap),
      setBoxSpacing: fromCore(viewerCore.setBoxSpacing),
      updateBoxSpacing: fromCore(viewerCore.updateBoxSpacing),
      setOnBoxSelected: fromCore(viewerCore.setOnBoxSelected),
      setOnDoorLayerDoubleClick: fromCore(viewerCore.setOnDoorLayerDoubleClick),
      setOnDrawerLayerDoubleClick: fromCore(viewerCore.setOnDrawerLayerDoubleClick),
      setOnDrawerLayerClick: fromCore(viewerCore.setOnDrawerLayerClick),
      setOnBoxDoubleClick: fromCore(viewerCore.setOnBoxDoubleClick),
      setOnBoxTransform: fromCore(viewerCore.setOnBoxTransform),
      setOnModelLoaded: fromCore(viewerCore.setOnModelLoaded),
      selectBox: fromCore(viewerCore.selectBox),
      setTransformMode: fromCore(viewerCore.setTransformMode),
      addModelToBox: bindBool(viewerCore.addModelToBox as ((..._args: unknown[]) => boolean) | undefined),
      removeModelFromBox: bindBool(viewerCore.removeModelFromBox as ((..._args: unknown[]) => boolean) | undefined),
      clearModelsFromBox: fromCore(viewerCore.clearModelsFromBox),
      listModels: fromCore(viewerCore.listModels),
      getBoxDimensions: fromCore(viewerCore.getBoxDimensions),
      getModelPosition: fromCore(viewerCore.getModelPosition),
      getModelBoundingBoxSize: fromCore(viewerCore.getModelBoundingBoxSize),
      setModelPosition: bindBool(viewerCore.setModelPosition as ((..._args: unknown[]) => boolean) | undefined),
      getContextMenuLayerHit: viewerCore.getContextMenuLayerHit
        ? viewerCore.getContextMenuLayerHit.bind(viewerCore)
        : NOOP_RETURN_NULL,
    };
  }, [viewerCore, coreReady]);
}
