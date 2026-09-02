/**
 * Ações de caixas do projeto (add, remove, update workspace, etc.).
 * Estrutura preparada para extração futura da lógica que permanece no ProjectProvider.
 * Por agora exporta um factory que recebe as dependências e devolve as actions de caixa.
 */

import type { ProjectActions } from "../projectTypes";
import type { MutableRefObject } from "react";

export type UseProjectBoxActionsDeps = {
  updateProject: (_updater: (_prev: import("../projectTypes").ProjectState) => import("../projectTypes").ProjectState, _trackHistory?: boolean) => void;
  recalcular: (_newState: Partial<import("../projectTypes").ProjectState>, _withLoading: boolean) => void;
  viewerSync: import("../projectTypes").ViewerSync;
  getNextWorkspaceBoxId: (_workspaceBoxes: import("../../core/types").WorkspaceBox[], _preferredIndex?: number) => { id: string; index: number };
  createWorkspaceBox: typeof import("../projectState").createWorkspaceBox;
};

/**
 * Retorna as actions relacionadas a caixas/workspace.
 * O ProjectProvider chama este factory com as suas dependências e usa o resultado em actions.
 */
export function useProjectBoxActions(
  _projectRef: MutableRefObject<import("../projectTypes").ProjectState>,
  _deps: UseProjectBoxActionsDeps
): Partial<ProjectActions> {
  return {};
}
