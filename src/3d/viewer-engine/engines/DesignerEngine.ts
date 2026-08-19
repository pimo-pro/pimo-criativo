import { DesignerEngine } from "../designer/DesignerEngine";

export function createViewerDesignerEngine(_controller?: any): DesignerEngine {
  return new DesignerEngine();
}

export function ensureViewerDesignerEngine(
  current: DesignerEngine | null,
  _controller?: any
): DesignerEngine {
  return current ?? createViewerDesignerEngine(_controller);
}

