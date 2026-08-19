import { ComposerEngine } from "../lighting/ComposerEngine";
import type { ComposerEngineDeps } from "../lighting/ComposerEngine";

export function createViewerComposerEngine(controller: ComposerEngineDeps): ComposerEngine {
  return new ComposerEngine(controller);
}

export function ensureViewerComposerEngine(
  current: ComposerEngine | null,
  controller: ComposerEngineDeps,
): ComposerEngine {
  return current ?? createViewerComposerEngine(controller);
}

