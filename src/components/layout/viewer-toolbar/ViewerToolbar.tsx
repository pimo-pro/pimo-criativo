/**
 * Toolbar superior do Viewer.
 * Ícones com cor clara (#f1f5f9) e hover (#ffffff); ações ligadas a viewerSync/actions/openModal.
 * PROJETO → modal projetos; SALVAR → saveProjectSnapshot (inclui viewerSync.saveViewerSnapshot);
 * DESFAZER/REFAZER → undo/redo; 2D/IMAGEM/ENVIAR → modais que usam viewerSync no RightToolsBar.
 */

import { useState, useEffect } from "react";
import { useProject } from "../../../context/useProject";
import { useToolbarModal } from "../../../context/ToolbarModalContext";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { VIEWER_TOOLBAR_ITEMS } from "../../../constants/toolbarConfig";
import type { ToolbarActionId } from "../../../constants/toolbarConfig";

export default function ViewerToolbar() {
  const { actions, viewerSync } = useProject();
  const { openModal } = useToolbarModal();
  const { viewerApi } = usePimoViewerContext();
  const [ultraModeEnabled, setUltraModeEnabled] = useState(false);

  useEffect(() => {
    if (viewerSync?.getUltraPerformanceMode) {
      setUltraModeEnabled(viewerSync.getUltraPerformanceMode());
    }
  }, [viewerSync]);

  const handleAction = (id: ToolbarActionId) => {
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
    if (id === "imagem") {
      openModal("image");
      return;
    }
    if (id === "enviar") {
      openModal("send");
      return;
    }
  };

  const toggleUltraPerformance = () => {
    if (!viewerSync?.setUltraPerformanceMode) return;
    const next = !ultraModeEnabled;
    viewerSync.setUltraPerformanceMode(next);
    setUltraModeEnabled(next);
  };

  return (
    <div className="viewer-toolbar" role="toolbar" aria-label="Ações do Viewer">
      {VIEWER_TOOLBAR_ITEMS.map((item) => (
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
      ))}
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
    </div>
  );
}
