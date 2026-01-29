import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "../3d/core/Viewer";
import type { ViewerOptions } from "../3d/core/Viewer";
import type { BoxOptions } from "../3d/objects/BoxBuilder";

type PimoViewerAPI = {
  viewerRef: React.MutableRefObject<Viewer | null>;
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
};

export const usePimoViewer = (
  containerRef: RefObject<HTMLDivElement | null>,
  options?: ViewerOptions
): PimoViewerAPI => {
  const viewerRef = useRef<Viewer | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const onBoxSelectedRef = useRef<((id: string | null) => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Se já existe um viewer, apenas atualiza as opções
    if (viewerRef.current) {
      // Atualizar opções do viewer existente se necessário
      // (neste caso, vamos manter o viewer existente e não recriar)
      return;
    }

    viewerRef.current = new Viewer(container, options);
    viewerRef.current.setOnBoxSelected((id) => {
      setSelectedBoxId(id);
      onBoxSelectedRef.current?.(id);
    });

    return () => {
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [containerRef, options]);

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

  const selectBox = useCallback((id: string | null) => {
    viewerRef.current?.selectBox(id);
  }, []);

  return useMemo(
    () => ({
      viewerRef,
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
    }),
    [
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
    ]
  );
};
