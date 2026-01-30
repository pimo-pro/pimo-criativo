import { useCallback, useEffect, useRef } from "react";
import type { BoxModule, WorkspaceBox } from "../core/types";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import { mmToM } from "../utils/units";

type ViewerApi = {
  addBox: (id: string, options?: BoxOptions) => boolean;
  removeBox: (id: string) => boolean;
  updateBox: (id: string, options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (id: string, index: number) => boolean;
  setBoxGap: (gap: number) => void;
};

type BoxState = { index: number };

/** Só passa position/rotation quando manualPosition === true (paramétricas e CAD-only). Caso contrário o Viewer aplica reflow e Y base no chão. */
function getBoxPositionAndRotation(workspaceBox: WorkspaceBox | undefined): Partial<BoxOptions> {
  if (!workspaceBox) return {};
  const opts: Partial<BoxOptions> = {};
  if (workspaceBox.manualPosition === true) {
    const x = workspaceBox.posicaoX_mm != null ? mmToM(workspaceBox.posicaoX_mm) : undefined;
    const y = workspaceBox.posicaoY_mm != null ? mmToM(workspaceBox.posicaoY_mm) : undefined;
    const z = workspaceBox.posicaoZ_mm != null ? mmToM(workspaceBox.posicaoZ_mm ?? 0) : undefined;
    if (x !== undefined && y !== undefined && z !== undefined) {
      opts.position = { x, y, z };
    }
    if (workspaceBox.rotacaoY != null && Number.isFinite(workspaceBox.rotacaoY)) {
      opts.rotationY = workspaceBox.rotacaoY;
    }
  }
  if (workspaceBox.manualPosition !== undefined) {
    opts.manualPosition = workspaceBox.manualPosition;
  }
  return opts;
}

export const useCalculadoraSync = (
  boxes: BoxModule[],
  workspaceBoxes: WorkspaceBox[],
  viewerApi: ViewerApi,
  gap?: number,
  materialName?: string,
  /** Quando true, o viewer está montado e pronto para receber caixas. */
  viewerReady?: boolean
) => {
  const boxesRef = useRef<BoxModule[]>(boxes);
  const workspaceBoxesRef = useRef<WorkspaceBox[]>(workspaceBoxes);
  const viewerApiRef = useRef(viewerApi);
  const stateRef = useRef<Map<string, BoxState>>(new Map());
  const prevViewerReadyRef = useRef<boolean | undefined>(false);

  useEffect(() => {
    viewerApiRef.current = viewerApi;
  }, [viewerApi]);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    workspaceBoxesRef.current = workspaceBoxes;
  }, [workspaceBoxes]);

  const syncFromCalculator = useCallback(() => {
    const api = viewerApiRef.current;
    if (!api) return;
    const currentBoxes = boxesRef.current ?? [];
    const wsBoxes = workspaceBoxesRef.current ?? [];
    const nextState = new Map<string, BoxState>();
    const currentIds = new Set<string>();

    currentBoxes.forEach((box, arrayIndex) => {
      currentIds.add(box.id);
      const wsIndex = wsBoxes.findIndex((w) => w.id === box.id);
      const index = wsIndex >= 0 ? wsIndex : arrayIndex;
      nextState.set(box.id, { index });
      const wsBox = wsBoxes.find((w) => w.id === box.id);
      const posRot = getBoxPositionAndRotation(wsBox);

      const widthMm = Number.isFinite(box.dimensoes?.largura) ? box.dimensoes.largura : undefined;
      const heightMm = Number.isFinite(box.dimensoes?.altura) ? box.dimensoes.altura : undefined;
      const depthMm = Number.isFinite(box.dimensoes?.profundidade)
        ? box.dimensoes.profundidade
        : undefined;
      const width = widthMm !== undefined ? mmToM(widthMm) : undefined;
      const height = heightMm !== undefined ? mmToM(heightMm) : undefined;
      const depth = depthMm !== undefined ? mmToM(depthMm) : undefined;
      const thicknessMm = Number.isFinite(box.espessura) ? box.espessura : undefined;
      const thickness = thicknessMm !== undefined ? mmToM(thicknessMm) : undefined;
      const resolvedMaterialName = box.material ?? materialName ?? "mdf";
      const cadOnly =
        (box.models?.length ?? 0) > 0 && box.prateleiras === 0 && box.gavetas === 0;

      if (!stateRef.current.has(box.id)) {
        api.addBox(box.id, {
          width,
          height,
          depth,
          thickness,
          materialName: resolvedMaterialName,
          index,
          cadOnly,
          ...posRot,
        });
      } else {
        api.updateBox(box.id, {
          width,
          height,
          depth,
          thickness,
          materialName: resolvedMaterialName,
          index,
          ...posRot,
        });
      }
    });

    Array.from(stateRef.current.keys()).forEach((id) => {
      if (!currentIds.has(id)) {
        api.removeBox(id);
      }
    });

    stateRef.current = nextState;
  }, [materialName]);

  useEffect(() => {
    // Só sincronizar quando o viewer estiver explicitamente pronto
    if (viewerReady !== true) return;
    // Ao passar a true, limpar estado para forçar addBox em todas as caixas (viewer pode ter sido recriado)
    if (prevViewerReadyRef.current !== true) {
      stateRef.current = new Map();
      prevViewerReadyRef.current = true;
    }
    syncFromCalculator();
  }, [boxes, workspaceBoxes, syncFromCalculator, viewerReady]);

  useEffect(() => {
    const api = viewerApiRef.current;
    if (gap !== undefined && Number.isFinite(gap) && api) {
      api.setBoxGap(gap);
    }
  }, [gap]);

  return { syncFromCalculator };
};
