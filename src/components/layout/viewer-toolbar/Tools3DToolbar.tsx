/**
 * Toolbar de ferramentas 3D (segunda linha).
 * Select, Move, Rotate ligados ao viewerApiAdapter (setTool → setTransformMode).
 * activeTool controlado pelo estado global (project.activeViewerTool).
 */

import { useState, useRef, useEffect } from "react";
import { TOOLS_3D_ITEMS } from "../../../constants/toolbarConfig";
import type { Tool3DId } from "../../../constants/toolbarConfig";
import { useWallStore, wallStore } from "../../../stores/wallStore";
import { useUiStore } from "../../../stores/uiStore";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import CameraViewMenu from "./CameraViewMenu";

export type Tools3DToolbarProps = {
  /** Ferramenta ativa (controlado pelo estado global). */
  activeTool?: Tool3DId;
  /** Chamado ao clicar numa ferramenta; aplica ao viewer via actions.setActiveTool. */
  onToolSelect?: (toolId: Tool3DId, eventKey: string) => void;
  /** Lock (colisão): impede caixas de se sobrepor quando ON. */
  lockEnabled?: boolean;
  /** Alternar Lock. */
  onToggleLock?: () => void;
};

const btnStyle = {
  width: 26,
  height: 26,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  border: "none" as const,
  borderRadius: 4,
  color: "var(--text-main)",
  fontSize: 12,
  cursor: "pointer" as const,
  marginLeft: 2,
};

export default function Tools3DToolbar({
  activeTool = "select",
  onToolSelect,
  lockEnabled = false,
  onToggleLock,
}: Tools3DToolbarProps) {
  const { project, actions, viewerSync } = useProject();
  const { viewerApi } = usePimoViewerContext() ?? {};
  const snapEnabled = useWallStore((state) => state.snapEnabled);
  const isRoomOpen = useWallStore((state) => state.isOpen);
  const setOpen = useWallStore((state) => state.setOpen);
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);
  const enabledTools: Tool3DId[] = ["select", "move", "rotate"];
  const selectedBoxId = project.selectedWorkspaceBoxId;
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [manualWallHidden, setManualWallHidden] = useState(false);
  const cameraMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCameraMenu) return;
    const close = (e: MouseEvent) => {
      if (cameraMenuRef.current && !cameraMenuRef.current.contains(e.target as Node)) setShowCameraMenu(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showCameraMenu]);

  useEffect(() => {
    setManualWallHidden(viewerApi?.getManualWallHidden?.() ?? false);
  }, [viewerApi]);

  const handleClick = (id: Tool3DId, eventKey: string) => {
    onToolSelect?.(id, eventKey);
  };

  return (
    <div
      className="tools-3d-toolbar"
      role="toolbar"
      aria-label="Ferramentas 3D"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "4px 10px",
        background: "rgba(15, 23, 42, 0.7)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {TOOLS_3D_ITEMS.map((item) => {
        const isActive = activeTool === item.id;
        const isEnabled = enabledTools.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            title={item.tooltip}
            aria-label={item.tooltip}
            aria-pressed={isActive}
            disabled={!isEnabled}
            onClick={() => isEnabled && handleClick(item.id, item.eventKey)}
            style={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              background: isActive ? "rgba(59, 130, 246, 0.25)" : "transparent",
              color: isEnabled ? "var(--text-main)" : "var(--text-muted)",
              fontSize: 11,
              cursor: isEnabled ? "pointer" : "default",
              opacity: isEnabled ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (isEnabled) e.currentTarget.style.background = isActive ? "rgba(59, 130, 246, 0.35)" : "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive ? "rgba(59, 130, 246, 0.25)" : "transparent";
            }}
          >
            {item.icon}
          </button>
        );
      })}
      {onToggleLock != null && (
        <button
          type="button"
          title={lockEnabled ? "Desbloquear (permitir sobreposição)" : "Bloquear (impedir colisão)"}
          aria-label={lockEnabled ? "Desbloquear" : "Bloquear"}
          aria-pressed={lockEnabled}
          onClick={onToggleLock}
          style={{
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 4,
            background: lockEnabled ? "rgba(59, 130, 246, 0.25)" : "transparent",
            color: "var(--text-main)",
            fontSize: 12,
            cursor: "pointer",
            marginLeft: 2,
          }}
        >
          🔒
        </button>
      )}
      <button
        type="button"
        title={snapEnabled ? "Desativar Snap" : "Ativar Snap"}
        aria-label={snapEnabled ? "Desativar Snap" : "Ativar Snap"}
        aria-pressed={snapEnabled}
        onClick={() => wallStore.getState().toggleSnap()}
        style={{
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 4,
          background: snapEnabled ? "rgba(59, 130, 246, 0.25)" : "transparent",
          color: "var(--text-main)",
          fontSize: 12,
          cursor: "pointer",
          marginLeft: 2,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = snapEnabled ? "rgba(59, 130, 246, 0.35)" : "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = snapEnabled ? "rgba(59, 130, 246, 0.25)" : "transparent";
        }}
      >
        🧲
      </button>
      <div ref={cameraMenuRef} style={{ position: "relative", display: "inline-flex", marginLeft: 2 }}>
        <button
          type="button"
          title="Selecionar vista da câmera"
          aria-label="Selecionar vista da câmera"
          aria-expanded={showCameraMenu}
          onClick={() => setShowCameraMenu(true)}
          style={{
            ...btnStyle,
            background: showCameraMenu ? "rgba(59, 130, 246, 0.25)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!showCameraMenu) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            if (!showCameraMenu) e.currentTarget.style.background = "transparent";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        {showCameraMenu && (
          <CameraViewMenu
            onSelect={(preset) => {
              viewerApi?.setCameraView?.(preset);
              setShowCameraMenu(false);
            }}
            onClose={() => setShowCameraMenu(false)}
          />
        )}
      </div>
      <button
        type="button"
        title={isRoomOpen ? "Ocultar Sala" : "Mostrar Sala"}
        aria-label={isRoomOpen ? "Ocultar Sala" : "Mostrar Sala"}
        aria-pressed={isRoomOpen}
        onClick={() => {
          const next = !isRoomOpen;
          setOpen(next);
          if (next) setSelectedTool("layout");
        }}
        style={{
          ...btnStyle,
          background: isRoomOpen ? "rgba(59, 130, 246, 0.25)" : "transparent",
          marginLeft: 6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isRoomOpen ? "rgba(59, 130, 246, 0.35)" : "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isRoomOpen ? "rgba(59, 130, 246, 0.25)" : "transparent";
        }}
      >
        ▭
      </button>
      <button
        type="button"
        title={manualWallHidden ? "Mostrar paredes" : "Esconder parede"}
        aria-label={manualWallHidden ? "Mostrar paredes" : "Esconder parede"}
        aria-pressed={manualWallHidden}
        onClick={() => {
          const next = !manualWallHidden;
          setManualWallHidden(next);
          viewerApi?.setManualWallHidden?.(next);
        }}
        style={{
          ...btnStyle,
          background: manualWallHidden ? "rgba(59, 130, 246, 0.25)" : "transparent",
          marginLeft: 2,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = manualWallHidden ? "rgba(59, 130, 246, 0.35)" : "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = manualWallHidden ? "rgba(59, 130, 246, 0.25)" : "transparent";
        }}
      >
        {manualWallHidden ? "👁" : "🙈"}
      </button>
      {selectedBoxId && (
        <>
          <button
            type="button"
            title="Reativar Auto-Rotate"
            aria-label="Reativar Auto-Rotate"
            onClick={() => actions.updateWorkspaceBoxTransform(selectedBoxId, { autoRotateEnabled: true })}
            style={{ ...btnStyle, marginLeft: 6, background: "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            🔄
          </button>
          <button
            type="button"
            title="Rotar 90° à direita"
            aria-label="Rotar 90° à direita"
            onClick={() => {
              const box = project.workspaceBoxes.find((b) => b.id === selectedBoxId);
              const currentRad = box?.rotacaoY ?? 0;
              actions.updateWorkspaceBoxTransform(selectedBoxId, {
                rotacaoY_rad: currentRad + Math.PI / 2,
                manualPosition: true,
              });
            }}
            style={{ ...btnStyle, background: "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            ⟳
          </button>
        </>
      )}
    </div>
  );
}
