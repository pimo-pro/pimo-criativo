import { DesignerEngine } from "../designer/DesignerEngine";

export function createViewerDesignerEngine(_controller?: unknown): DesignerEngine {
  return new DesignerEngine();
}

export function ensureViewerDesignerEngine(
  current: DesignerEngine | null,
  _controller?: unknown
): DesignerEngine {
  return current ?? createViewerDesignerEngine(_controller);
}

