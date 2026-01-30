import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "../3d/core/Viewer";
import type { ViewerOptions } from "../3d/core/Viewer";
import type { BoxOptions } from "../3d/objects/BoxBuilder";

type PimoViewerAPI = {
  viewerRef: React.MutableRefObject<Viewer | null>;
  viewerReady: boolean;
  selectedBoxId: string | null;
  onBoxSelected: (callback: (id: string | null) => void) => void;
  setOnBoxSelected: (callback: (id: string | null) => void) => void;
  selectBox: (id: string | null) => void;
  addBox: (id: string, options?: BoxOptions) => boolean;
  removeBox: (id: string) => boolean;
  updateBox: (id: string, options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (id: string, index: number) => boolean;
  setBoxPosition: (id: string, position: { x: number; y: number; z: number }) => boolean;
  setBoxGap: (gap: number) => void;
  addModelToBox: (boxId: string, modelPath: string, modelId?: string) => boolean;
  removeModelFromBox: (boxId: string, modelId: string) => boolean;
  clearModelsFromBox: (boxId: string) => void;
  listModels: (boxId: string) => Array<{ id: string; path: string }> | null;
  getBoxDimensions: (boxId: string) => { width: number; height: number; depth: number } | null;
  getModelPosition: (boxId: string, modelId: string) => { x: number; y: number; z: number } | null;
  getModelBoundingBoxSize: (boxId: string, modelId: string) => { width: number; height: number; depth: number } | null;
  setModelPosition: (boxId: string, modelId: string, position: { x: number; y: number; z: number }) => boolean;
  setOnModelLoaded: (callback: ((boxId: string, modelId: string, object: unknown) => void) | null) => void;
  setOnBoxTransform: (callback: ((boxId: string, position: { x: number; y: number; z: number }, rotationY: number) => void) | null) => void;
  setTransformMode: (mode: "translate" | "rotate" | null) => void;
  highlightBox: (id: string | null) => void;
};

export const usePimoViewer = (
  containerRef: RefObject<HTMLDivElement | null>,
  options?: ViewerOptions
): PimoViewerAPI => {
  const viewerRef = useRef<Viewer | null>(null);
  const optionsRef = useRef(options);
  const [viewerReady, setViewerReady] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const onBoxSelectedRef = useRef<((id: string | null) => void) | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setViewerReady(false);
      return;
    }

    if (viewerRef.current) {
      setViewerReady(true);
      return;
    }

    viewerRef.current = new Viewer(container, optionsRef.current ?? {});
    viewerRef.current.setOnBoxSelected((id) => {
      setSelectedBoxId(id);
      onBoxSelectedRef.current?.(id);
    });
    // Marcar viewer como pronto após um frame para garantir que o canvas foi dimensionado
    const raf = requestAnimationFrame(() => {
      setViewerReady(true);
    });

    return () => {
      cancelAnimationFrame(raf);
      viewerRef.current?.dispose();
      viewerRef.current = null;
      setViewerReady(false);
    };
  }, [containerRef]);

  const setOnBoxSelected = useCallback((callback: (id: string | null) => void) => {
    onBoxSelectedRef.current = callback;
  }, []);

  const addBox = useCallback(
    (id: string, boxOptions?: BoxOptions) => viewerRef.current?.addBox(id, boxOptions) ?? false,
    []
  );

  const removeBox = useCallback(
    (id: string) => viewerRef.current?.removeBox(id) ?? false,
    []
  );

  const updateBox = useCallback(
    (id: string, boxOptions: Partial<BoxOptions>) =>
      viewerRef.current?.updateBox(id, boxOptions) ?? false,
    []
  );

  const setBoxIndex = useCallback(
    (id: string, index: number) => viewerRef.current?.setBoxIndex(id, index) ?? false,
    []
  );

  const setBoxPosition = useCallback(
    (id: string, position: { x: number; y: number; z: number }) =>
      viewerRef.current?.setBoxPosition(id, position) ?? false,
    []
  );

  const setBoxGap = useCallback((gap: number) => {
    viewerRef.current?.setBoxGap(gap);
  }, []);

  const addModelToBox = useCallback(
    (boxId: string, modelPath: string, modelId?: string) =>
      viewerRef.current?.addModelToBox(boxId, modelPath, modelId) ?? false,
    []
  );

  const removeModelFromBox = useCallback(
    (boxId: string, modelId: string) =>
      viewerRef.current?.removeModelFromBox(boxId, modelId) ?? false,
    []
  );

  const clearModelsFromBox = useCallback((boxId: string) => {
    viewerRef.current?.clearModelsFromBox(boxId);
  }, []);

  const listModels = useCallback(
    (boxId: string) => viewerRef.current?.listModels(boxId) ?? null,
    []
  );

  const getBoxDimensions = useCallback(
    (boxId: string) => viewerRef.current?.getBoxDimensions(boxId) ?? null,
    []
  );

  const getModelPosition = useCallback(
    (boxId: string, modelId: string) =>
      viewerRef.current?.getModelPosition(boxId, modelId) ?? null,
    []
  );

  const getModelBoundingBoxSize = useCallback(
    (boxId: string, modelId: string) =>
      viewerRef.current?.getModelBoundingBoxSize(boxId, modelId) ?? null,
    []
  );

  const setModelPosition = useCallback(
    (boxId: string, modelId: string, position: { x: number; y: number; z: number }) =>
      viewerRef.current?.setModelPosition(boxId, modelId, position) ?? false,
    []
  );

  const setOnModelLoaded = useCallback(
    (callback: ((boxId: string, modelId: string, object: unknown) => void) | null) => {
      viewerRef.current?.setOnModelLoaded(callback ?? null);
    },
    []
  );

  const setOnBoxTransform = useCallback(
    (callback: ((boxId: string, position: { x: number; y: number; z: number }, rotationY: number) => void) | null) => {
      viewerRef.current?.setOnBoxTransform(callback ?? null);
    },
    []
  );

  const setTransformMode = useCallback((mode: "translate" | "rotate" | null) => {
    viewerRef.current?.setTransformMode(mode);
  }, []);

  const highlightBox = useCallback((id: string | null) => {
    viewerRef.current?.highlightBox(id);
  }, []);

  const selectBox = useCallback((id: string | null) => {
    viewerRef.current?.selectBox(id);
  }, []);

  return useMemo(
    () => ({
      viewerRef,
      viewerReady,
      selectedBoxId,
      onBoxSelected: setOnBoxSelected,
      setOnBoxSelected,
      selectBox,
      addBox,
      removeBox,
      updateBox,
      setBoxIndex,
      setBoxPosition,
      setBoxGap,
      addModelToBox,
      removeModelFromBox,
      clearModelsFromBox,
      listModels,
      getBoxDimensions,
      getModelPosition,
      getModelBoundingBoxSize,
      setModelPosition,
      setOnModelLoaded,
      setOnBoxTransform,
      setTransformMode,
      highlightBox,
    }),
    [
      viewerReady,
      selectedBoxId,
      setOnBoxSelected,
      selectBox,
      addBox,
      removeBox,
      updateBox,
      setBoxIndex,
      setBoxPosition,
      setBoxGap,
      addModelToBox,
      removeModelFromBox,
      clearModelsFromBox,
      listModels,
      getBoxDimensions,
      getModelPosition,
      getModelBoundingBoxSize,
      setModelPosition,
      setOnModelLoaded,
      setOnBoxTransform,
      setTransformMode,
      highlightBox,
    ]
  );
};
