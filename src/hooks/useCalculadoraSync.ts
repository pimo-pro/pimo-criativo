import { useCallback, useEffect, useRef } from "react";
import type { BoxModule, WorkspaceBox } from "../core/types";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import { mmToM } from "../utils/units";
import { getViewerMaterialId } from "../core/materials/service";

type ViewerApi = {
  addBox: (_id: string, _options?: BoxOptions) => boolean;
  removeBox: (_id: string) => boolean;
  updateBox: (_id: string, _options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (_id: string, _index: number) => boolean;
  setBoxGap: (_gap: number) => void;
};

type BoxState = { index: number };

/** Posição EXCLUSIVAMENTE do projeto. manualPosition === true: X = rightmost+100mm, Y = altura/2, Z = 0 (definidos no ProjectProvider). */
function getBoxPositionAndRotation(workspaceBox: WorkspaceBox | undefined): Partial<BoxOptions> {
  if (!workspaceBox) return {};
  const opts: Partial<BoxOptions> = {};
  if (workspaceBox.manualPosition === true) {
    const x = mmToM(workspaceBox.posicaoX_mm ?? 0);
    const z = mmToM(workspaceBox.posicaoZ_mm ?? 0);
    const alturaMm = workspaceBox.dimensoes?.altura ?? 0;
    const yMm = (workspaceBox.posicaoY_mm != null && workspaceBox.posicaoY_mm > 0) ? workspaceBox.posicaoY_mm : alturaMm / 2;
    const y = mmToM(yMm);
    opts.position = { x, y, z };
    if (workspaceBox.rotacaoY != null && Number.isFinite(workspaceBox.rotacaoY)) {
      opts.rotationY = workspaceBox.rotacaoY;
    }
    if (workspaceBox.costaRotationY != null && Number.isFinite(workspaceBox.costaRotationY)) {
      opts.costaRotationY = workspaceBox.costaRotationY;
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
  viewerReady?: boolean,
  /** Id do material do projeto (CRUD); usado quando a caixa não tem material próprio. */
  projectMaterialId?: string
) => {
  const boxesRef = useRef<BoxModule[]>(boxes);
  const workspaceBoxesRef = useRef<WorkspaceBox[]>(workspaceBoxes);
  const viewerApiRef = useRef(viewerApi);
  const projectMaterialIdRef = useRef<string | undefined>(projectMaterialId);
  const stateRef = useRef<Map<string, BoxState>>(new Map());
  const prevViewerReadyRef = useRef<boolean | undefined>(false);

  useEffect(() => {
    projectMaterialIdRef.current = projectMaterialId;
  }, [projectMaterialId]);

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
      const effectiveMaterial =
        box.material ??
        projectMaterialIdRef.current ??
        materialName ??
        "MDF Branco";
      const resolvedMaterialName = getViewerMaterialId(effectiveMaterial);
      const cadOnly =
        (box.models?.length ?? 0) > 0 && box.prateleiras === 0 && box.gavetas === 0;

      const shelves = Number.isFinite(box.prateleiras) ? Math.max(0, box.prateleiras) : undefined;
      const cabinetType = wsBox?.cabinetType === "lower" || wsBox?.cabinetType === "upper" ? wsBox.cabinetType : undefined;
      const pe_cm = wsBox?.pe_cm;
      const feetEnabled = wsBox?.feetEnabled ?? true;
      const autoRotateEnabled = wsBox?.autoRotateEnabled;
      const useCabinetLock = cabinetType === "lower" && feetEnabled;
      const cabinetOpts: Partial<BoxOptions> = useCabinetLock
        ? { cabinetType, pe_cm, feetEnabled }
        : { cabinetType: null, feetEnabled };
      const rotateOpts = autoRotateEnabled === false ? { autoRotateEnabled: false } : {};
      if (!stateRef.current.has(box.id)) {
        api.addBox(box.id, {
          width,
          height,
          depth,
          thickness,
          shelves,
          materialName: resolvedMaterialName,
          index,
          cadOnly,
          ...cabinetOpts,
          ...rotateOpts,
          ...posRot,
        });
      } else {
        api.updateBox(box.id, {
          width,
          height,
          depth,
          thickness,
          shelves,
          materialName: resolvedMaterialName,
          index,
          ...cabinetOpts,
          ...rotateOpts,
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
  }, [materialName, projectMaterialId]);

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
