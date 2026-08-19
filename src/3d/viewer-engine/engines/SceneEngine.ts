import { SceneEngine } from "../scene/SceneEngine";
import type { SceneManager } from "../scene/SceneManager";

export function createViewerSceneEngine(controller: SceneManager): SceneEngine {
  return new SceneEngine(controller);
}

export function ensureViewerSceneEngine(
  current: SceneEngine | null,
  controller: SceneManager,
): SceneEngine {
  return current ?? createViewerSceneEngine(controller);
}

