/**
 * Botões da toolbar superior da área de visualização (zoom/vista 3D / industrial).
 * Integrado em UnifiedTopToolbar, imediatamente antes do atalho de sala.
 */

import { useCallback } from "react";
import { Icon } from "@/components/icons";
import { usePimoViewerContext } from "@/hooks/usePimoViewerContext";
import { useUiStore } from "@/stores/uiStore";
import {
  applyIndustrialDesignToolbarToggle,
  buildIndustrialDesignToolbarDeps,
  isIndustrialDesignToolbarActive,
  nextIndustrialDesignToolbarEnabled,
} from "./industrialDesignToolbarToggle";

const TOOLBAR_BTN = {
  width: 28,
  height: 28,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  border: "none" as const,
  borderRadius: 4,
  cursor: "pointer" as const,
  marginLeft: 3,
};

const INACTIVE_COLOR = "#64748b";
const ACTIVE_COLOR = "#3b82f6";

export function IndustrialDesignToolbarButton() {
  const { viewerApi, viewerReady } = usePimoViewerContext();
  const panelOpen = useUiStore((s) => s.industrialDesignPanelOpen);
  const setIndustrialDesignPanelOpen = useUiStore((s) => s.setIndustrialDesignPanelOpen);

  const isActive = isIndustrialDesignToolbarActive(
    panelOpen,
    viewerApi.getIndustrialDesignWorkspaceEnabled
  );

  const handleToggle = useCallback(() => {
    if (!viewerReady) return;
    const next = nextIndustrialDesignToolbarEnabled(isActive);
    const deps = buildIndustrialDesignToolbarDeps(viewerApi, setIndustrialDesignPanelOpen);
    applyIndustrialDesignToolbarToggle(deps, next, { viewerReady });
  }, [isActive, setIndustrialDesignPanelOpen, viewerApi, viewerReady]);

  return (
    <button
      type="button"
      className="viewer-action-icon"
      title={viewerReady ? "Design Industrial" : "Design Industrial (a aguardar viewer…)"}
      aria-label="Design Industrial"
      aria-pressed={isActive}
      aria-disabled={!viewerReady}
      disabled={!viewerReady}
      onClick={handleToggle}
      style={{
        ...TOOLBAR_BTN,
        background: isActive ? "rgba(59, 130, 246, 0.18)" : "transparent",
        boxShadow: isActive ? "inset 0 0 0 1px rgba(59, 130, 246, 0.45)" : undefined,
        color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
        opacity: viewerReady ? 1 : 0.45,
        cursor: viewerReady ? "pointer" : "not-allowed",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--viewer-toolbar-hover-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? "rgba(59, 130, 246, 0.18)" : "transparent";
      }}
    >
      <Icon name="industrialDesign" size={24} aria-hidden />
    </button>
  );
}

/** Secção da toolbar do viewer — Design Industrial (e futuros atalhos industriais). */
export default function WorkspaceToolbar() {
  return <IndustrialDesignToolbarButton />;
}
