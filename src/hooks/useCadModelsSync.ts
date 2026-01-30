/**
 * Sincroniza os modelos GLB (box.models) do estado com o Viewer.
 * Só corre quando viewerReady === true; quando viewerReady passa a true, re-tenta o sync.
 */

import { useEffect, useRef } from "react";
import { getModelUrlFromStorage } from "../context/projectState";
import type { WorkspaceBox } from "../core/types";

type ViewerApi = {
  addModelToBox: (boxId: string, modelPath: string, modelId?: string) => boolean;
  removeModelFromBox: (boxId: string, modelId: string) => boolean;
  listModels: (boxId: string) => Array<{ id: string; path: string }> | null;
};

export function useCadModelsSync(
  workspaceBoxes: WorkspaceBox[],
  viewerApi: ViewerApi | null,
  /** Quando true, o viewer está montado e as caixas já existem. Só então carregamos modelos. */
  viewerReady?: boolean
): void {
  const prevBoxesRef = useRef<string>("");
  const prevViewerReadyRef = useRef<boolean | undefined>(false);

  useEffect(() => {
    if (!viewerApi || !workspaceBoxes?.length) return;
    if (viewerReady !== true) return;

    // Quando viewerReady passa a true, forçar re-sync (limpar cache para re-tentar carregar modelos)
    if (prevViewerReadyRef.current !== true) {
      prevBoxesRef.current = "";
      prevViewerReadyRef.current = true;
    }

    const boxesKey = workspaceBoxes.map((b) => `${b.id}:${(b.models ?? []).map((m) => m.id).join(",")}`).join("|");
    if (prevBoxesRef.current === boxesKey) return;
    prevBoxesRef.current = boxesKey;

    workspaceBoxes.forEach((box) => {
      const desiredIds = new Set((box.models ?? []).map((m) => m.id));
      const current = viewerApi.listModels(box.id) ?? [];
      const currentIds = new Set(current.map((c) => c.id));

      current.forEach(({ id }) => {
        if (!desiredIds.has(id)) {
          viewerApi.removeModelFromBox(box.id, id);
        }
      });

      (box.models ?? []).forEach((instance) => {
        if (currentIds.has(instance.id)) return;
        const url = getModelUrlFromStorage(instance.modelId);
        if (url) {
          viewerApi.addModelToBox(box.id, url, instance.id);
        }
      });
    });
  }, [workspaceBoxes, viewerApi, viewerReady]);
}
