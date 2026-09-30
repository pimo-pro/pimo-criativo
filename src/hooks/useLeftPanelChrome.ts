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
  LEFT_PANEL_WIDTH_DEFAULT,
  LEFT_PANEL_WIDTH_MAX,
  LEFT_PANEL_WIDTH_MIN,
} from "../layout/layoutTokens";

export { LEFT_PANEL_WIDTH_DEFAULT, LEFT_PANEL_WIDTH_MAX, LEFT_PANEL_WIDTH_MIN };
export const LEFT_PANEL_DOM_ID = "pimo-left-panel";

export function clampLeftPanelWidth(value: number): number {
  return Math.min(LEFT_PANEL_WIDTH_MAX, Math.max(LEFT_PANEL_WIDTH_MIN, value));
}

type UseLeftPanelChromeOptions = {
  /** Força painel aberto (ex.: Photo Mode / Sala). */
  forceOpen?: boolean;
};

export function useLeftPanelChrome(options: UseLeftPanelChromeOptions = {}) {
  const { forceOpen = false } = options;
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(LEFT_PANEL_WIDTH_DEFAULT);
  const resizeState = useRef({
    active: false,
    startX: 0,
    startWidth: LEFT_PANEL_WIDTH_DEFAULT,
  });

  // Ajuste de estado no render (em vez de effect) quando Photo Mode / Sala forçam abertura.
  if (forceOpen && !leftOpen) {
    setLeftOpen(true);
  }

  const openLeftPanel = useCallback(() => {
    setLeftOpen(true);
  }, []);

  const collapseLeftPanel = useCallback(() => {
    setLeftOpen(false);
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!leftOpen) return;
      resizeState.current = {
        active: true,
        startX: event.clientX,
        startWidth: leftWidth,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [leftOpen, leftWidth]
  );

  const handleResizeMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeState.current.active) return;
    const delta = event.clientX - resizeState.current.startX;
    setLeftWidth(clampLeftPanelWidth(resizeState.current.startWidth + delta));
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
    width: leftOpen ? leftWidth : 0,
    minWidth: leftOpen ? leftWidth : 0,
    maxWidth: leftOpen ? leftWidth : 0,
    overflow: "hidden",
    transition: "width 0.2s ease",
    position: "relative",
  };

  return {
    leftOpen,
    leftWidth,
    openLeftPanel,
    collapseLeftPanel,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handlePanelTransitionEnd,
    panelShellStyle,
  };
}
