import { createContext } from "react";
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
  getBoxDimensions: (boxId: string) => { width: number; height: number; depth: number } | null;
  getModelPosition: (boxId: string, modelId: string) => { x: number; y: number; z: number } | null;
  getModelBoundingBoxSize: (boxId: string, modelId: string) => { width: number; height: number; depth: number } | null;
  setModelPosition: (boxId: string, modelId: string, position: { x: number; y: number; z: number }) => boolean;
  setOnBoxSelected: (callback: (id: string | null) => void) => void;
  setOnModelLoaded: (callback: ((boxId: string, modelId: string, object: unknown) => void) | null) => void;
  setOnBoxTransform: (callback: ((boxId: string, position: { x: number; y: number; z: number }, rotationY: number) => void) | null) => void;
  setTransformMode: (mode: "translate" | "rotate" | null) => void;
  selectBox?: (id: string | null) => void;
  highlightBox?: (id: string | null) => void;
};

export type PimoViewerContextValue = {
  viewerApi: PimoViewerApi | null;
  registerViewerApi: (api: PimoViewerApi | null) => void;
};

export const PimoViewerContext = createContext<PimoViewerContextValue | null>(null);
