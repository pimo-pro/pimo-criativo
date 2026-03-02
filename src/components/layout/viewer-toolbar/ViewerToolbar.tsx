/**
 * Toolbar superior do Viewer.
 * Ações principais do projeto + controle de Photo Mode via popover no ícone da câmera.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "../../../context/useProject";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { VIEWER_TOOLBAR_ITEMS } from "../../../constants/toolbarConfig";
import type { ToolbarActionId } from "../../../constants/toolbarConfig";
import type {
  UltraPerformanceInternalMode,
  ViewerBackgroundMode,
  ViewerMaterialQuality,
} from "../../../context/projectTypes";
import RoomIconButton from "../../viewer/toolbar/RoomIconButton";
import PhotoModePopoverContent from "./PhotoModePopoverContent";

const panelLabels: Record<"left" | "right" | "top" | "bottom" | "back", string> = {
  left: "Lateral Esq",
  right: "Lateral Dir",
  top: "Topo",
  bottom: "Fundo",
  back: "Costa",
};

const panelKeyByType = {
  left: "lateral_esquerda",
  right: "lateral_direita",
  top: "cima",
  bottom: "fundo",
  back: "costa",
} as const;

export default function ViewerToolbar() {
  const { actions, project } = useProject();
  const { openModal } = useToolbarModal();
  const { viewerApi } = usePimoViewerContext();
  const ultraModeEnabled = project.viewerSettings.ultraPerformanceModeOptions.enabled;
  const [photoModeOpen, setPhotoModeOpen] = useState(false);
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [materialMenuOpen, setMaterialMenuOpen] = useState(false);
  const [ultraModeMenuOpen, setUltraModeMenuOpen] = useState(false);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [piecesMenuOpen, setPiecesMenuOpen] = useState(false);
  const [pieceSearch, setPieceSearch] = useState("");
  const photoModeContainerRef = useRef<HTMLDivElement | null>(null);
  const backgroundMenuRef = useRef<HTMLDivElement | null>(null);
  const materialMenuRef = useRef<HTMLDivElement | null>(null);
  const ultraModeMenuRef = useRef<HTMLDivElement | null>(null);
  const visibilityMenuRef = useRef<HTMLDivElement | null>(null);
  const piecesMenuRef = useRef<HTMLDivElement | null>(null);

  const workspaceBoxes = project.workspaceBoxes ?? [];
  const panelVisibilityEntries = useMemo(() => {
    return workspaceBoxes.flatMap((box) => {
      return (Object.keys(panelLabels) as Array<"left" | "right" | "top" | "bottom" | "back">).map((panel) => {
        const panelKey = panelKeyByType[panel];
        const panelIdFromBox = box.panelIds?.[panelKey];
        const pieceId =
          typeof panelIdFromBox === "string" && panelIdFromBox.trim().length > 0
            ? panelIdFromBox
            : `${box.id}:${panel}`;
        return {
          id: pieceId,
          panel,
          boxId: box.id,
          boxName: box.nome,
          label: panelLabels[panel],
          searchText: `${box.nome} ${panelLabels[panel]} ${box.id}`.toLowerCase(),
        };
      });
    });
  }, [workspaceBoxes]);

  const filteredPanelVisibilityEntries = useMemo(() => {
    const query = pieceSearch.trim().toLowerCase();
    if (!query) return panelVisibilityEntries;
    return panelVisibilityEntries.filter((entry) => entry.searchText.includes(query));
  }, [panelVisibilityEntries, pieceSearch]);

  const actionsRef = useRef(actions);
  const viewerApiRef = useRef(viewerApi);
  useEffect(() => {
    actionsRef.current = actions;
    viewerApiRef.current = viewerApi;
  }, [actions, viewerApi]);

  // Sincronizar photoModeOpen com viewer e projeto apenas quando photoModeOpen mudar (não quando actions/viewerApi mudarem, para evitar loop).
  useEffect(() => {
    viewerApiRef.current?.setPhotoModeEnabled?.(photoModeOpen);
    actionsRef.current.setViewerSettings({ photoModeEnabled: photoModeOpen });
  }, [photoModeOpen]);

  useEffect(() => {
    if (!photoModeOpen && !backgroundMenuOpen && !materialMenuOpen && !ultraModeMenuOpen && !visibilityMenuOpen && !piecesMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!photoModeContainerRef.current?.contains(event.target as Node)) {
        setPhotoModeOpen(false);
      }
      if (!backgroundMenuRef.current?.contains(event.target as Node)) {
        setBackgroundMenuOpen(false);
      }
      if (!materialMenuRef.current?.contains(event.target as Node)) {
        setMaterialMenuOpen(false);
      }
      if (!ultraModeMenuRef.current?.contains(event.target as Node)) {
        setUltraModeMenuOpen(false);
      }
      if (!visibilityMenuRef.current?.contains(event.target as Node)) {
        setVisibilityMenuOpen(false);
      }
      if (!piecesMenuRef.current?.contains(event.target as Node)) {
        setPiecesMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [photoModeOpen, backgroundMenuOpen, materialMenuOpen, ultraModeMenuOpen, visibilityMenuOpen, piecesMenuOpen]);

  // Cleanup apenas no unmount: desativar photo mode. Refs evitam dep de actions/viewerApi que mudam a cada render.
  useEffect(() => {
    return () => {
      viewerApiRef.current?.setPhotoModeEnabled?.(false);
      actionsRef.current.setViewerSettings({ photoModeEnabled: false });
    };
  }, []);

  const handleAction = (id: ToolbarActionId) => {
    if (id === "reset-camera") {
      viewerApi?.resetCamera?.();
      return;
    }
    if (id === "projeto") {
      openModal("projects");
      return;
    }
    if (id === "novo") {
      localStorage.clear();
      window.location.reload();
      return;
    }
    if (id === "salvar") {
      actions.saveProjectSnapshot();
      return;
    }
    if (id === "desfazer") {
      actions.undo();
      return;
    }
    if (id === "refazer") {
      actions.redo();
      return;
    }
    if (id === "2d") {
      openModal("2d");
      return;
    }
    if (id === "enviar") {
      openModal("send");
      return;
    }
  };

  const toggleUltraPerformance = () => {
    const next = !ultraModeEnabled;
    actions.setViewerSettings({
      ultraPerformanceModeOptions: {
        ...project.viewerSettings.ultraPerformanceModeOptions,
        enabled: next,
      },
    });
  };

  const togglePhotoMenu = () => {
    setPhotoModeOpen((prev) => {
      const next = !prev;
      if (next) {
        setBackgroundMenuOpen(false);
        setMaterialMenuOpen(false);
        setUltraModeMenuOpen(false);
        setVisibilityMenuOpen(false);
        setPiecesMenuOpen(false);
      }
      return next;
    });
  };

  const toggleBackgroundMenu = () => {
    setBackgroundMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPhotoModeOpen(false);
        setMaterialMenuOpen(false);
        setUltraModeMenuOpen(false);
        setVisibilityMenuOpen(false);
        setPiecesMenuOpen(false);
      }
      return next;
    });
  };

  const toggleMaterialMenu = () => {
    setMaterialMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPhotoModeOpen(false);
        setBackgroundMenuOpen(false);
        setUltraModeMenuOpen(false);
        setVisibilityMenuOpen(false);
        setPiecesMenuOpen(false);
      }
      return next;
    });
  };

  const toggleUltraModeMenu = () => {
    setUltraModeMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPhotoModeOpen(false);
        setBackgroundMenuOpen(false);
        setMaterialMenuOpen(false);
        setVisibilityMenuOpen(false);
        setPiecesMenuOpen(false);
      }
      return next;
    });
  };

  const toggleVisibilityMenu = () => {
    setVisibilityMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPhotoModeOpen(false);
        setBackgroundMenuOpen(false);
        setMaterialMenuOpen(false);
        setUltraModeMenuOpen(false);
        setPiecesMenuOpen(false);
      }
      return next;
    });
  };

  const togglePiecesMenu = () => {
    setPiecesMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setPhotoModeOpen(false);
        setBackgroundMenuOpen(false);
        setMaterialMenuOpen(false);
        setUltraModeMenuOpen(false);
        setVisibilityMenuOpen(false);
      }
      return next;
    });
  };

  const toggleHiddenPanel = (panel: "left" | "right" | "top" | "bottom" | "back") => {
    const current = project.viewerSettings.hiddenPanels;
    const next = current.includes(panel)
      ? current.filter((item) => item !== panel)
      : [...current, panel];
    actions.setViewerSettings({ hiddenPanels: next });
  };

  const toggleHiddenPiece = (pieceId: string) => {
    const current = project.viewerSettings.hiddenPanels;
    const next = current.includes(pieceId)
      ? current.filter((item) => item !== pieceId)
      : [...current, pieceId];
    actions.setViewerSettings({ hiddenPanels: next });
  };

  const isPieceHidden = (pieceId: string, panel: "left" | "right" | "top" | "bottom" | "back") => {
    const hidden = project.viewerSettings.hiddenPanels;
    return hidden.includes(pieceId) || hidden.includes(panel);
  };

  const restoreDefaultVisualMode = () => {
    actions.setViewerSettings({
      backgroundMode: "studio",
      materialQuality: "standard",
      enableReflections: false,
      ultraPerformanceModeOptions: {
        enabled: false,
        mode: "balanced",
      },
    });
    setUltraModeMenuOpen(false);
  };

  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="Ações do Viewer">
      {VIEWER_TOOLBAR_ITEMS.map((item) => {
        if (item.id === "imagem") {
          return (
            <div key={item.id} ref={photoModeContainerRef} className="viewer-toolbar-popover-anchor">
              <button
                type="button"
                title={item.tooltip}
                aria-label={item.tooltip}
                aria-haspopup="dialog"
                aria-expanded={photoModeOpen}
                aria-pressed={photoModeOpen}
                onClick={togglePhotoMenu}
                style={{ fontSize: 12 }}
              >
                <span className="viewer-toolbar-icon" aria-hidden>
                  {item.icon}
                </span>
              </button>
              {photoModeOpen && (
                <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Photo Mode">
                  <PhotoModePopoverContent onClose={() => setPhotoModeOpen(false)} />
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            title={item.tooltip}
            aria-label={item.tooltip}
            onClick={() => handleAction(item.id)}
            style={{ fontSize: 12 }}
          >
            <span className="viewer-toolbar-icon" aria-hidden>
              {item.icon}
            </span>
          </button>
        );
      })}
      <RoomIconButton />
      <button
        type="button"
        title={ultraModeEnabled ? "Desativar Ultra Performance" : "Ativar Ultra Performance"}
        aria-label={ultraModeEnabled ? "Desativar Ultra Performance" : "Ativar Ultra Performance"}
        onClick={toggleUltraPerformance}
        style={{
          fontSize: 12,
          opacity: viewerApi ? 1 : 0.5,
        }}
      >
        <span
          className="viewer-toolbar-icon"
          aria-hidden
          style={{
            opacity: ultraModeEnabled ? 1 : 0.8,
            fontWeight: ultraModeEnabled ? 700 : 400,
            color: ultraModeEnabled ? "#facc15" : "inherit",
          }}
        >
          ⚡
        </span>
      </button>
      <div ref={backgroundMenuRef} className="viewer-toolbar-popover-anchor">
        <button
          type="button"
          title="Background"
          aria-label="Background"
          aria-haspopup="dialog"
          aria-expanded={backgroundMenuOpen}
          aria-pressed={backgroundMenuOpen}
          onClick={toggleBackgroundMenu}
          style={{ fontSize: 12 }}
        >
          <span className="viewer-toolbar-icon" aria-hidden>
            🌄
          </span>
        </button>
        {backgroundMenuOpen && (
          <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Background">
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, minWidth: 220 }}>
              Background
              <select
                value={project.viewerSettings.backgroundMode}
                onChange={(e) => actions.setViewerSettings({ backgroundMode: e.target.value as ViewerBackgroundMode })}
                className="input input-sm"
              >
                <option value="studio">Studio</option>
                <option value="white">White</option>
                <option value="dark">Dark</option>
                <option value="woodFloor">Wood Floor</option>
              </select>
            </label>
          </div>
        )}
      </div>
      <div ref={materialMenuRef} className="viewer-toolbar-popover-anchor">
        <button
          type="button"
          title="Qualidade de material"
          aria-label="Qualidade de material"
          aria-haspopup="dialog"
          aria-expanded={materialMenuOpen}
          aria-pressed={materialMenuOpen}
          onClick={toggleMaterialMenu}
          style={{ fontSize: 12 }}
        >
          <span className="viewer-toolbar-icon" aria-hidden>
            ✨
          </span>
        </button>
        {materialMenuOpen && (
          <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Qualidade de material">
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, minWidth: 220 }}>
              Qualidade de material
              <select
                value={project.viewerSettings.materialQuality}
                onChange={(e) => actions.setViewerSettings({ materialQuality: e.target.value as ViewerMaterialQuality })}
                className="input input-sm"
              >
                <option value="standard">Standard</option>
                <option value="premium">Premium (PBR)</option>
                <option value="lacquered">Lacado</option>
              </select>
            </label>
          </div>
        )}
      </div>
      <div ref={ultraModeMenuRef} className="viewer-toolbar-popover-anchor">
        <button
          type="button"
          title="Modo Ultra"
          aria-label="Modo Ultra"
          aria-haspopup="dialog"
          aria-expanded={ultraModeMenuOpen}
          aria-pressed={ultraModeMenuOpen}
          onClick={toggleUltraModeMenu}
          style={{ fontSize: 12 }}
        >
          <span className="viewer-toolbar-icon" aria-hidden>
            ⚙
          </span>
        </button>
        {ultraModeMenuOpen && (
          <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Modo Ultra">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 240 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                Modo Ultra
                <select
                  value={project.viewerSettings.ultraPerformanceModeOptions.mode}
                  onChange={(e) =>
                    actions.setViewerSettings({
                      ultraPerformanceModeOptions: {
                        ...project.viewerSettings.ultraPerformanceModeOptions,
                        mode: e.target.value as UltraPerformanceInternalMode,
                      },
                    })
                  }
                  className="input input-sm"
                >
                  <option value="balanced">Balanced</option>
                  <option value="flat2">Flat 2.0</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </label>
              <button
                type="button"
                className="button button-ghost"
                style={{ fontSize: 12, padding: "6px 10px", width: "100%" }}
                onClick={restoreDefaultVisualMode}
              >
                Restaurar visual padrão
              </button>
            </div>
          </div>
        )}
      </div>
      <div ref={visibilityMenuRef} className="viewer-toolbar-popover-anchor">
        <button
          type="button"
          title="Opções de visualização"
          aria-label="Opções de visualização"
          aria-haspopup="dialog"
          aria-expanded={visibilityMenuOpen}
          aria-pressed={visibilityMenuOpen}
          onClick={toggleVisibilityMenu}
          style={{ fontSize: 12 }}
        >
          <span className="viewer-toolbar-icon" aria-hidden>
            ☑
          </span>
        </button>
        {visibilityMenuOpen && (
          <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Opções de visualização">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={project.viewerSettings.showPanelEdges}
                  onChange={(e) => actions.setViewerSettings({ showPanelEdges: e.target.checked })}
                />
                Mostrar arestas dos painéis
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={project.viewerSettings.hideAllPanels}
                  onChange={(e) => actions.setViewerSettings({ hideAllPanels: e.target.checked })}
                />
                Esconder todos os painéis
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={project.viewerSettings.showCeiling}
                  onChange={(e) => actions.setViewerSettings({ showCeiling: e.target.checked })}
                />
                Mostrar teto da sala
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={project.viewerSettings.wallEditMode}
                  onChange={(e) => actions.setViewerSettings({ wallEditMode: e.target.checked })}
                />
                Modo edição de paredes
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={project.viewerSettings.enableReflections}
                  onChange={(e) => actions.setViewerSettings({ enableReflections: e.target.checked })}
                />
                Reflexos dinâmicos (probe)
              </label>
            </div>
          </div>
        )}
      </div>
      <div ref={piecesMenuRef} className="viewer-toolbar-popover-anchor">
        <button
          type="button"
          title="Peças (painéis)"
          aria-label="Peças (painéis)"
          aria-haspopup="dialog"
          aria-expanded={piecesMenuOpen}
          aria-pressed={piecesMenuOpen}
          onClick={togglePiecesMenu}
          style={{ fontSize: 12 }}
        >
          <span className="viewer-toolbar-icon" aria-hidden>
            🧱
          </span>
        </button>
        {piecesMenuOpen && (
          <div className="viewer-toolbar-popover-panel" role="dialog" aria-label="Peças (painéis)">
            <div style={{ minWidth: 340 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 12 }}>Peças (painéis)</strong>
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => actions.setViewerSettings({ hiddenPanels: [] })}
                >
                  Mostrar tudo
                </button>
              </div>
              <input
                className="input input-sm"
                placeholder="Buscar peça (caixa ou painel)"
                value={pieceSearch}
                onChange={(event) => setPieceSearch(event.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(Object.keys(panelLabels) as Array<"left" | "right" | "top" | "bottom" | "back">).map((panel) => {
                  const isHidden = project.viewerSettings.hiddenPanels.includes(panel);
                  return (
                    <button
                      key={`toolbar-panel-toggle-${panel}`}
                      type="button"
                      className="button button-ghost"
                      style={{ fontSize: 11, padding: "4px 8px", opacity: isHidden ? 0.65 : 1 }}
                      onClick={() => toggleHiddenPanel(panel)}
                    >
                      {isHidden ? "Mostrar" : "Esconder"} todas: {panelLabels[panel]}
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {filteredPanelVisibilityEntries.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Nenhuma peça encontrada.</div>
                ) : (
                  filteredPanelVisibilityEntries.map((entry) => {
                    const hiddenGlobally = project.viewerSettings.hiddenPanels.includes(entry.panel);
                    const hidden = isPieceHidden(entry.id, entry.panel);
                    return (
                      <label
                        key={`toolbar-panel-piece-${entry.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 11,
                          opacity: hidden ? 0.65 : 1,
                        }}
                      >
                        <span style={{ color: "var(--text-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.boxName} · {entry.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={!hidden}
                          disabled={hiddenGlobally}
                          onChange={() => toggleHiddenPiece(entry.id)}
                          title={
                            hiddenGlobally
                              ? "Tipo de painel está escondido globalmente"
                              : hidden
                                ? "Mostrar peça"
                                : "Esconder peça"
                          }
                        />
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="viewer-toolbar-action-container">
        <button
          type="button"
          className="button button-primary viewer-action-button"
          onClick={() => actions.gerarDesign()}
          disabled={project.estaCarregando}
          style={{
            background: project.estaCarregando
              ? "rgba(59, 130, 246, 0.5)"
              : "var(--blue-light)",
            cursor: project.estaCarregando ? "not-allowed" : "pointer",
          }}
        >
          {project.estaCarregando ? "A Calcular..." : "Gerar Design 3D"}
        </button>
      </div>
    </div>
  );
}
