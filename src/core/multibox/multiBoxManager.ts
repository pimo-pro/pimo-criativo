/**
 * MultiBoxManager — orquestra a sincronização entre ProjectContext e Viewer 3D.
 *
 * Responsabilidades:
 * - Armazenar/obter lista de boxes (via ProjectContext.workspaceBoxes)
 * - Emitir operações para o viewer (addBox, updateBox, removeBox) via useCalculadoraSync e useCadModelsSync
 * - Sincronizar com o ProjectContext
 *
 * Fluxo: ProjectContext.workspaceBoxes → [sync] → Viewer
 *        UI.addBox/removeBox → ProjectContext.actions → [sync] → Viewer
 *
 * TODO: Expor manager via MultiBoxManagerContext para UI usar manager.addBox em vez de actions.addWorkspaceBox
 * TODO: Suportar gap configurável (atualmente fixo em 0)
 */

import { useCallback } from "react";
import { useCalculadoraSync } from "../../hooks/useCalculadoraSync";
import { useCadModelsSync } from "../../hooks/useCadModelsSync";
import type { ProjectActions, ProjectState } from "../../context/projectTypes";
import type { MultiBoxManagerApi, MultiBoxViewerApi } from "./types";

export type UseMultiBoxManagerParams = {
  viewerApi: MultiBoxViewerApi | null;
  project: ProjectState;
  actions: ProjectActions;
};

/**
 * Hook que inicializa o MultiBoxManager e conecta ao Viewer e ProjectContext.
 *
 * - Sincroniza workspaceBoxes → viewer (boxes + modelos GLB)
 * - Expõe addBox, removeBox, selectBox, listBoxes para a UI
 *
 * @example
 * const manager = useMultiBoxManager({ viewerApi, project, actions });
 * // UI: onClick={() => manager.addBox()}
 */
const NOOP_VIEWER_API: MultiBoxViewerApi = {
  addBox: () => false,
  removeBox: () => false,
  updateBox: () => false,
  setBoxIndex: () => false,
  setBoxGap: () => {},
  addModelToBox: () => false,
  removeModelFromBox: () => false,
  listModels: () => null,
  selectBox: () => {},
};

export function useMultiBoxManager({
  viewerApi,
  project,
  actions,
}: UseMultiBoxManagerParams): MultiBoxManagerApi {
  const viewerReady = Boolean(viewerApi && (viewerApi as MultiBoxViewerApi).viewerReady);
  const gap = 0;
  const api = viewerApi ?? NOOP_VIEWER_API;

  useCalculadoraSync(
    project.boxes,
    project.workspaceBoxes,
    api,
    gap,
    project.material.tipo,
    viewerReady
  );

  useCadModelsSync(
    project.workspaceBoxes,
    viewerApi,
    viewerReady
  );

  const addBox = useCallback(() => {
    actions.addWorkspaceBox();
  }, [actions]);

  const removeBox = useCallback(
    (boxId: string) => {
      actions.removeWorkspaceBoxById(boxId);
    },
    [actions]
  );

  const selectBox = useCallback(
    (boxId: string) => {
      actions.selectBox(boxId);
    },
    [actions]
  );

  const listBoxes = useCallback(() => {
    return project.workspaceBoxes ?? [];
  }, [project.workspaceBoxes]);

  return {
    addBox,
    removeBox,
    selectBox,
    listBoxes,
    viewerReady,
  };
}
