import { useCallback, useEffect, useRef } from "react";
import type { BoxModule } from "../core/types";
import type { BoxOptions } from "../3d/objects/BoxBuilder";

type ViewerApi = {
  addBox: (id: string, options?: BoxOptions) => boolean;
  removeBox: (id: string) => boolean;
  updateBox: (id: string, options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (id: string, index: number) => boolean;
  setBoxGap: (gap: number) => void;
};

type BoxState = { index: number };

export const useCalculadoraSync = (
  boxes: BoxModule[],
  viewerApi: ViewerApi,
  gap?: number,
  materialName?: string
) => {
  const boxesRef = useRef<BoxModule[]>(boxes);
  const stateRef = useRef<Map<string, BoxState>>(new Map());

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  const syncFromCalculator = useCallback(() => {
    const currentBoxes = boxesRef.current ?? [];
    const nextState = new Map<string, BoxState>();
    const currentIds = new Set<string>();

    currentBoxes.forEach((box, index) => {
      currentIds.add(box.id);
      nextState.set(box.id, { index });

      const width = Number.isFinite(box.dimensoes?.largura) ? box.dimensoes.largura : undefined;
      const height = Number.isFinite(box.dimensoes?.altura) ? box.dimensoes.altura : undefined;
      const depth = Number.isFinite(box.dimensoes?.profundidade)
        ? box.dimensoes.profundidade
        : undefined;
      const resolvedMaterialName = box.material ?? materialName;

      if (!stateRef.current.has(box.id)) {
        viewerApi.addBox(box.id, { width, height, depth, materialName: resolvedMaterialName, index });
      } else {
        viewerApi.updateBox(box.id, { width, height, depth, materialName: resolvedMaterialName });
        const prevIndex = stateRef.current.get(box.id)?.index;
        if (prevIndex !== undefined && prevIndex !== index) {
          viewerApi.setBoxIndex(box.id, index);
        }
      }
    });

    Array.from(stateRef.current.keys()).forEach((id) => {
      if (!currentIds.has(id)) {
        viewerApi.removeBox(id);
      }
    });

    stateRef.current = nextState;
  }, [viewerApi]);

  useEffect(() => {
    syncFromCalculator();
  }, [boxes, syncFromCalculator]);

  useEffect(() => {
    if (gap !== undefined && Number.isFinite(gap)) {
      viewerApi.setBoxGap(gap);
    }
  }, [gap, viewerApi]);

  return { syncFromCalculator };
};
