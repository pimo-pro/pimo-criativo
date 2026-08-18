/**
 * CameraEngine (Z-01.2.7 B) — presets de vista sobre CameraManager.
 */
import type { CameraManager } from "./CameraManager";

export type CameraViewPreset = "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric";

export type CameraOrbitTarget = {
  set: (_x: number, _y: number, _z: number) => void;
};

export function computeCameraPresetPosition(
  center: { x: number; y: number; z: number },
  dist: number,
  preset: CameraViewPreset
): { x: number; y: number; z: number } {
  switch (preset) {
    case "front":
      return { x: center.x, y: center.y, z: center.z + dist };
    case "back":
      return { x: center.x, y: center.y, z: center.z - dist };
    case "left":
      return { x: center.x - dist, y: center.y, z: center.z };
    case "right":
      return { x: center.x + dist, y: center.y, z: center.z };
    case "top":
      return { x: center.x, y: center.y + dist, z: center.z };
    case "bottom":
      return { x: center.x, y: center.y - dist, z: center.z };
    case "isometric":
    default: {
      const d = dist * 0.9;
      return { x: center.x + d, y: center.y + d * 0.8, z: center.z + d };
    }
  }
}

export class CameraEngine {
  preset: CameraViewPreset | null = null;
  readonly manager: CameraManager;

  constructor(manager: CameraManager) {
    this.manager = manager;
  }

  get camera() {
    return this.manager.camera;
  }

  applyPreset(
    preset: CameraViewPreset,
    center: { x: number; y: number; z: number },
    dist: number,
    orbit?: CameraOrbitTarget | null
  ): void {
    this.manager.setTarget(center.x, center.y, center.z);
    const pos = computeCameraPresetPosition(center, dist, preset);
    this.manager.setPosition(pos.x, pos.y, pos.z);
    orbit?.set(center.x, center.y, center.z);
    this.preset = preset;
  }

  clearPreset(): void {
    this.preset = null;
  }
}
