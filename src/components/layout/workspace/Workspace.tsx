import { useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "../../../context/useProject";
import { Cube } from "../../ui/Cube";
import { CUBE_BASE_SIZE, updateCubePreview } from "../../ui/cubeUtils";
import ThreeViewer from "../../three/ThreeViewer";
import WorkspaceBottomPanel from "./WorkspaceBottomPanel";
import { useMaterial } from "../../../context/useMaterial";

export default function Workspace() {
  const { project, actions, viewerSync } = useProject();
  const { state: materialState } = useMaterial();
  const [rotation, setRotation] = useState({ x: 20, y: -30 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isUserControlling, setIsUserControlling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);
  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const wireframeMode = false;
  const cameraPreset: "perspective" | "top" | "front" | "left" = "perspective";
  const dragRef = useRef<{ x: number; y: number; active: boolean; button: number }>({
    x: 0,
    y: 0,
    active: false,
    button: 0,
  });
  const dragBoxRef = useRef<{
    id: string;
    startClientX: number;
    startPosMm: number;
    pxPerMm: number;
  } | null>(null);
  const selectedWorkspaceBox =
    project.workspaceBoxes.find((box) => box.id === project.selectedWorkspaceBoxId) ??
    project.workspaceBoxes[0];
  const preview = updateCubePreview(selectedWorkspaceBox, 0, (scaleFactor) => {
    if (!selectedWorkspaceBox) return;
    const largura = Math.max(50, Math.round(selectedWorkspaceBox.dimensoes.largura * scaleFactor));
    const altura = Math.max(50, Math.round(selectedWorkspaceBox.dimensoes.altura * scaleFactor));
    const profundidade = Math.max(
      50,
      Math.round(selectedWorkspaceBox.dimensoes.profundidade * scaleFactor)
    );
    actions.setDimensoes({ largura, altura, profundidade });
  });

  const cubePreviews = useMemo(() => {
    return project.workspaceBoxes.map((box, index) => {
      const previewScale = updateCubePreview(box, 0, undefined, index);
      const larguraReal = Math.max(1, box.dimensoes.largura);
      const profundidadeReal = Math.max(1, box.dimensoes.profundidade);
      const scaleFactor3D = (CUBE_BASE_SIZE * previewScale.scaleX) / larguraReal;
      const pxPerMmX = scaleFactor3D;
      const pxPerMmZ = (CUBE_BASE_SIZE * previewScale.scaleZ) / profundidadeReal;
      const pxPerMm = box.rotacaoY_90 ? pxPerMmZ : pxPerMmX;
      const visualWidth = larguraReal * scaleFactor3D;
      const offsetX = visualWidth * index;

      return {
        box,
        offsetX,
        label: `C${index + 1}`,
        colorIndex: index,
        pxPerMm,
        rotationOffsetY: box.rotacaoY_90 ? 90 : 0,
        isDragging: draggingBoxId === box.id,
      };
    });
  }, [project.workspaceBoxes, draggingBoxId]);

  const getWorkspaceWidthMm = (boxId: string) => {
    const box = project.workspaceBoxes.find((item) => item.id === boxId);
    if (!box) return 0;
    return box.rotacaoY_90 ? box.dimensoes.profundidade : box.dimensoes.largura;
  };

  const getSnappedPosition = (boxId: string, desiredX: number) => {
    const moving = project.workspaceBoxes.find((box) => box.id === boxId);
    if (!moving) return { x: desiredX, snapX: null as number | null };
    const movingWidth = getWorkspaceWidthMm(boxId);
    const snapDistance = 10;
    let bestX = desiredX;
    let snapX: number | null = null;
    let bestDiff = snapDistance + 1;

    const diffZero = Math.abs(desiredX);
    if (diffZero < bestDiff) {
      bestDiff = diffZero;
      bestX = 0;
      snapX = 0;
    }

    project.workspaceBoxes.forEach((other) => {
      if (other.id === boxId) return;
      const otherWidth = other.rotacaoY_90
        ? other.dimensoes.profundidade
        : other.dimensoes.largura;
      const candidateRight = other.posicaoX_mm + otherWidth;
      const candidateLeft = other.posicaoX_mm - movingWidth;
      const diffRight = Math.abs(desiredX - candidateRight);
      const diffLeft = Math.abs(desiredX - candidateLeft);

      if (diffRight < bestDiff) {
        bestDiff = diffRight;
        bestX = candidateRight;
        snapX = candidateRight;
      }
      if (diffLeft < bestDiff) {
        bestDiff = diffLeft;
        bestX = candidateLeft;
        snapX = candidateLeft;
      }
    });

    if (bestDiff > snapDistance) {
      bestX = desiredX;
      snapX = null;
    }

    project.workspaceBoxes.forEach((other) => {
      if (other.id === boxId) return;
      const otherWidth = other.rotacaoY_90
        ? other.dimensoes.profundidade
        : other.dimensoes.largura;
      const otherStart = other.posicaoX_mm;
      const otherEnd = other.posicaoX_mm + otherWidth;
      const movingStart = bestX;
      const movingEnd = bestX + movingWidth;

      if (movingStart < otherEnd && movingEnd > otherStart) {
        const pushLeft = otherStart - movingWidth;
        const pushRight = otherEnd;
        const diffLeft = Math.abs(desiredX - pushLeft);
        const diffRight = Math.abs(desiredX - pushRight);
        bestX = diffLeft <= diffRight ? pushLeft : pushRight;
        snapX = null;
      }
    });

    return { x: Math.max(0, bestX), snapX };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setIsAutoRotating(false);
    if (event.button === 2) {
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        active: true,
        button: 2,
      };
      setIsDragging(true);
      return;
    }
    if (!isUserControlling) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      active: true,
      button: 0,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragBoxRef.current) return;
    if (!dragRef.current.active) return;
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      active: true,
      button: dragRef.current.button,
    };
    if (dragRef.current.button === 0) {
      setRotation((prev) => ({
        x: Math.max(-60, Math.min(60, prev.x - deltaY * 0.3)),
        y: prev.y + deltaX * 0.4,
      }));
    }
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handleToggleControl = () => {
    setIsUserControlling((prev) => {
      const next = !prev;
      setIsAutoRotating(!next);
      return next;
    });
  };

  const handlePointerLeave = () => {
    dragRef.current.active = false;
    setIsUserControlling(false);
    setIsAutoRotating(true);
    setIsDragging(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const scaleFactor = event.deltaY < 0 ? 1.05 : 0.95;
    preview.applyZoom?.(scaleFactor);
  };

  const handlePointerMoveZoom = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.button !== 2) return;
    const deltaY = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY, active: true, button: 2 };
    const scaleFactor = deltaY < 0 ? 1.03 : 0.97;
    preview.applyZoom?.(scaleFactor);
  };

  const handleBoxPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    boxId: string,
    pxPerMm: number
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setIsAutoRotating(false);
    const currentPos = project.workspaceBoxes.find((box) => box.id === boxId)?.posicaoX_mm ?? 0;
    dragBoxRef.current = {
      id: boxId,
      startClientX: event.clientX,
      startPosMm: currentPos,
      pxPerMm,
    };
    setDraggingBoxId(boxId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBoxPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
    boxId: string
  ) => {
    const dragState = dragBoxRef.current;
    if (!dragState || dragState.id !== boxId) return;
    const deltaPx = event.clientX - dragState.startClientX;
    const desiredX = dragState.startPosMm + deltaPx / dragState.pxPerMm;
    const { x: snappedX, snapX } = getSnappedPosition(boxId, desiredX);
    actions.updateWorkspaceBoxPosition(boxId, snappedX);
    setSnapLineX(snapX !== null ? snapX * dragState.pxPerMm : null);
  };

  const handleBoxPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
    boxId: string
  ) => {
    const dragState = dragBoxRef.current;
    if (!dragState || dragState.id !== boxId) return;
    dragBoxRef.current = null;
    setDraggingBoxId(null);
    setSnapLineX(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!isAutoRotating || isUserControlling) return;
    let raf = 0;
    const step = () => {
      setRotation((prev) => ({
        x: Math.max(-60, Math.min(60, prev.x + 0.04)),
        y: prev.y + 0.15,
      }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isAutoRotating, isUserControlling]);

  const temDesign3D = project.estrutura3D && project.estrutura3D.pecas.length > 0;

  return (
    <main className="workspace-root">
      <div className="workspace-canvas">
        {temDesign3D ? (
          <>
            {/* Visualização 3D do design gerado */}
            <div className="workspace-viewer">
              <ThreeViewer
                modelUrl={project.selectedCaixaModelUrl ?? ""}
                height="100%"
                backgroundColor="#2f3f5a"
                showGrid={true}
                showFloor={true}
                colorize={false}
                wireframe={wireframeMode}
                cameraPreset={cameraPreset}
                materialConfig={materialState}
                notifyChangeSignal={viewerSync.notifyChangeSignal}
                registerViewerApi={viewerSync.registerViewerApi}
              />
              {!project.selectedCaixaModelUrl && (
                <div className="workspace-empty-overlay">
                  Nenhum modelo associado a este caixa
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Placeholder - Cubo CSS quando não há design */}
            <div
              className={`workspace-placeholder${isDragging ? " is-dragging" : ""}${
                isUserControlling ? " is-controlling" : ""
              }`}
              style={{
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerMoveCapture={handlePointerMoveZoom}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onClick={handleToggleControl}
              onWheel={handleWheel}
              onContextMenu={(event) => event.preventDefault()}
            >
              {snapLineX !== null && (
                <div
                  className="workspace-snapline"
                  style={{ transform: `translate(-50%, -50%) translateX(${snapLineX}px)` }}
                />
              )}
              {cubePreviews.map((preview) => (
                <div
                  key={preview.box.id}
                  className={`workspace-cube${preview.isDragging ? " is-dragging" : ""}`}
                  onPointerDown={(event) =>
                    handleBoxPointerDown(event, preview.box.id, preview.pxPerMm)
                  }
                  onPointerMove={(event) => handleBoxPointerMove(event, preview.box.id)}
                  onPointerUp={(event) => handleBoxPointerUp(event, preview.box.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.selectBox(preview.box.id);
                  }}
                >
                  <div className="workspace-cube-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.rotateWorkspaceBox(preview.box.id);
                      }}
                      className="icon-button"
                      title="Rodar 90°"
                      aria-label="Rodar 90 graus"
                    >
                      ⟳
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.selectBox(preview.box.id);
                        setTimeout(() => actions.duplicateWorkspaceBox(), 0);
                      }}
                      className="icon-button"
                      title="Duplicar"
                      aria-label="Duplicar caixote"
                    >
                      📄
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.selectBox(preview.box.id);
                        setTimeout(() => actions.removeWorkspaceBox(), 0);
                      }}
                      className="icon-button"
                      title="Remover"
                      aria-label="Remover caixote"
                      disabled={project.workspaceBoxes.length <= 1}
                    >
                      🗑
                    </button>
                  </div>
                  <Cube
                    boxModule={preview.box}
                    offsetX={preview.offsetX}
                    rotationX={rotation.x}
                    rotationY={rotation.y + preview.rotationOffsetY}
                    colorIndex={preview.colorIndex}
                    label={preview.label}
                    isDragging={preview.isDragging}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="w-full">
        <WorkspaceBottomPanel />
      </div>
    </main>
  );
}
