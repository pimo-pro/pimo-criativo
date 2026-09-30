import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { syncActiveViewerCanvasSize } from "../core/viewer/pimoViewerRuntime";
import {
  RIGHT_PANEL_WIDTH_DEFAULT,
  RIGHT_PANEL_WIDTH_MAX,
  RIGHT_PANEL_WIDTH_MIN,
} from "../layout/layoutTokens";

export { RIGHT_PANEL_WIDTH_DEFAULT, RIGHT_PANEL_WIDTH_MAX, RIGHT_PANEL_WIDTH_MIN };
export const RIGHT_PANEL_DOM_ID = "pimo-right-panel";

export function clampRightPanelWidth(value: number): number {
  return Math.min(RIGHT_PANEL_WIDTH_MAX, Math.max(RIGHT_PANEL_WIDTH_MIN, value));
}

export function useRightPanelChrome() {
  const [rightOpen, setRightOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(RIGHT_PANEL_WIDTH_DEFAULT);
  const resizeState = useRef({
    active: false,
    startX: 0,
    startWidth: RIGHT_PANEL_WIDTH_DEFAULT,
  });

  const openRightPanel = useCallback(() => {
    setRightOpen(true);
  }, []);

  const collapseRightPanel = useCallback(() => {
    setRightOpen(false);
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!rightOpen) return;
      resizeState.current = {
        active: true,
        startX: event.clientX,
        startWidth: rightWidth,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [rightOpen, rightWidth]
  );

  const handleResizeMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeState.current.active) return;
    // Bordo interno: arrastar para a esquerda aumenta a largura do painel.
    const delta = resizeState.current.startX - event.clientX;
    setRightWidth(clampRightPanelWidth(resizeState.current.startWidth + delta));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeState.current.active = false;
    syncActiveViewerCanvasSize();
  }, []);

  const handlePanelTransitionEnd = useCallback((event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "width") return;
    if (event.target !== event.currentTarget) return;
    syncActiveViewerCanvasSize();
  }, []);

  const panelShellStyle: CSSProperties = {
    width: rightOpen ? rightWidth : 0,
    minWidth: rightOpen ? rightWidth : 0,
    maxWidth: rightOpen ? rightWidth : 0,
    overflow: "hidden",
    transition: "width 0.2s ease",
    position: "relative",
  };

  return {
    rightOpen,
    rightWidth,
    openRightPanel,
    collapseRightPanel,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handlePanelTransitionEnd,
    panelShellStyle,
  };
}
