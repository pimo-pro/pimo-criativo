/**
 * Barra superior unificada do Workspace (evolução incremental).
 * «Salvar e Gerar Design»: executa gerarESalvarDesign (persistir + gerar) e só depois abre o painel.
 * Ferramentas 3D selecionar / mover / rodar (toolbar unificada).
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../../context/useProject";
import { convertProjectToV3Pieces } from "../../../nesting-v3/utils/convertProjectToV3Pieces";
import { VIEWER_TOOLBAR_ITEMS, TOOLS_3D_ITEMS } from "../../../constants/toolbarConfig";
import type { Tool3DId } from "../../../constants/toolbarConfig";
import UnifiedExportPanel from "../../modals/UnifiedExportPanel";
import { NumericInput } from "../../ui/NumericInput";
import { Icon } from "@/components/icons";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import CameraViewMenu from "../viewer-toolbar/CameraViewMenu";
import { useUiStore, uiStore } from "../../../stores/uiStore";
import { resolveLRemateCompositeLeadId } from "../../../core/remate/remateLGeometry";
import DisplayMenuButton from "../topbar/DisplayMenuButton";
import RoomIconButton from "../../viewer/toolbar/RoomIconButton";
import WorkspaceToolbar from "../workspace/WorkspaceToolbar";

const cfgNovo = VIEWER_TOOLBAR_ITEMS.find((i) => i.id === "novo");
const cfgProjeto = VIEWER_TOOLBAR_ITEMS.find((i) => i.id === "projeto");
const cfgImagem = VIEWER_TOOLBAR_ITEMS.find((i) => i.id === "imagem");
const cfgResetCamera = VIEWER_TOOLBAR_ITEMS.find((i) => i.id === "reset-camera");

/** Estilo do botão lock na toolbar unificada. */
const lockToolbarButtonStyle = {
  width: 28,
  height: 28,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  border: "none" as const,
  borderRadius: 4,
  color: "var(--text-main)",
  fontSize: 12,
  cursor: "pointer" as const,
  marginLeft: 3,
};

const toolbarButtonStyle = {
  width: 28,
  height: 28,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  border: "none" as const,
  borderRadius: 4,
  color: "var(--text-main)",
  fontSize: 12,
  cursor: "pointer" as const,
  marginLeft: 3,
};

const unifiedBubbleStyle = {
  width: 28,
  height: 28,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  border: "none" as const,
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer" as const,
  marginLeft: 3,
  color: "var(--blue-light)",
};

const RIGHT_TOOLBAR_ICON_PX = 24;
const projectIconBubbleStyle = {
  width: 28,
  height: 28,
  minWidth: 28,
  padding: 0,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  boxSizing: "border-box" as const,
};

const PRIMARY_3D_IDS: Tool3DId[] = ["select", "move", "rotate", "scale"];

type UnifiedTopToolbarProps = {
  onNovo: () => void;
  onProjetos: () => void;
  activeTool: Tool3DId;
  onToolSelect: (toolId: Tool3DId, eventKey: string) => void;
  lockEnabled?: boolean;
  onToggleLock?: () => void;
};

export default function UnifiedTopToolbar({
  onNovo,
  onProjetos,
  activeTool,
  onToolSelect,
  lockEnabled = true,
  onToggleLock,
}: UnifiedTopToolbarProps) {
  const { project, actions } = useProject();
  const navigate = useNavigate();
  const { viewerApi } = usePimoViewerContext();
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const photoModePanelOpen = useUiStore((s) => s.photoModePanelOpen);
  const setPhotoModePanelOpen = useUiStore((s) => s.setPhotoModePanelOpen);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const visibilityMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef(actions);
  const viewerApiRef = useRef(viewerApi);

  useEffect(() => {
    actionsRef.current = actions;
    viewerApiRef.current = viewerApi;
  }, [actions, viewerApi]);

  useEffect(() => {
    viewerApiRef.current?.setPhotoModeEnabled?.(photoModePanelOpen);
    actionsRef.current.setViewerSettings({ photoModeEnabled: photoModePanelOpen });
  }, [photoModePanelOpen]);

  useEffect(() => {
    return () => {
      viewerApiRef.current?.setPhotoModeEnabled?.(false);
      actionsRef.current.setViewerSettings({ photoModeEnabled: false });
      uiStore.getState().setPhotoModePanelOpen(false);
    };
  }, []);

  const selectedBoxId = project.selectedWorkspaceBoxId;
  const selectedBox = selectedBoxId ? project.workspaceBoxes.find((b) => b.id === selectedBoxId) : undefined;
  const selectedObject = useUiStore((s) => s.selectedObject);
  const rawSelectedRemateId = selectedObject.type === "remate" ? selectedObject.id : null;
  const selectedRemateId = rawSelectedRemateId
    ? resolveLRemateCompositeLeadId(rawSelectedRemateId, project.remates ?? [])
    : null;
  const selectedRemate = selectedRemateId
    ? (project.remates ?? []).find((r) => r.id === selectedRemateId)
    : undefined;
  const isPieceLocked = selectedBox?.locked === true;
  const enabledTools: Tool3DId[] =
    isPieceLocked && !selectedRemateId ? ["select"] : ["select", "move", "rotate"];
  const panelRenderingEnabled = project.viewerSettings.panelRenderingEnabled === true;

  const [rotationMenuOpen, setRotationMenuOpen] = useState(false);
  const showRotationMenu = activeTool === "rotate" && rotationMenuOpen;
  const rotationMenuRef = useRef<HTMLDivElement>(null);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showExplodedMenu, setShowExplodedMenu] = useState(false);
  const [dimensionsOverlayOn, setDimensionsOverlayOn] = useState(false);
  const cameraMenuRef = useRef<HTMLDivElement>(null);
  const explodedMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const needClick = showRotationMenu || showCameraMenu || showExplodedMenu;
    const needMousedown = visibilityMenuOpen;
    if (!needClick && !needMousedown) return;
    const closeOnClick = (e: MouseEvent) => {
      if (showRotationMenu && rotationMenuRef.current && !rotationMenuRef.current.contains(e.target as Node)) {
        setRotationMenuOpen(false);
      }
      if (cameraMenuRef.current && !cameraMenuRef.current.contains(e.target as Node)) setShowCameraMenu(false);
      if (explodedMenuRef.current && !explodedMenuRef.current.contains(e.target as Node)) setShowExplodedMenu(false);
    };
    const closeVisibilityOnMousedown = (event: MouseEvent) => {
      if (!visibilityMenuRef.current?.contains(event.target as Node)) {
        setVisibilityMenuOpen(false);
      }
    };
    if (needClick) document.addEventListener("click", closeOnClick);
    if (needMousedown) document.addEventListener("mousedown", closeVisibilityOnMousedown);
    return () => {
      if (needClick) document.removeEventListener("click", closeOnClick);
      if (needMousedown) document.removeEventListener("mousedown", closeVisibilityOnMousedown);
    };
  }, [showRotationMenu, showCameraMenu, showExplodedMenu, visibilityMenuOpen]);

  const emitToolSelect = (id: Tool3DId, eventKey: string) => {
    if (id !== "rotate") setRotationMenuOpen(false);
    onToolSelect(id, eventKey);
  };

  const togglePhotoMenu = () => {
    setPhotoModePanelOpen(!photoModePanelOpen);
    setVisibilityMenuOpen(false);
  };

  const toggleVisibilityMenu = () => {
    setVisibilityMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPhotoModePanelOpen(false);
      }
      return next;
    });
  };

  const handleRotateClick = () => {
    if (!enabledTools.includes("rotate")) return;
    if (activeTool === "rotate" && rotationMenuOpen) {
      setRotationMenuOpen(false);
      return;
    }
    emitToolSelect("rotate", "tool:rotate");
    if (selectedBoxId || selectedRemateId) setRotationMenuOpen(true);
  };

  const primary3dItems = PRIMARY_3D_IDS.map((id) => TOOLS_3D_ITEMS.find((i) => i.id === id)).filter(
    (item): item is (typeof TOOLS_3D_ITEMS)[number] => item != null
  );

  return (
    <div
      className="unified-top-toolbar"
      role="toolbar"
      aria-label="Ações superiores do projeto"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 6,
        padding: "2px 4px",
        flexShrink: 0,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        {primary3dItems.map((item) => {
          const isActive = activeTool === item.id;
          const isEnabled = enabledTools.includes(item.id);
          const title = !isEnabled && isPieceLocked ? "Peça bloqueada" : item.tooltip;
          const isRotate = item.id === "rotate";
          return (
            <div
              key={item.id}
              ref={isRotate ? rotationMenuRef : undefined}
              style={isRotate ? { position: "relative", display: "inline-flex" } : undefined}
            >
              <button
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={isActive}
                aria-expanded={isRotate ? showRotationMenu : undefined}
                disabled={!isEnabled}
                onClick={() => {
                  if (!isEnabled) return;
                  if (isRotate) handleRotateClick();
                  else emitToolSelect(item.id, item.eventKey);
                }}
                style={{
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  borderRadius: 4,
                  background: isActive ? "var(--toolbar-pressed-bg)" : "transparent",
                  color: isEnabled ? "var(--text-main)" : "var(--text-muted)",
                  fontSize: 12,
                  cursor: isEnabled ? "pointer" : "default",
                  opacity: isEnabled ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (isEnabled) {
                    e.currentTarget.style.background = isActive
                      ? "var(--toolbar-pressed-bg)"
                      : "var(--viewer-toolbar-hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? "var(--toolbar-pressed-bg)" : "transparent";
                }}
              >
                <Icon name={item.iconName} size={24} aria-hidden />
              </button>
              {isRotate && (selectedBoxId || selectedRemateId) && showRotationMenu && (() => {
                if (selectedRemateId && selectedRemate) {
                  const radToDeg = (r: number) => Math.round((r * 180) / Math.PI);
                  const degToRad = (d: number) => (d * Math.PI) / 180;
                  const rotX = selectedRemate.rotation.xRad;
                  const rotY = selectedRemate.rotation.yRad;
                  const rotZ = selectedRemate.rotation.zRad;
                  const updateRotation = (partial: { xRad?: number; yRad?: number; zRad?: number }) => {
                    actions.updateRemate(selectedRemateId, {
                      rotation: {
                        xRad: partial.xRad ?? rotX,
                        yRad: partial.yRad ?? rotY,
                        zRad: partial.zRad ?? rotZ,
                      },
                      placementMode: "FREE",
                    });
                  };
                  return (
                    <div
                      role="dialog"
                      aria-label="Rotação do remate"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 4,
                        padding: 12,
                        background: "var(--popover-bg)",
                        border: "1px solid var(--popover-border)",
                        borderRadius: 8,
                        boxShadow: "var(--popover-shadow)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        minWidth: 200,
                        zIndex: 1000,
                      }}
                    >
                      <button
                        type="button"
                        className="button button-ghost button-sm"
                        style={{ width: "100%" }}
                        onClick={() => updateRotation({ yRad: rotY + Math.PI / 2 })}
                      >
                        90° direita
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", minWidth: 20 }}>X</span>
                        <NumericInput
                          value={radToDeg(rotX)}
                          min={-360}
                          max={360}
                          onChange={(v) => updateRotation({ xRad: degToRad(v) })}
                          className="input input-xs"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e", minWidth: 20 }}>Y</span>
                        <NumericInput
                          value={radToDeg(rotY)}
                          min={-360}
                          max={360}
                          onChange={(v) => updateRotation({ yRad: degToRad(v) })}
                          className="input input-xs"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", minWidth: 20 }}>Z</span>
                        <NumericInput
                          value={radToDeg(rotZ)}
                          min={-360}
                          max={360}
                          onChange={(v) => updateRotation({ zRad: degToRad(v) })}
                          className="input input-xs"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  );
                }

                const box = project.workspaceBoxes.find((b) => b.id === selectedBoxId);
                const radToDeg = (r: number) => Math.round((r * 180) / Math.PI);
                const degToRad = (d: number) => (d * Math.PI) / 180;
                const rotX = box?.rotacaoX ?? 0;
                const rotY = box?.rotacaoY ?? 0;
                const rotZ = box?.rotacaoZ ?? 0;
                const updateRotation = (partial: { rotacaoX_rad?: number; rotacaoY_rad?: number; rotacaoZ_rad?: number }) => {
                  actions.updateWorkspaceBoxTransform(selectedBoxId, {
                    ...partial,
                    manualPosition: true,
                  });
                };
                return (
                  <div
                    role="dialog"
                    aria-label="Rotação"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      padding: 12,
                      background: "var(--popover-bg)",
                      border: "1px solid var(--popover-border)",
                      borderRadius: 8,
                      boxShadow: "var(--popover-shadow)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      minWidth: 200,
                      zIndex: 1000,
                    }}
                  >
                    <button
                      type="button"
                      className="button button-ghost button-sm"
                      style={{ width: "100%" }}
                      onClick={() => {
                        updateRotation({ rotacaoY_rad: rotY + Math.PI / 2 });
                      }}
                    >
                      90° direita
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", minWidth: 20 }}>X</span>
                      <NumericInput
                        value={radToDeg(rotX)}
                        min={-360}
                        max={360}
                        onChange={(v) => updateRotation({ rotacaoX_rad: degToRad(v) })}
                        className="input input-xs"
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e", minWidth: 20 }}>Y</span>
                      <NumericInput
                        value={radToDeg(rotY)}
                        min={-360}
                        max={360}
                        onChange={(v) => updateRotation({ rotacaoY_rad: degToRad(v) })}
                        className="input input-xs"
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", minWidth: 20 }}>Z</span>
                      <NumericInput
                        value={radToDeg(rotZ)}
                        min={-360}
                        max={360}
                        onChange={(v) => updateRotation({ rotacaoZ_rad: degToRad(v) })}
                        className="input input-xs"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
        <button
          type="button"
          title={panelRenderingEnabled ? "Ocultar peças individuais" : "Ver Peças"}
          aria-label={panelRenderingEnabled ? "Ocultar peças individuais" : "Ver Peças"}
          aria-pressed={panelRenderingEnabled}
          onClick={() => actions.setViewerSettings({ panelRenderingEnabled: !panelRenderingEnabled })}
          style={{
            width: 44,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 4,
            background: panelRenderingEnabled ? "var(--toolbar-pressed-bg)" : "transparent",
            color: "var(--text-main)",
            fontSize: 11,
            cursor: "pointer",
            marginLeft: 3,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = panelRenderingEnabled
              ? "var(--toolbar-pressed-bg)"
              : "var(--viewer-toolbar-hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = panelRenderingEnabled ? "var(--toolbar-pressed-bg)" : "transparent";
          }}
        >
          Peças
        </button>
        {TOOLS_3D_ITEMS.filter(
          (item) => item.id === "scale" || item.id === "orbit" || item.id === "pan"
        ).map((item) => {
          const isActive = activeTool === item.id;
          const isEnabled = enabledTools.includes(item.id);
          const title = !isEnabled && isPieceLocked ? "Peça bloqueada" : item.tooltip;
          return (
            <div key={item.id}>
              <button
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={isActive}
                disabled={!isEnabled}
                onClick={() => {
                  if (!isEnabled) return;
                  emitToolSelect(item.id, item.eventKey);
                }}
                style={{
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  borderRadius: 4,
                  background: isActive ? "var(--toolbar-pressed-bg)" : "transparent",
                  color: isEnabled ? "var(--text-main)" : "var(--text-muted)",
                  fontSize: 12,
                  cursor: isEnabled ? "pointer" : "default",
                  opacity: isEnabled ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (isEnabled) e.currentTarget.style.background = isActive ? "var(--toolbar-pressed-bg)" : "var(--viewer-toolbar-hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? "var(--toolbar-pressed-bg)" : "transparent";
                }}
              >
                <Icon name={item.iconName} size={24} aria-hidden />
              </button>
            </div>
          );
        })}
        {onToggleLock != null && (
          <button
            type="button"
            title={lockEnabled ? "Desbloquear (permitir sobreposição e atravessar paredes/chão)" : "Bloquear (impedir colisão entre caixas, paredes e chão)"}
            aria-label={lockEnabled ? "Desbloquear" : "Bloquear"}
            aria-pressed={lockEnabled}
            onClick={onToggleLock}
            style={{
              ...lockToolbarButtonStyle,
              background: lockEnabled ? "var(--toolbar-pressed-bg)" : "transparent",
            }}
          >
            <Icon name="lock3D" size={24} aria-hidden />
          </button>
        )}
        <div ref={cameraMenuRef} style={{ position: "relative", display: "inline-flex", marginLeft: 2 }}>
          <button
            type="button"
            title="Selecionar vista da câmera"
            aria-label="Selecionar vista da câmera"
            aria-expanded={showCameraMenu}
            onClick={() => {
              setShowExplodedMenu(false);
              setShowCameraMenu(true);
            }}
            style={{
              ...toolbarButtonStyle,
              background: showCameraMenu ? "var(--toolbar-pressed-bg)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!showCameraMenu) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              if (!showCameraMenu) e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name="camera" size={24} aria-hidden />
          </button>
          {showCameraMenu && (
            <CameraViewMenu
              onSelect={(preset: "bottom" | "left" | "right" | "top" | "front" | "back" | "isometric") => {
                viewerApi?.setCameraView?.(preset);
                setShowCameraMenu(false);
              }}
              onClose={() => setShowCameraMenu(false)}
            />
          )}
        </div>
        <div ref={explodedMenuRef} style={{ position: "relative", display: "inline-flex", marginLeft: 2 }}>
          <button
            type="button"
            title="Exploded View"
            aria-label="Exploded View"
            aria-expanded={showExplodedMenu}
            onClick={() => {
              setShowCameraMenu(false);
              setShowExplodedMenu((prev) => !prev);
            }}
            style={{
              ...toolbarButtonStyle,
              background: showExplodedMenu ? "var(--toolbar-pressed-bg)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!showExplodedMenu) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              if (!showExplodedMenu) e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name="exploded" size={24} aria-hidden />
          </button>
          {showExplodedMenu && (
            <div
              role="dialog"
              aria-label="Exploded View"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                minWidth: 240,
                padding: 10,
                background: "var(--popover-bg)",
                border: "1px solid var(--popover-border)",
                borderRadius: 8,
                boxShadow: "var(--popover-shadow)",
                zIndex: 1000,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={project.viewerSettings.explodedViewEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    actions.setViewerSettings({ explodedViewEnabled: enabled });
                    viewerApi?.setExplodedViewEnabled?.(enabled);
                  }}
                />
                Exploded View
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                Intensidade Exploded ({Math.round(project.viewerSettings.explodedViewIntensity * 100)}%)
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={project.viewerSettings.explodedViewIntensity}
                  disabled={!project.viewerSettings.explodedViewEnabled}
                  onChange={(e) => {
                    const intensity = Math.max(0, Math.min(1, Number.parseFloat(e.target.value) || 0));
                    actions.setViewerSettings({ explodedViewIntensity: intensity });
                    viewerApi?.setExplodedViewIntensity?.(intensity);
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          className="viewer-action-icon"
          title={project.viewerSettings.highlightEnabled ? "Highlight ON (clique para desativar)" : "Highlight OFF (clique para ativar)"}
          aria-label={project.viewerSettings.highlightEnabled ? "Desativar highlight" : "Ativar highlight"}
          aria-pressed={project.viewerSettings.highlightEnabled}
          onClick={() => {
            const next = !project.viewerSettings.highlightEnabled;
            actions.toggleHighlight();
            viewerApi?.setHighlightEnabled?.(next);
          }}
          style={{
            ...toolbarButtonStyle,
            background: project.viewerSettings.highlightEnabled ? "rgba(77, 163, 255, 0.25)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!project.viewerSettings.highlightEnabled) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            if (!project.viewerSettings.highlightEnabled) e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="highlight" size={24} aria-hidden />
        </button>
        <button
          type="button"
          className="viewer-action-icon"
          title={project.viewerSettings.rulerEnabled ? "Régua ON (clique para desativar)" : "Régua OFF (clique para ativar)"}
          aria-label={project.viewerSettings.rulerEnabled ? "Desativar régua" : "Ativar régua"}
          aria-pressed={project.viewerSettings.rulerEnabled}
          onClick={() => {
            actions.toggleRuler();
          }}
          style={{
            ...toolbarButtonStyle,
            background: project.viewerSettings.rulerEnabled ? "rgba(77, 163, 255, 0.25)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!project.viewerSettings.rulerEnabled) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            if (!project.viewerSettings.rulerEnabled) e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon name="ruler" size={24} aria-hidden />
        </button>
        <button
          type="button"
          className="viewer-action-icon"
          title={
            dimensionsOverlayOn
              ? "Medidas do Conjunto ON (clique para desativar)"
              : "Medidas do Conjunto OFF (clique para ativar)"
          }
          aria-label={
            dimensionsOverlayOn ? "Desativar medidas do conjunto" : "Ativar medidas do conjunto"
          }
          aria-pressed={dimensionsOverlayOn}
          onClick={() => {
            const next = viewerApi?.toggleDimensionsOverlay?.() ?? false;
            setDimensionsOverlayOn(next);
          }}
          style={{
            ...toolbarButtonStyle,
            background: dimensionsOverlayOn ? "rgba(148, 163, 184, 0.28)" : "transparent",
            boxShadow: dimensionsOverlayOn
              ? "inset 0 0 0 1px rgba(148, 163, 184, 0.45)"
              : undefined,
            minWidth: 28,
            padding: "0 4px",
          }}
          onMouseEnter={(e) => {
            if (!dimensionsOverlayOn) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            if (!dimensionsOverlayOn) e.currentTarget.style.background = "transparent";
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.01em", color: "#cbd5e1" }}>MC</span>
        </button>
        {cfgImagem ? (
          <button
            type="button"
            title={cfgImagem.tooltip}
            aria-label={cfgImagem.tooltip}
            aria-pressed={photoModePanelOpen}
            onClick={togglePhotoMenu}
            style={{
              ...unifiedBubbleStyle,
              background: photoModePanelOpen ? "var(--toolbar-pressed-bg)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!photoModePanelOpen) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = photoModePanelOpen ? "var(--toolbar-pressed-bg)" : "transparent";
            }}
          >
            <Icon name={cfgImagem.iconName} size={24} aria-hidden />
          </button>
        ) : null}
        {cfgResetCamera ? (
          <button
            type="button"
            title={cfgResetCamera.tooltip}
            aria-label={cfgResetCamera.tooltip}
            onClick={() => viewerApi?.resetCamera?.()}
            style={unifiedBubbleStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon name={cfgResetCamera.iconName} size={24} aria-hidden />
          </button>
        ) : null}
        <DisplayMenuButton triggerStyle={unifiedBubbleStyle} />
        <div ref={visibilityMenuRef} className="viewer-toolbar-popover-anchor">
          <button
            type="button"
            title="Opções de visualização"
            aria-label="Opções de visualização"
            aria-haspopup="dialog"
            aria-expanded={visibilityMenuOpen}
            aria-pressed={visibilityMenuOpen}
            onClick={toggleVisibilityMenu}
            style={{
              ...unifiedBubbleStyle,
              background: visibilityMenuOpen ? "var(--toolbar-pressed-bg)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!visibilityMenuOpen) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = visibilityMenuOpen ? "var(--toolbar-pressed-bg)" : "transparent";
            }}
          >
            <Icon name="displayCheck" size={24} aria-hidden />
          </button>
          {visibilityMenuOpen && (
            <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Opções de visualização">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={project.viewerSettings.showPanelEdges}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      actions.setViewerSettings({ showPanelEdges: checked });
                      viewerApi?.setPanelEdgesVisible?.(checked);
                    }}
                  />
                  Mostrar arestas dos painéis
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={project.viewerSettings.hideAllPanels}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      actions.setViewerSettings({ hideAllPanels: checked });
                      viewerApi?.setAllPanelsHidden?.(checked);
                    }}
                  />
                  Esconder todos os painéis
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={project.viewerSettings.showCeiling}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      actions.setViewerSettings({ showCeiling: checked });
                      viewerApi?.setRoomCeilingVisible?.(checked);
                    }}
                  />
                  Mostrar teto da sala
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={project.viewerSettings.wallEditMode}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      actions.setViewerSettings({ wallEditMode: checked });
                      viewerApi?.setWallEditMode?.(checked);
                    }}
                  />
                  Modo edição de paredes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={project.viewerSettings.enableReflections}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      actions.setViewerSettings({ enableReflections: checked });
                      viewerApi?.setReflectionsEnabled?.(checked);
                    }}
                  />
                  Reflexos dinâmicos (probe)
                </label>
              </div>
            </div>
          )}
        </div>
        <WorkspaceToolbar />
        <RoomIconButton />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        <button
          type="button"
          className="button viewer-action-button"
          title={cfgNovo?.tooltip ?? "Novo projeto"}
          aria-label={cfgNovo?.tooltip ?? "Novo projeto"}
          onClick={onNovo}
          disabled={project.estaCarregando}
          style={{
            ...projectIconBubbleStyle,
            fontSize: 12,
            opacity: project.estaCarregando ? 0.7 : 1,
            cursor: project.estaCarregando ? "not-allowed" : "pointer",
          }}
        >
          <Icon name={cfgNovo?.iconName ?? "adminDocs"} size={RIGHT_TOOLBAR_ICON_PX} aria-hidden />
        </button>
        <button
          type="button"
          className="button viewer-action-button"
          title={cfgProjeto?.tooltip ?? "Projetos salvos"}
          aria-label={cfgProjeto?.tooltip ?? "Projetos salvos"}
          onClick={onProjetos}
          disabled={project.estaCarregando}
          style={{
            ...projectIconBubbleStyle,
            fontSize: 12,
            opacity: project.estaCarregando ? 0.7 : 1,
            cursor: project.estaCarregando ? "not-allowed" : "pointer",
          }}
        >
          <Icon name={cfgProjeto?.iconName ?? "projects"} size={RIGHT_TOOLBAR_ICON_PX} aria-hidden />
        </button>
        <button
          type="button"
          className="button button-primary viewer-action-button"
          title="Salvar e Gerar Design"
          aria-label="Salvar e Gerar Design"
          onClick={() => {
            void (async () => {
              await actions.gerarESalvarDesign();
              setExportPanelOpen(true);
            })();
          }}
          disabled={project.estaCarregando}
          style={{
            background: "var(--blue-light)",
            fontSize: 13,
            padding: "7px 13px",
            minHeight: 31,
            lineHeight: 1.2,
            opacity: project.estaCarregando ? 0.7 : 1,
            cursor: project.estaCarregando ? "not-allowed" : "pointer",
          }}
        >
          Salvar e Gerar Design
        </button>
        <UnifiedExportPanel
          isOpen={exportPanelOpen}
          onClose={() => setExportPanelOpen(false)}
          onOpenNestingV3={() => {
            setExportPanelOpen(false);
            const pieces = convertProjectToV3Pieces(project);
            navigate("/nesting_v3", {
              state: {
                openNestingV3: true,
                pieces,
                projectName: project.projectName,
              },
            });
          }}
        />
      </div>
    </div>
  );
}
