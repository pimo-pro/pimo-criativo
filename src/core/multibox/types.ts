import type { WorkspaceBox } from "../types";
import type { BoxOptions } from "../../3d/objects/BoxBuilder";

/**
 * Interface do Viewer para operações multi-box.
 * O Viewer (3d/core/Viewer.ts) já implementa esta interface via usePimoViewer.
 */
export type MultiBoxViewerApi = {
  addBox: (_id: string, _options?: BoxOptions) => boolean;
  removeBox: (_id: string) => boolean;
  updateBox: (_id: string, _options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (_id: string, _index: number) => boolean;
  setBoxGap: (_gap: number) => void;
  addModelToBox: (_boxId: string, _modelPath: string, _modelId?: string) => boolean;
  removeModelFromBox: (_boxId: string, _modelId: string) => boolean;
  listModels: (_boxId: string) => Array<{ id: string; path: string }> | null;
  selectBox: (_id: string | null) => void;
  /** Quando true, o viewer está montado e pronto para receber caixas. */
  viewerReady?: boolean;
};

/**
 * Eventos emitidos pelo MultiBoxManager para o Viewer.
 */
export type MultiBoxEvent =
  | { type: "add"; boxId: string; options?: BoxOptions }
  | { type: "remove"; boxId: string }
  | { type: "update"; boxId: string; options: Partial<BoxOptions> }
  | { type: "select"; boxId: string | null };

/**
 * API exposta pelo MultiBoxManager para a UI e Workspace.
 */
export type MultiBoxManagerApi = {
  /** Adiciona uma nova caixa ao workspace (delega para ProjectContext.actions). */
  addBox: () => void;
  /** Remove caixa pelo ID. */
  removeBox: (_boxId: string) => void;
  /** Seleciona a caixa ativa. */
  selectBox: (_boxId: string) => void;
  /** Lista de caixas no workspace (source of truth: ProjectContext). */
  listBoxes: () => WorkspaceBox[];
  /** Indica se o viewer está pronto para receber operações. */
  viewerReady: boolean;
};
