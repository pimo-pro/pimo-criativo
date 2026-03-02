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
import { useWallStore, wallStore } from "../../../stores/wallStore";
import { useUiStore } from "../../../stores/uiStore";
import { clampOpeningNoOverlap } from "../../../utils/openingConstraints";
import { useGerarArquivoHandlers } from "../../../hooks/useGerarArquivoHandlers";
import GerarArquivoModal from "../right-panel/GerarArquivoModal";

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
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const { showToast, startLoading, stopLoading } = useToast();
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

  const [showGerarArquivoModal, setShowGerarArquivoModal] = useState(false);
  const gerarArquivoHandlers = useGerarArquivoHandlers();

  useEffect(() => {
    const handleOpenGerarArquivo = () => setShowGerarArquivoModal(true);
    window.addEventListener("pimo:open-gerar-arquivo-modal", handleOpenGerarArquivo);
    return () => window.removeEventListener("pimo:open-gerar-arquivo-modal", handleOpenGerarArquivo);
  }, []);

  // Registrar no PimoViewerContext apenas quando viewerApi muda (não quando viewerSync muda, para evitar loop ao rotacionar/atualizar projeto).
  useEffect(() => {
    registerViewerApi(viewerApi);
    return () => {
      registerViewerApi(null);
    };
  }, [registerViewerApi, viewerApi]);

  // Manter viewerSync com o adapter atual; roda quando viewerApi ou viewerSync mudam, sem chamar setState no contexto.
  useEffect(() => {
    const adapter = createViewerApiAdapter(viewerApi);
    viewerSync.registerViewerApi(adapter);
    return () => {
      viewerSync.registerViewerApi(null);
    };
  }, [viewerApi, viewerSync]);

  // Fluxo da sala é controlado exclusivamente pelo PainelSala (RoomManager).
  // Evita remoção/criação implícita da sala em mudanças de seleção do wallStore.

  // MultiBoxManager: sincroniza workspaceBoxes ↔ viewer; addBox/removeBox delegam a actions
  useMultiBoxManager({
    viewerApi,
    project,
    actions,
  });

  useEffect(() => {
    viewerApi.setOnBoxSelected((boxId) => {
      if (boxId) {
        if (project.selectedWorkspaceBoxId !== boxId) {
          actions.selectBox(boxId);
        }
        return;
      }
      if (project.selectedWorkspaceBoxId != null) {
        actions.clearSelection();
        clearUiSelection();
      }
    });
  }, [actions, viewerApi, clearUiSelection, project.selectedWorkspaceBoxId]);

  useEffect(() => {
    viewerApi.setOnDoorLayerDoubleClick((boxId, doorLayerId) => {
      const box = project.workspaceBoxes.find((workspaceBox) => workspaceBox.id === boxId);
      const door = box?.doorsLayer?.find((item) => item.id === doorLayerId);
      if (!box || !door) return;

      const nextIsOpen = !door.isOpen;
      if (project.selectedWorkspaceBoxId === boxId) {
        actions.setDoorLayerItemOpen(doorLayerId, nextIsOpen);
        return;
      }

      actions.selectBox(boxId);
      requestAnimationFrame(() => {
        actionsRef.current.setDoorLayerItemOpen(doorLayerId, nextIsOpen);
      });
    });
  }, [actions, project.workspaceBoxes, project.selectedWorkspaceBoxId, viewerApi]);

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
  }, [viewerApi, selectedObject]);

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
    } else {
      viewerApi.selectBox(null);
    }
  }, [project.selectedWorkspaceBoxId, viewerApi]);

  useEffect(() => {
    viewerApi.setOnBoxTransform((boxId, position, rotationY) => {
      actionsRef.current.updateWorkspaceBoxTransform(boxId, {
        x_mm: mToMm(position.x),
        y_mm: mToMm(position.y),
        z_mm: mToMm(position.z),
        rotacaoY_rad: rotationY,
        manualPosition: true,
      });
    });
  }, [viewerApi]);

  // Aplicar ferramenta 3D ativa ao Viewer (select/move/rotate). Só depender de activeViewerTool para não reaplicar a cada mudança de viewerSync (ex.: após rotacionar) e permitir que o gizmo desapareça ao clicar em "Selecionar".
  const viewerSyncRef = useRef(viewerSync);
  viewerSyncRef.current = viewerSync;
  useEffect(() => {
    const mode = project.activeViewerTool ?? "select";
    viewerSyncRef.current.setActiveTool(mode);
  }, [project.activeViewerTool]);

  const [lockEnabled, setLockEnabledState] = useState(false);
  const [mouseMenuPosition, setMouseMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const handleToolSelect = useCallback((toolId: string) => {
    if (toolId === "select" || toolId === "move" || toolId === "rotate") {
      actions.setActiveTool(toolId);
    }
  }, [actions]);
  const toggleLock = useCallback(() => {
    const next = !lockEnabled;
    setLockEnabledState(next);
    viewerSync.setLockEnabled(next);
    if (!next && project.selectedWorkspaceBoxId) {
      actions.updateWorkspaceBoxTransform(project.selectedWorkspaceBoxId, { manualPosition: true });
    }
  }, [lockEnabled, viewerSync, project.selectedWorkspaceBoxId, actions]);

const [selectedBoxDimensions, setSelectedBoxDimensions] = useState<{ width: number; height: number; depth: number } | null>(null);
  const [selectedBoxOverlayPosition, setSelectedBoxOverlayPosition] = useState<{ x: number; y: number } | null>(null);
  const isSelectMode = (project.activeViewerTool ?? "select") === "select";
  const hasShownViewerReadyToastRef = useRef(false);

  useEffect(() => {
    viewerSync.setDimensionsOverlayVisible(isSelectMode);
  }, [isSelectMode, viewerSync]);

  useEffect(() => {
    const settings = project.viewerSettings;
    viewerApi.setPanelEdgesVisible?.(settings.showPanelEdges);
    viewerApi.setAllPanelsHidden?.(settings.hideAllPanels);
    if (viewerApi.setHiddenPanels) {
      viewerApi.setHiddenPanels(settings.hiddenPanels);
    } else {
      const panels: Array<"left" | "right" | "top" | "bottom" | "back"> = ["left", "right", "top", "bottom", "back"];
      panels.forEach((panel) => {
        viewerApi.setPanelHidden?.(panel, settings.hiddenPanels.includes(panel));
      });
    }
    viewerApi.setRoomCeilingVisible?.(settings.showCeiling);
    viewerApi.setWallEditMode?.(settings.wallEditMode);
    viewerApi.setMousePreset?.(settings.mousePreset);
    viewerApi.setBackgroundMode?.(settings.backgroundMode);
    viewerApi.setMaterialQuality?.(settings.materialQuality);
    viewerApi.setReflectionsEnabled?.(settings.enableReflections);
    viewerApi.setPhotoModeEnabled?.(settings.photoModeEnabled);
    viewerApi.setExplodedViewEnabled?.(settings.explodedViewEnabled);
    viewerApi.setExplodedViewIntensity?.(settings.explodedViewIntensity);
    if (viewerApi.setUltraPerformanceModeOptions) {
      viewerApi.setUltraPerformanceModeOptions(settings.ultraPerformanceModeOptions);
    } else {
      viewerApi.setUltraPerformanceMode?.(settings.ultraPerformanceModeOptions.enabled);
    }
  }, [
    project.viewerSettings,
    viewerApi,
  ]);

// Overlay de dimensões: cache em refs para evitar loop (setState nos "last" recriava o callback e retriggava o useEffect).
  const lastBoxIdRef = useRef<string | null>(null);
  const lastDimensionsRef = useRef<{ width: number; height: number; depth: number } | null>(null);
  const lastOverlayPositionRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const updateOverlayPositionRef = useRef<() => void>(() => {});

  const updateOverlayPosition = useCallback(() => {
    if (!isSelectMode || !viewerSync) return;

    const currentBoxId = projectRef.current.selectedWorkspaceBoxId;
    const currentDimensions = viewerSync.getSelectedBoxDimensions();
    const currentOverlayPosition = viewerSync.getSelectedBoxScreenPosition();

    const lastBoxId = lastBoxIdRef.current;
    const lastDimensions = lastDimensionsRef.current;
    const lastOverlayPosition = lastOverlayPositionRef.current;

    const boxChanged = currentBoxId !== lastBoxId;
    const dimensionsChanged = currentDimensions?.width !== lastDimensions?.width ||
      currentDimensions?.height !== lastDimensions?.height ||
      currentDimensions?.depth !== lastDimensions?.depth;
    const positionChanged = currentOverlayPosition?.x !== lastOverlayPosition?.x ||
      currentOverlayPosition?.y !== lastOverlayPosition?.y;

    if (boxChanged || dimensionsChanged || positionChanged) {
      if (currentDimensions && currentOverlayPosition) {
        setSelectedBoxDimensions(currentDimensions);
        setSelectedBoxOverlayPosition(currentOverlayPosition);
      } else {
        setSelectedBoxDimensions(null);
        setSelectedBoxOverlayPosition(null);
      }
      lastBoxIdRef.current = currentBoxId;
      lastDimensionsRef.current = currentDimensions;
      lastOverlayPositionRef.current = currentOverlayPosition;

      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        updateOverlayPositionRef.current();
      });
    }
  }, [isSelectMode, viewerSync]);

  updateOverlayPositionRef.current = updateOverlayPosition;

  useEffect(() => {
    if (isSelectMode) {
      updateOverlayPosition();
    }
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isSelectMode, updateOverlayPosition]);

  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const workspacePositionKey = useMemo(
    () => JSON.stringify(project.workspaceBoxes.map((b) => [b.id, b.posicaoX_mm, b.posicaoY_mm, b.posicaoZ_mm])),
    [project.workspaceBoxes]
  );
  const prevBoxesRef = useRef<string>("");
  useEffect(() => {
    const key = workspacePositionKey;
    if (project.estaCarregando) {
      prevBoxesRef.current = key;
      return;
    }
    prevBoxesRef.current = key;
  }, [workspacePositionKey, project.estaCarregando]);

  useEffect(() => {
    if (viewerApi.viewerReady) {
      if (!hasShownViewerReadyToastRef.current) {
        hasShownViewerReadyToastRef.current = true;
        showToast("Viewer pronto.", "info", 1400);
      }
    } else {
      hasShownViewerReadyToastRef.current = false;
    }
  }, [viewerApi.viewerReady, showToast]);

  useEffect(() => {
    viewerApi.setOnModelLoaded((boxId, modelInstanceId, object) => {
      const loadingId = startLoading("A processar modelo no Viewer...");
      try {
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
          showToast("Modelo processado com sucesso.", "info", 1400);
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
        showToast("Modelo posicionado automaticamente.", "info", 1400);
      } catch {
        showToast("Falha ao processar o modelo carregado.", "error");
      } finally {
        stopLoading(loadingId);
      }
    });
    return () => viewerApi.setOnModelLoaded(null);
  }, [actions, viewerApi, startLoading, stopLoading, showToast]);

return (
    <>
    <main
      className="workspace-root"
      style={{ position: "relative", zIndex: 0 }}
      aria-label="Área de design 3D"
      onPointerDown={() => {
        if (mouseMenuPosition) setMouseMenuPosition(null);
      }}
    >
      <div className="workspace-canvas">
        <div className="workspace-toolbars" style={{ display: "flex", flexDirection: "column" }}>
          <ViewerToolbar />
          <Tools3DToolbar
            activeTool={project.activeViewerTool ?? "select"}
            onToolSelect={handleToolSelect}
            lockEnabled={lockEnabled}
            onToggleLock={toggleLock}
          />
        </div>
<div className="workspace-viewer" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            ref={containerRef}
            onContextMenu={(event) => {
              event.preventDefault();
              setMouseMenuPosition({ x: event.clientX, y: event.clientY });
            }}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              height: typeof viewerHeight === "number" ? `${viewerHeight}px` : "100%",
            }}
          />
          {!viewerApi.viewerReady && (
            <div className="workspace-loading-overlay" aria-live="polite">
              <span className="workspace-loading-spinner" aria-hidden="true" />
              <span>A carregar viewer 3D...</span>
            </div>
          )}
          {mouseMenuPosition && (
            <div
              role="menu"
              aria-label="Mouse settings"
              style={{
                position: "fixed",
                left: mouseMenuPosition.x,
                top: mouseMenuPosition.y,
                transform: "translate(8px, 8px)",
                minWidth: 160,
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: 8,
                zIndex: 60,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="button button-ghost"
                style={{ justifyContent: "flex-start", fontSize: 12 }}
                onClick={() => {
                  actions.setViewerSettings({ mousePreset: "cad" });
                  setMouseMenuPosition(null);
                }}
              >
                {project.viewerSettings.mousePreset === "cad" ? "✓ " : ""}Mouse CAD
              </button>
              <button
                type="button"
                className="button button-ghost"
                style={{ justifyContent: "flex-start", fontSize: 12 }}
                onClick={() => {
                  actions.setViewerSettings({ mousePreset: "classic" });
                  setMouseMenuPosition(null);
                }}
              >
                {project.viewerSettings.mousePreset === "classic" ? "✓ " : ""}Mouse Classic
              </button>
            </div>
          )}
        </div>
{isSelectMode && (selectedBoxDimensions || project.selectedWorkspaceBoxId) && selectedBoxOverlayPosition && (() => {
            const selectedBox = project.workspaceBoxes.find((b) => b.id === project.selectedWorkspaceBoxId);
            const rotacaoY_rad = selectedBox?.rotacaoY ?? 0;
            const rotacaoGraus = rotacaoY_rad * (180 / Math.PI);
const { x, y } = selectedBoxOverlayPosition;
            return (
<div
                className="dimensions-overlay"
                style={{
                  position: "absolute",
                  left: x,
                  top: y - 4,
                  transform: "translate(-50%, -115%)",
                  pointerEvents: "none",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.55)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--text-main, #f1f5f9)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  letterSpacing: "0.3px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  whiteSpace: "nowrap",
                  zIndex: 10,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                }}
              >
                <span>Rotação: {rotacaoGraus.toFixed(0)}°</span>
                {selectedBoxDimensions && (
                  <div style={{ display: "flex", gap: 12 }}>
                    <span>L {selectedBoxDimensions.width.toFixed(2)} m</span>
                    <span>A {selectedBoxDimensions.height.toFixed(2)} m</span>
                    <span>P {selectedBoxDimensions.depth.toFixed(2)} m</span>
                  </div>
                )}
              </div>
            );
          })()}
      </div>
    </main>
      {showGerarArquivoModal && (
        <GerarArquivoModal
          onClose={() => setShowGerarArquivoModal(false)}
          onConfirm={gerarArquivoHandlers.handleGerarArquivoConfirm}
          hasBoxes={gerarArquivoHandlers.hasBoxes}
          onPdfTecnico={gerarArquivoHandlers.onPdfTecnico}
          onCutlist={gerarArquivoHandlers.onCutlist}
          onAmbos={gerarArquivoHandlers.onAmbos}
          onLayoutCorte={gerarArquivoHandlers.onLayoutCorte}
          onEtiquetas={gerarArquivoHandlers.onEtiquetas}
          onExportarCnc={gerarArquivoHandlers.onExportarCnc}
        />
      )}
    </>
  );
}
