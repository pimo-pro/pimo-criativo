/**
 * Toolbar de ferramentas 3D (segunda linha).
 * Select, Move, Rotate ligados ao viewerApiAdapter (setTool → setTransformMode).
 * activeTool controlado pelo estado global (project.activeViewerTool).
 */

import { TOOLS_3D_ITEMS } from "../../../constants/toolbarConfig";
import type { Tool3DId } from "../../../constants/toolbarConfig";

export type Tools3DToolbarProps = {
  /** Ferramenta ativa (controlado pelo estado global). */
  activeTool?: Tool3DId;
  /** Chamado ao clicar numa ferramenta; aplica ao viewer via actions.setActiveTool. */
  onToolSelect?: (toolId: Tool3DId, eventKey: string) => void;
};

export default function Tools3DToolbar({ activeTool = "select", onToolSelect }: Tools3DToolbarProps) {
  const enabledTools: Tool3DId[] = ["select", "move", "rotate"];

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
    </div>
  );
}
