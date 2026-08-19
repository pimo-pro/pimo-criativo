import { SnapEngine } from "../snapping/SnapEngine";
import type { SnapEngineDeps } from "../snapping/SnapEngine";

export function createViewerSnapEngine(controller: SnapEngineDeps): SnapEngine {
  return new SnapEngine(controller);
}

export function ensureViewerSnapEngine(current: SnapEngine | null, controller: SnapEngineDeps): SnapEngine {
  return current ?? createViewerSnapEngine(controller);
}

