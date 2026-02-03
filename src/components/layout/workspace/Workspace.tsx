import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { extractPartsFromGLB } from "../../../core/glb";
import { glbPartsToCutListItems } from "../../../core/glb";
import { calcularPrecoCutList } from "../../../core/pricing/pricing";
import { useProject } from "../../../context/useProject";
import { useToast } from "../../../context/ToastContext";
import { usePimoViewer } from "../../../hooks/usePimoViewer";
import { createViewerApiAdapter } from "../../../core/viewer/viewerApiAdapter";
import { useMultiBoxManager } from "../../../core/multibox";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import ViewerToolbar from "../viewer-toolbar/ViewerToolbar";
import Tools3DToolbar from "../viewer-toolbar/Tools3DToolbar";
import type { ViewerOptions } from "../../../3d/core/Viewer";
import {
  toPlacedModelMm,
  positionMmToLocalM,
  computeAutoPositionLocal,
} from "../../../core/layout/viewerLayoutAdapter";
import { mToMm } from "../../../utils/units";
import { getModelo } from "../../../core/cad/cadModels";
import { validateProjectLight } from "../../../core/validation/validateProject";

type WorkspaceProps = {
  viewerBackground?: string;
  viewerHeight?: number | string;
  viewerOptions?: Omit<ViewerOptions, "background">;
};

export default function Workspace({
  viewerBackground,
  viewerHeight = "100%",
  viewerOptions,
}: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { project, actions, viewerSync } = useProject();
  const { showToast } = useToast();
  const viewerOptionsStable = useMemo(
    () => ({
      background: viewerBackground,
      ...viewerOptions,
      skipInitialBox: true as const,
    }),
    [viewerBackground, viewerOptions]
  );
  const viewerApi = usePimoViewer(containerRef, viewerOptionsStable);
  const { registerViewerApi } = usePimoViewerContext();

  useEffect(() => {
    registerViewerApi(viewerApi);
    const adapter = createViewerApiAdapter(viewerApi);
    viewerSync.registerViewerApi(adapter);
    return () => {
      registerViewerApi(null);
      viewerSync.registerViewerApi(null);
    };
  }, [registerViewerApi, viewerSync, viewerApi]);

  // MultiBoxManager: sincroniza workspaceBoxes ↔ viewer; addBox/removeBox delegam a actions
  useMultiBoxManager({
    viewerApi,
    project,
    actions,
  });

  useEffect(() => {
    viewerApi.setOnBoxSelected((boxId) => {
      if (boxId) {
        actions.selectBox(boxId);
      }
    });
  }, [actions, viewerApi]);

  useEffect(() => {
    if (project.selectedWorkspaceBoxId) {
      viewerApi.selectBox(project.selectedWorkspaceBoxId);
    }
  }, [project.selectedWorkspaceBoxId, viewerApi]);

  useEffect(() => {
    viewerApi.setOnBoxTransform((boxId, position, rotationY) => {
      actions.updateWorkspaceBoxTransform(boxId, {
        x_mm: mToMm(position.x),
        y_mm: mToMm(position.y),
        z_mm: mToMm(position.z),
        rotacaoY_rad: rotationY,
        manualPosition: true,
      });
    });
  }, [actions, viewerApi]);

  // Aplicar ferramenta 3D ativa ao Viewer (select/move/rotate) e reaplicar quando o adapter ou a ferramenta mudar
  useEffect(() => {
    const mode = project.activeViewerTool ?? "select";
    viewerSync.setActiveTool(mode);
  }, [project.activeViewerTool, viewerSync]);

  const [explodedView, setExplodedViewState] = useState(false);
  const toggleExplodedView = useCallback(() => {
    const next = !explodedView;
    setExplodedViewState(next);
    viewerSync.setExplodedView(next);
  }, [explodedView, viewerSync]);

  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const prevBoxesRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(
      project.workspaceBoxes.map((b) => [b.id, b.posicaoX_mm, b.posicaoY_mm, b.posicaoZ_mm])
    );
    if (prevBoxesRef.current && prevBoxesRef.current !== key) {
      const errors = validateProjectLight({
        workspaceBoxes: project.workspaceBoxes,
        boxes: project.boxes ?? [],
        roomConfig: null,
      });
      const msg = errors[0]?.message;
      if (msg) {
        if (errors.some((e) => e.type === "out_of_room")) showToast("Peça fora da sala", "error");
        else if (errors.some((e) => e.type === "collision")) showToast("Colisão detectada", "error");
        else if (errors.some((e) => e.type === "missing_ferragens")) showToast("Ferragens incompletas", "warning");
        else showToast(msg, "warning");
      }
    }
    prevBoxesRef.current = key;
  }, [project.workspaceBoxes, project.boxes, showToast]);

  useEffect(() => {
    viewerApi.setOnModelLoaded((boxId, modelInstanceId, object) => {
      const scene = object as THREE.Object3D;
      const parts = extractPartsFromGLB(scene);
      const materialTipo = projectRef.current.material.tipo;
      const espessura = projectRef.current.material.espessura;
      const items = glbPartsToCutListItems(parts, boxId, modelInstanceId, materialTipo, espessura);
      const withPreco = calcularPrecoCutList(items);
      actions.setExtractedPartsForBox(boxId, modelInstanceId, withPreco);

      const box = projectRef.current.workspaceBoxes.find((b) => b.id === boxId);
      const modelId = box?.models?.find((m) => m.id === modelInstanceId)?.modelId;
      const isCatalogModel = modelId?.startsWith("catalog:");
      scene.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const modelSizeMm = {
        largura: Math.max(1, mToMm(size.x)),
        altura: Math.max(1, mToMm(size.y)),
        profundidade: Math.max(1, mToMm(size.z)),
      };

      // Caixa CAD-only: dimensões vêm do GLB; atualizar estado para cut list, lista de caixas e reflow
      const isCadOnlyBox =
        box && (box.models?.length ?? 0) > 0 && box.prateleiras === 0 && box.gavetas === 0;
      if (isCadOnlyBox && !isCatalogModel) {
        actions.setWorkspaceBoxDimensoes(boxId, modelSizeMm);
        if (modelId) {
          const cadModel = getModelo(modelId);
          if (cadModel?.nome) actions.setWorkspaceBoxNome(boxId, cadModel.nome);
        }
        return;
      }

      const boxDims = viewerApi.getBoxDimensions(boxId);
      if (!boxDims || !modelId) return;

      const list = viewerApi.listModels(boxId) ?? [];
      const placedModels = list
        .filter((m) => m.id !== modelInstanceId)
        .map((m) => {
          const pos = viewerApi.getModelPosition(boxId, m.id);
          const sz = viewerApi.getModelBoundingBoxSize(boxId, m.id);
          const otherModelId = box?.models?.find((x) => x.id === m.id)?.modelId ?? m.id;
          if (!pos || !sz) return null;
          return toPlacedModelMm(m.id, otherModelId, pos, sz, boxDims);
        })
        .filter(Boolean) as ReturnType<typeof toPlacedModelMm>[];

      const result = computeAutoPositionLocal(
        boxDims,
        placedModels,
        modelId,
        modelSizeMm,
        modelInstanceId
      );
      const positionLocal = positionMmToLocalM(result.positionMm, boxDims);
      viewerApi.setModelPosition(boxId, modelInstanceId, positionLocal);
      actions.setModelPositionInBox(boxId, modelInstanceId, positionLocal);
    });
    return () => viewerApi.setOnModelLoaded(null);
  }, [actions, viewerApi]);

  return (
    <main className="workspace-root">
      <div className="workspace-canvas">
        <div className="workspace-toolbars" style={{ display: "flex", flexDirection: "column" }}>
          <ViewerToolbar />
          <Tools3DToolbar
            activeTool={project.activeViewerTool ?? "select"}
            onToolSelect={(toolId) => {
              if (toolId === "select" || toolId === "move" || toolId === "rotate") {
                actions.setActiveTool(toolId);
              }
            }}
            explodedView={explodedView}
            onToggleExplodedView={toggleExplodedView}
          />
        </div>
        <div className="workspace-viewer" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div
            ref={containerRef}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              height: typeof viewerHeight === "number" ? `${viewerHeight}px` : "100%",
            }}
          />
        </div>
      </div>
    </main>
  );
}
