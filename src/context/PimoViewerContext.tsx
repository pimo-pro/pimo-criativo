import { createContext, useCallback, useMemo, useState } from "react";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import type { Viewer } from "../3d/core/Viewer";

export type PimoViewerApi = {
  viewerRef: React.MutableRefObject<Viewer | null>;
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
  setOnBoxSelected: (callback: (id: string | null) => void) => void;
  selectBox?: (id: string | null) => void;
};

export type PimoViewerContextValue = {
  viewerApi: PimoViewerApi | null;
  registerViewerApi: (api: PimoViewerApi | null) => void;
};

export const PimoViewerContext = createContext<PimoViewerContextValue | null>(null);

export const PimoViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewerApi, setViewerApi] = useState<PimoViewerApi | null>(null);

  const registerViewerApi = useCallback((api: PimoViewerApi | null) => {
    setViewerApi(api);
  }, []);

  const value = useMemo(() => ({ viewerApi, registerViewerApi }), [viewerApi, registerViewerApi]);

  return <PimoViewerContext.Provider value={value}>{children}</PimoViewerContext.Provider>;
};
