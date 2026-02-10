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
import { getRoomDimensionsCm, useWallStore, wallStore } from "../../../stores/wallStore";
import { useUiStore } from "../../../stores/uiStore";
import { clampOpeningNoOverlap } from "../../../utils/openingConstraints";

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
  const isRoomOpen = useWallStore((state) => state.isOpen);
  const walls = useWallStore((state) => state.walls);
  const selectedWallId = useWallStore((state) => state.selectedWallId);
  const selectedObject = useUiStore((state) => state.selectedObject);
  const setSelectedObject = useUiStore((state) => state.setSelectedObject);
  const clearUiSelection = useUiStore((state) => state.clearSelection);
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);

  useEffect(() => {
    registerViewerApi(viewerApi);
    const adapter = createViewerApiAdapter(viewerApi);
    viewerSync.registerViewerApi(adapter);
    return () => {
      registerViewerApi(null);
      viewerSync.registerViewerApi(null);
    };
  }, [registerViewerApi, viewerSync, viewerApi]);

  // Definir bounds antes de criar sala e antes de qualquer sync/snap/rotação.
  useEffect(() => {
    if (!viewerApi?.setRoomBounds || !viewerApi?.clearRoomBounds) return;
    if (!isRoomOpen) {
      viewerApi.clearRoomBounds();
      return;
    }
    const dims = getRoomDimensionsCm(walls);
    if (!dims) {
      viewerApi.clearRoomBounds();
      return;
    }
    const widthM = dims.widthCm / 100;
    const depthM = dims.depthCm / 100;
    const heightM = dims.heightCm / 100;
    viewerApi.setRoomBounds({
      width: widthM,
      depth: depthM,
      height: heightM,
      originX: 0,
      originZ: 0,
    });
  }, [viewerApi, isRoomOpen, walls]);

  useEffect(() => {
    if (!viewerApi?.createRoom || !viewerApi?.removeRoom) return;
    if (!isRoomOpen) {
      viewerApi.removeRoom();
      return;
    }
    const limitedWalls = walls.slice(0, 4);
    if (limitedWalls.length === 0) return;

    const numWalls = Math.min(4, Math.max(3, limitedWalls.length)) as 3 | 4;
    const roomWalls = limitedWalls.map((wall) => {
      const pos = wall.position ?? { x: 0, z: 0 };
      const rot = typeof wall.rotation === "number" ? wall.rotation : 0;
      const lengthMm = Math.max(10, wall.lengthCm * 10);
      const heightMm = Math.max(10, wall.heightCm * 10);
      const thicknessMm = Math.max(10, wall.thicknessCm * 10);
      const openings = (wall.openings ?? []).map((o) => ({
        id: o.id,
        type: o.type,
        widthMm: o.widthMm ?? 900,
        heightMm: o.heightMm ?? 2100,
        floorOffsetMm: o.floorOffsetMm ?? 0,
        horizontalOffsetMm: o.horizontalOffsetMm ?? 0,
        modelId: o.modelId,
      }));
      return {
        id: wall.id,
        position: { x: pos.x / 100, z: pos.z / 100 },
        rotation: rot,
        lengthMm,
        heightMm,
        thicknessMm,
        color: wall.color,
        openings,
      };
    });

    viewerApi.createRoom({
      numWalls,
      walls: roomWalls,
      selectedWallId: selectedWallId ?? null,
    });
  }, [viewerApi, isRoomOpen, walls, selectedWallId]);

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
        setSelectedTool("home");
        setSelectedObject({ type: "box", id: boxId });
        return;
      }
      actions.clearSelection();
      clearUiSelection();
    });
  }, [actions, viewerApi, clearUiSelection, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    viewerApi.setOnWallSelected?.((wallIndex) => {
      if (wallIndex == null) {
        wallStore.getState().selectWall(null);
        return;
      }
      const wall = walls[wallIndex];
      if (!wall) return;
      actions.clearSelection();
      wallStore.getState().setOpen(true);
      wallStore.getState().selectWall(wall.id);
      setSelectedTool("layout");
      setSelectedObject({ type: "wall", id: wall.id });
    });
  }, [actions, viewerApi, walls, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    if (!isRoomOpen || !viewerApi.selectWallByIndex) return;
    const index = selectedWallId ? walls.findIndex((w) => w.id === selectedWallId) : -1;
    viewerApi.selectWallByIndex(index >= 0 ? index : null);
  }, [viewerApi, isRoomOpen, selectedWallId, walls]);

  useEffect(() => {
    if (selectedObject?.type === "roomElement" && selectedObject?.id) {
      viewerApi.selectRoomElementById?.(selectedObject.id);
    }
  }, [viewerApi, selectedObject?.type, selectedObject?.id]);

  useEffect(() => {
    viewerApi.setOnWallTransform?.((wallIndex, position, rotation) => {
      const wall = walls[wallIndex];
      if (!wall) return;
      wallStore.getState().updateWall(wall.id, {
        position: { x: position.x * 100, z: position.z * 100 },
        rotation,
      });
    });
  }, [viewerApi, walls]);

  useEffect(() => {
    viewerApi.setOnRoomElementSelected?.((roomElement) => {
      if (roomElement == null) {
        clearUiSelection();
        return;
      }
      actions.clearSelection();
      const wall = walls[roomElement.wallId];
      if (wall) {
        wallStore.getState().setOpen(true);
        wallStore.getState().selectWall(wall.id);
      }
      setSelectedTool("layout");
      setSelectedObject({ type: "roomElement", id: roomElement.elementId });
    });
  }, [actions, viewerApi, walls, clearUiSelection, setSelectedObject, setSelectedTool]);

  useEffect(() => {
    viewerApi.setOnRoomElementTransform?.((elementId, config) => {
      const wall = walls.find((w) => (w.openings ?? []).some((o) => o.id === elementId));
      if (!wall) return;
      const wallLengthMm = wall.lengthCm * 10;
      const wallHeightMm = wall.heightCm * 10;
      const { horizontalOffsetMm, floorOffsetMm } = clampOpeningNoOverlap(
        config,
        elementId,
        wall.openings ?? [],
        wallLengthMm,
        wallHeightMm
      );
      const finalConfig = {
        ...config,
        horizontalOffsetMm,
        floorOffsetMm,
      };
      wallStore.getState().updateWall(wall.id, {
        openings: (wall.openings ?? []).map((o) =>
          o.id === elementId
            ? {
                ...o,
                widthMm: finalConfig.widthMm,
                heightMm: finalConfig.heightMm,
                floorOffsetMm: finalConfig.floorOffsetMm,
                horizontalOffsetMm: finalConfig.horizontalOffsetMm,
              }
            : o
        ),
      });
      viewerApi.updateRoomElementConfig?.(elementId, finalConfig);
    });
  }, [viewerApi, walls]);

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

  const [lockEnabled, setLockEnabledState] = useState(false);
  const toggleLock = useCallback(() => {
    const next = !lockEnabled;
    setLockEnabledState(next);
    viewerSync.setLockEnabled(next);
    if (!next && project.selectedWorkspaceBoxId) {
      actions.updateWorkspaceBoxTransform(project.selectedWorkspaceBoxId, { manualPosition: true });
    }
  }, [lockEnabled, viewerSync, project.selectedWorkspaceBoxId, actions]);

  const [selectedBoxDimensions, setSelectedBoxDimensions] = useState<{ width: number; height: number; depth: number } | null>(null);
  const isSelectMode = (project.activeViewerTool ?? "select") === "select";

  useEffect(() => {
    viewerSync.setDimensionsOverlayVisible(isSelectMode);
  }, [isSelectMode, viewerSync]);

  useEffect(() => {
    if (!isSelectMode) {
      setSelectedBoxDimensions(null);
      return;
    }
    const t = setInterval(() => {
      const dims = viewerSync.getSelectedBoxDimensions();
      setSelectedBoxDimensions(dims ?? null);
    }, 150);
    return () => clearInterval(t);
  }, [isSelectMode, viewerSync]);

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
            lockEnabled={lockEnabled}
            onToggleLock={toggleLock}
          />
        </div>
        <div className="workspace-viewer" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            ref={containerRef}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              height: typeof viewerHeight === "number" ? `${viewerHeight}px` : "100%",
            }}
          />
          {isSelectMode && selectedBoxDimensions && (
            <div
              className="dimensions-overlay"
              style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                padding: "6px 10px",
                background: "rgba(15, 23, 42, 0.85)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--text-main, #f1f5f9)",
                fontFamily: "var(--font-sans)",
                display: "flex",
                gap: 12,
                pointerEvents: "none",
              }}
            >
              <span>L {selectedBoxDimensions.width.toFixed(2)} m</span>
              <span>A {selectedBoxDimensions.height.toFixed(2)} m</span>
              <span>P {selectedBoxDimensions.depth.toFixed(2)} m</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
