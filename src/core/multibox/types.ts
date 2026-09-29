import type { WorkspaceBox } from "../types";
import type { BoxOptions } from "../../3d/objects/BoxBuilder";
import type { PimoViewerApi } from "../../context/PimoViewerContextCore";

/**
 * Interface do Viewer para operações multi-box.
 * Subconjunto derivado do contrato canónico PimoViewerApi.
 */
export type MultiBoxViewerApi = Pick<
  PimoViewerApi,
  | "addBox"
  | "removeBox"
  | "updateBox"
  | "setBoxIndex"
  | "setBoxGap"
  | "addModelToBox"
  | "removeModelFromBox"
  | "listModels"
  | "viewerReady"
> & {
  setBoxSpacing?: (_spacing: number) => void;
  updateBoxSpacing?: (_spacing: number) => void;
  selectBox: NonNullable<PimoViewerApi["selectBox"]>;
};

/** Superfície mínima consumida pelo sincronizador de caixas paramétricas. */
export type CalculadoraViewerApi = Pick<
  MultiBoxViewerApi,
  "addBox" | "removeBox" | "updateBox" | "setBoxIndex" | "setBoxGap"
> &
  Pick<PimoViewerApi, "updateDrawerMaterial">;

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
