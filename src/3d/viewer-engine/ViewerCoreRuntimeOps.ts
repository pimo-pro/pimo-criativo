import * as THREE from "three";
import type { SnapDebugData } from "../snapping/ModelWallSnap";
import type { SnapDebugOverlay } from "../../debug/SnapDebugOverlay";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { Lights } from "./lighting";
import type { DisplayQualityLevel } from "./lighting/LightingEngine";
import { shouldCastKeyShadow } from "./lighting/LightingEngine";
import type { CameraManager } from "./camera";
import type { RendererManager } from "./renderer";
import type { Controls } from "./controls";
import type { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import type { ViewerRuntimeLoop } from "./runtime/ViewerRuntimeLoop";
import type { MeasurementEngine } from "./measurement/MeasurementEngine";
import type { SmartSnapping } from "./snapping/SmartSnapping";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";

export type ViewerCoreRuntimeOpsDeps = {
  rendererManager: RendererManager;
  cameraManager: CameraManager;
  lights: Lights;
  getControls: () => Controls | null;
  getUltraPerformanceMode: () => boolean;
  getReflectionsEnabled: () => boolean;
  resolveDisplayQualityLevel: () => DisplayQualityLevel;
  getDiagnosticsLogged: () => boolean;
  setDiagnosticsLogged: (logged: boolean) => void;
  getReflectionFrameCounter: () => number;
  setReflectionFrameCounter: (value: number) => void;
  getReflectionUpdateIntervalFrames: () => number;
  getWallGizmo: () => WallGizmo | null;
  getSnapDebugOverlay: () => SnapDebugOverlay | null;
  getLastSnapDebugData: () => SnapDebugData | null;
  overlayCoordinator: ViewerOverlayCoordinator;
  runtimeLoop: ViewerRuntimeLoop;
  measurementEngine: MeasurementEngine;
  smartSnappingEngine: SmartSnapping;
  smartAlignOverlay: SmartAlignOverlayFacade;
  lerpLightsToTarget: () => void;
  updateDimensionsOverlay: () => void;
  updateWallVisibilityBasedOnCamera: () => void;
  updateSelectionOverlaysFrame: () => void;
  updateReflectionProbe: (force?: boolean) => void;
};

export function requestRenderImpl(deps: ViewerCoreRuntimeOpsDeps): void {
  deps.runtimeLoop.requestRender();
}

export function startRuntimeImpl(deps: ViewerCoreRuntimeOpsDeps): void {
  deps.runtimeLoop.start();
}

export function updateCanvasSizeImpl(deps: ViewerCoreRuntimeOpsDeps): void {
  deps.runtimeLoop.onResize();
  deps.measurementEngine.resize();
  deps.smartSnappingEngine.resize();
  deps.smartAlignOverlay.resize();
}

export function onBeforeRenderTickImpl(deps: ViewerCoreRuntimeOpsDeps): void {
  if (!deps.getDiagnosticsLogged()) {
    deps.setDiagnosticsLogged(true);
    const exp = deps.rendererManager.renderer.toneMappingExposure;
    if (exp <= 0) {
      deps.rendererManager.renderer.toneMappingExposure = 1.05;
    }
    const { keyLight, fillLight, ambient, hemisphere } = deps.lights;
    if (keyLight.intensity <= 0) keyLight.intensity = 0.55;
    if (fillLight.intensity <= 0) fillLight.intensity = 0.15;
    if (ambient.intensity <= 0) ambient.intensity = 0.4;
    if (hemisphere.intensity <= 0) hemisphere.intensity = 0.35;
  }
  if (deps.cameraManager.camera.position.y < 0.3) {
    deps.cameraManager.camera.position.y = 0.3;
  }
  deps.getControls()?.update();
  if (!deps.getUltraPerformanceMode()) {
    const r = deps.rendererManager.renderer;
    r.shadowMap.enabled = true;
    if (r.shadowMap.type !== THREE.PCFSoftShadowMap) r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Uma fonte de verdade: mesmo nível que DisplayOps.resolveDisplayQualityLevelImpl.
    deps.lights.keyLight.castShadow = shouldCastKeyShadow(deps.resolveDisplayQualityLevel());
  }
  deps.lerpLightsToTarget();
  deps.updateDimensionsOverlay();
  deps.updateWallVisibilityBasedOnCamera();
  deps.getWallGizmo()?.update();
  const snapDebugOverlay = deps.getSnapDebugOverlay();
  const lastSnapDebugData = deps.getLastSnapDebugData();
  if (snapDebugOverlay && lastSnapDebugData) {
    snapDebugOverlay.update(lastSnapDebugData);
  }
  deps.updateSelectionOverlaysFrame();
  deps.overlayCoordinator.refreshFrame(performance.now());

  if (deps.getReflectionsEnabled()) {
    const next = deps.getReflectionFrameCounter() + 1;
    if (next >= deps.getReflectionUpdateIntervalFrames()) {
      deps.setReflectionFrameCounter(0);
      deps.updateReflectionProbe(false);
    } else {
      deps.setReflectionFrameCounter(next);
    }
  }
}
