import { CameraEngine } from "../camera/CameraEngine";
import type { CameraManager } from "../camera/CameraManager";

export function createViewerCameraEngine(controller: CameraManager): CameraEngine {
  return new CameraEngine(controller);
}

export function ensureViewerCameraEngine(
  current: CameraEngine | null,
  controller: CameraManager,
): CameraEngine {
  return current ?? createViewerCameraEngine(controller);
}

