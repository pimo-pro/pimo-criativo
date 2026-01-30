import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { extractPartsFromGLB } from "../../../core/glb";
import { glbPartsToCutListItems } from "../../../core/glb";
import { calcularPrecoCutList } from "../../../core/pricing/pricing";
import { useProject } from "../../../context/useProject";
import { usePimoViewer } from "../../../hooks/usePimoViewer";
import { useCalculadoraSync } from "../../../hooks/useCalculadoraSync";
import { useCadModelsSync } from "../../../hooks/useCadModelsSync";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import type { ViewerOptions } from "../../../3d/core/Viewer";
import {
  toPlacedModelMm,
  positionMmToLocalM,
  computeAutoPositionLocal,
} from "../../../core/layout/viewerLayoutAdapter";
import { mToMm } from "../../../utils/units";
import { getModelo } from "../../../core/cad/cadModels";

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
  const { project, actions } = useProject();
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
    return () => registerViewerApi(null);
  }, [registerViewerApi, viewerApi]);

  useEffect(() => {
    viewerApi.setOnBoxSelected((boxId) => {
      if (boxId) {
        actions.selectBox(boxId);
      }
    });
  }, [actions, viewerApi]);

  useCalculadoraSync(
    project.boxes,
    project.workspaceBoxes,
    viewerApi,
    0,
    project.material.tipo,
    viewerApi.viewerReady
  );
  useCadModelsSync(project.workspaceBoxes, viewerApi, viewerApi.viewerReady);

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

  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

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
      if (isCadOnlyBox) {
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
        <div className="workspace-viewer">
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: typeof viewerHeight === "number" ? `${viewerHeight}px` : viewerHeight,
            }}
          />
        </div>
      </div>
      <a
        href="/test-viewer"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 5,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          color: "#e2e8f0",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 12,
          textDecoration: "none",
        }}
      >
        Abrir test-viewer
      </a>
    </main>
  );
}
