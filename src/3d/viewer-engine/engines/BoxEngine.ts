import { BoxEngine } from "../box/BoxEngine";
import type { BoxSceneController } from "../box/BoxSceneController";

export function createViewerBoxEngine(controller: BoxSceneController): BoxEngine {
  return new BoxEngine(controller);
}

export function ensureViewerBoxEngine(
  current: BoxEngine | null,
  controller: BoxSceneController,
): BoxEngine {
  return current ?? createViewerBoxEngine(controller);
}
