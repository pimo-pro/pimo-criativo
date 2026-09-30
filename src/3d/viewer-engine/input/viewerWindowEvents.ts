export type ViewerWindowEventHandlers = {
  resize: () => void;
  keydown: (_event: KeyboardEvent) => void;
  keyup: (_event: KeyboardEvent) => void;
};

export type RegisterViewerWindowEventsOptions = {
  /** Container WebGL — observado para sync quando o flex muda (ex.: panel-resizer). */
  container?: HTMLElement | null;
};

export function registerViewerWindowEvents(
  handlers: ViewerWindowEventHandlers,
  options: RegisterViewerWindowEventsOptions = {}
): () => void {
  window.addEventListener("resize", handlers.resize);
  window.addEventListener("keydown", handlers.keydown);
  window.addEventListener("keyup", handlers.keyup);

  let lastW = -1;
  let lastH = -1;
  let resizeObserver: ResizeObserver | null = null;
  const container = options.container ?? null;

  if (container && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      handlers.resize();
    });
    resizeObserver.observe(container);
  }

  return () => {
    window.removeEventListener("resize", handlers.resize);
    window.removeEventListener("keydown", handlers.keydown);
    window.removeEventListener("keyup", handlers.keyup);
    resizeObserver?.disconnect();
    resizeObserver = null;
  };
}
