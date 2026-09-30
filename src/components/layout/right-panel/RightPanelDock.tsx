import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import MaterialPanel from "./MaterialPanel";
import {
  RIGHT_PANEL_DOM_ID,
  useRightPanelChrome,
} from "../../../hooks/useRightPanelChrome";

export type RightPanelDockProps = {
  children?: ReactNode;
};

/**
 * Chrome do dock direito: collapse/reopen, resizer interno e conteúdo (Materiais por omissão).
 */
export default function RightPanelDock({ children }: RightPanelDockProps) {
  const {
    rightOpen,
    openRightPanel,
    collapseRightPanel,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handlePanelTransitionEnd,
    panelShellStyle,
  } = useRightPanelChrome();

  return (
    <>
      {!rightOpen && (
        <button
          type="button"
          className="right-panel-reopen-btn"
          aria-label="Expandir painel direito"
          aria-expanded="false"
          aria-controls={RIGHT_PANEL_DOM_ID}
          onClick={openRightPanel}
        >
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }} aria-hidden="true">
            <Icon name="chevronRight" size={14} />
          </span>
        </button>
      )}
      <div
        id={RIGHT_PANEL_DOM_ID}
        className="panel panel-shell panel-shell--side right-panel panel-shell-right"
        style={panelShellStyle}
        onTransitionEnd={handlePanelTransitionEnd}
        aria-hidden={!rightOpen}
      >
        {rightOpen && (
          <>
            <div
              className="panel-resizer panel-resizer--right"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
            />
            <button
              type="button"
              className="right-panel-collapse-btn"
              aria-label="Recolher painel direito"
              aria-expanded="true"
              aria-controls={RIGHT_PANEL_DOM_ID}
              onClick={collapseRightPanel}
            >
              <Icon name="chevronRight" size={16} aria-hidden />
            </button>
          </>
        )}
        <div className="left-panel-content">
          <div className="left-panel-scroll">
            <aside className="panel-content panel-content--side">
              {children ?? <MaterialPanel />}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
