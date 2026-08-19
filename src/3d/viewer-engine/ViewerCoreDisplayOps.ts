import * as THREE from "three";
import type {
  UltraPerformanceModeOptions,
  ViewerBackgroundMode,
  ViewerMaterialQuality,
} from "../../context/projectTypes";
import type { ViewerState } from "./state/ViewerState";
import type { LightingEngine } from "./lighting/LightingEngine";
import type { ComposerEngine } from "./lighting/ComposerEngine";
import type { Lights } from "./lighting/Lights";
import type { RendererManager } from "./renderer/RendererManager";
import type { SceneEngine } from "./scene/SceneEngine";
import type { SceneManager } from "./scene/SceneManager";
import type { DisplayMaterialController } from "./materials/displayMaterialController";
import type { UltraMaterialController } from "./materials/ultraMaterialController";
import type { MaterialPipelineFacade } from "./materials/materialPipelineFacade";
import type { MaterialMode } from "./materials/types";
import type { ViewerBoxEntry } from "./types";
import type { ViewerCoreRoomBounds } from "./ViewerCoreRoomUtils";
import {
  normalizeViewerMaterialQuality,
  resolveMaterialModeForQuality,
} from "./materials/materialQualityMode";
import { getRoomFloorOverlayAppearance } from "./materials/roomFloorOverlay";
import { runWithAllLayoutBoundsProxiesVisible } from "./box/boxAabbUtils";

export type UltraRenderStateSnapshot = {
  materialQuality: ViewerMaterialQuality;
  reflectionsEnabled: boolean;
  toneMappingExposure: number;
};

export type ViewerCoreDisplayOpsDeps = {
  viewerState: ViewerState;
  getTurntableEnabled: () => boolean;
  setTurntableEnabled: (enabled: boolean) => void;
  isMobile: boolean;
  lights: Lights;
  ensureLightingEngine: () => LightingEngine;
  getLightingEngine: () => LightingEngine | null;
  ensureComposerEngine: () => ComposerEngine;
  getComposerEngine: () => ComposerEngine | null;
  getUltraPerformanceMode: () => boolean;
  setUltraPerformanceModeFlag: (active: boolean) => void;
  getUltraPerformanceModeOptions: () => UltraPerformanceModeOptions;
  setUltraPerformanceModeOptionsState: (options: UltraPerformanceModeOptions) => void;
  getUltraRenderState: () => UltraRenderStateSnapshot | null;
  setUltraRenderState: (state: UltraRenderStateSnapshot | null) => void;
  getMaterialQuality: () => ViewerMaterialQuality;
  setMaterialQualityState: (quality: ViewerMaterialQuality) => void;
  getReflectionsEnabled: () => boolean;
  setReflectionsEnabledState: (enabled: boolean) => void;
  getPhotoModeEnabled: () => boolean;
  setPhotoModeEnabledState: (enabled: boolean) => void;
  getMatteMode: () => boolean;
  setMatteModeState: (enabled: boolean) => void;
  getBackgroundMode: () => ViewerBackgroundMode;
  setBackgroundModeState: (mode: ViewerBackgroundMode) => void;
  getGlossIntensity: () => number;
  setGlossIntensityState: (value: number) => void;
  getReflectionUpdateIntervalFrames: () => number;
  setReflectionUpdateIntervalFrames: (frames: number) => void;
  baseToneMappingExposure: number;
  defaultPixelRatio: number;
  rendererManager: RendererManager;
  sceneEngine: SceneEngine;
  sceneManager: SceneManager;
  getRoomBoxFloor: () => THREE.Mesh | null;
  getRoomBoxFloorOutline: () => THREE.LineLoop | null;
  displayMaterials: DisplayMaterialController;
  ultraMaterials: UltraMaterialController;
  materialPipeline: MaterialPipelineFacade;
  getRoomBounds: () => ViewerCoreRoomBounds | null;
  boxes: Map<string, ViewerBoxEntry>;
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  setMaterialMode: (mode: MaterialMode) => void;
  updateCanvasSize: () => void;
  requestRender: () => void;
};

export function getCurrentModeImpl(deps: ViewerCoreDisplayOpsDeps): "performance" | "showcase" {
  return deps.viewerState.getCurrentMode();
}

export function setModeImpl(
  deps: ViewerCoreDisplayOpsDeps,
  mode: "performance" | "showcase",
  turntable = false
): void {
  deps.viewerState.setCurrentMode(mode);
  deps.setTurntableEnabled(mode === "showcase" && turntable);
  deps.lights.setShadowMapSize(deps.isMobile ? 1024 : 4096);
  if (mode === "showcase") {
    deps.ensureComposerEngine().setMode("showcase");
  } else {
    deps.getComposerEngine()?.setMode("performance");
  }
  syncDisplayQualityVisualPipelineImpl(deps);
}

export function setShowcaseModeImpl(
  deps: ViewerCoreDisplayOpsDeps,
  active: boolean,
  turntable = false
): void {
  setModeImpl(deps, active ? "showcase" : "performance", turntable);
}

export function getShowcaseModeImpl(deps: ViewerCoreDisplayOpsDeps): boolean {
  return deps.viewerState.getCurrentMode() === "showcase";
}

export function setGlobalLightIntensityImpl(deps: ViewerCoreDisplayOpsDeps, value: number): void {
  deps.ensureLightingEngine().applyGlobalIntensity(value, deps.getUltraPerformanceMode());
  syncDisplayQualityVisualPipelineImpl(deps);
}

export function getGlobalLightIntensityImpl(deps: ViewerCoreDisplayOpsDeps): number {
  return deps.getLightingEngine()?.globalIntensity ?? 1;
}

export function updateShadowIntensityImpl(deps: ViewerCoreDisplayOpsDeps, value: number): void {
  deps.ensureLightingEngine().applyShadowIntensity(value);
  syncDisplayQualityVisualPipelineImpl(deps);
  deps.requestRender();
}

export function getShadowIntensityImpl(deps: ViewerCoreDisplayOpsDeps): number {
  return deps.getLightingEngine()?.shadowIntensity ?? 1;
}

export function setUltraPerformanceModeImpl(deps: ViewerCoreDisplayOpsDeps, active: boolean): void {
  if (deps.getUltraPerformanceMode() === active) return;
  deps.setUltraPerformanceModeFlag(active);
  deps.setUltraPerformanceModeOptionsState({
    ...deps.getUltraPerformanceModeOptions(),
    enabled: active,
  });

  const mode = deps.getUltraPerformanceModeOptions().mode;
  const isAggressive = mode === "aggressive";
  const isFlat2 = mode === "flat2";

  if (active) {
    deps.ensureLightingEngine().beginUltraLights(isAggressive);
    deps.setReflectionUpdateIntervalFrames(deps.isMobile ? 30 : 18);

    if (!deps.getUltraRenderState()) {
      deps.setUltraRenderState({
        materialQuality: deps.getMaterialQuality(),
        reflectionsEnabled: deps.getReflectionsEnabled(),
        toneMappingExposure: deps.rendererManager.renderer.toneMappingExposure,
      });
    }

    setMaterialQualityImpl(deps, "lacquered");
    setReflectionsEnabledImpl(deps, true);
    deps.rendererManager.renderer.toneMappingExposure = Math.max(deps.baseToneMappingExposure, 1.08);

    const optimizedRatio = deps.isMobile
      ? Math.min(deps.defaultPixelRatio, 0.95)
      : Math.min(deps.defaultPixelRatio, 1.2);
    deps.rendererManager.renderer.setPixelRatio(optimizedRatio);
    applyUltraMaterialProfileImpl(deps, isFlat2, false);
  } else {
    deps.getLightingEngine()?.endUltraLights();
    deps.setReflectionUpdateIntervalFrames(deps.isMobile ? 36 : 24);
    const ultraRenderState = deps.getUltraRenderState();
    if (ultraRenderState) {
      setMaterialQualityImpl(deps, ultraRenderState.materialQuality);
      setReflectionsEnabledImpl(deps, ultraRenderState.reflectionsEnabled);
      deps.rendererManager.renderer.toneMappingExposure = ultraRenderState.toneMappingExposure;
      deps.setUltraRenderState(null);
    }
    deps.rendererManager.renderer.setPixelRatio(deps.defaultPixelRatio);
    applyUltraMaterialProfileImpl(deps, false, false);
  }

  deps.updateCanvasSize();
}

export function setUltraPerformanceModeOptionsImpl(
  deps: ViewerCoreDisplayOpsDeps,
  options: UltraPerformanceModeOptions
): void {
  const nextMode =
    options.mode === "flat2" || options.mode === "aggressive" || options.mode === "balanced"
      ? options.mode
      : "balanced";
  deps.setUltraPerformanceModeOptionsState({
    enabled: Boolean(options.enabled),
    mode: nextMode,
  });
  if (deps.getUltraPerformanceMode() !== deps.getUltraPerformanceModeOptions().enabled) {
    setUltraPerformanceModeImpl(deps, deps.getUltraPerformanceModeOptions().enabled);
    return;
  }
  if (deps.getUltraPerformanceMode()) {
    setUltraPerformanceModeImpl(deps, false);
    setUltraPerformanceModeImpl(deps, true);
  }
}

export function getUltraPerformanceModeOptionsImpl(
  deps: ViewerCoreDisplayOpsDeps
): UltraPerformanceModeOptions {
  return { ...deps.getUltraPerformanceModeOptions() };
}

export function applyUltraMaterialProfileImpl(
  deps: ViewerCoreDisplayOpsDeps,
  flat2Active: boolean,
  aggressive: boolean
): void {
  deps.ultraMaterials.apply(deps.sceneManager.root, flat2Active, aggressive);
}

export function lerpLightsToTargetImpl(deps: ViewerCoreDisplayOpsDeps): void {
  deps.getLightingEngine()?.lerpToTarget();
}

export function getUltraPerformanceModeImpl(deps: ViewerCoreDisplayOpsDeps): boolean {
  return deps.getUltraPerformanceMode();
}

export function applyBackgroundModeImpl(deps: ViewerCoreDisplayOpsDeps): void {
  const renderer = deps.rendererManager.renderer;
  const mode = deps.getBackgroundMode();
  const sceneBackgroundByMode: Record<ViewerBackgroundMode, string> = {
    studio: "#0f172a",
    white: "#ffffff",
    dark: "#020617",
    woodFloor: "#f8fafc",
  };
  const clearColor = sceneBackgroundByMode[mode];
  deps.sceneEngine.setBackground(clearColor);
  renderer.setClearColor(clearColor, 1);

  if (mode === "woodFloor") {
    deps.sceneManager.setGroundAppearance({
      color: "#9a7452",
      roughness: 0.9,
      metalness: 0.02,
    });
  } else if (mode === "dark") {
    deps.sceneManager.setGroundAppearance({
      color: "#1f2937",
      roughness: 0.92,
      metalness: 0,
    });
  } else if (mode === "white") {
    deps.sceneManager.setGroundAppearance({
      color: "#e5e7eb",
      roughness: 0.92,
      metalness: 0,
    });
  } else {
    deps.sceneManager.setGroundAppearance({
      color: "#d4dae2",
      roughness: 0.92,
      metalness: 0,
    });
  }

  const roomFloorAppearance = getRoomFloorOverlayAppearance(mode);
  const applyRoomFloorOverlayMaterial = (material: THREE.MeshStandardMaterial) => {
    material.color.set(roomFloorAppearance.color);
    material.roughness = roomFloorAppearance.roughness;
    material.metalness = roomFloorAppearance.metalness;
    material.opacity = roomFloorAppearance.opacity;
    material.transparent = roomFloorAppearance.opacity < 1;
    material.needsUpdate = true;
  };

  const roomBoxFloor = deps.getRoomBoxFloor();
  if (roomBoxFloor?.material instanceof THREE.MeshStandardMaterial) {
    applyRoomFloorOverlayMaterial(roomBoxFloor.material);
  }

  deps.sceneManager.root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.userData?.isRoomFloor !== true) return;
    if (!(node.material instanceof THREE.MeshStandardMaterial)) return;
    applyRoomFloorOverlayMaterial(node.material);
  });

  const roomBoxFloorOutline = deps.getRoomBoxFloorOutline();
  if (roomBoxFloorOutline?.material instanceof THREE.LineBasicMaterial) {
    roomBoxFloorOutline.material.color.set(roomFloorAppearance.outlineColor);
    roomBoxFloorOutline.material.needsUpdate = true;
  }

  deps.sceneManager.root.traverse((node) => {
    if (!(node instanceof THREE.LineLoop)) return;
    if (node.userData?.isRoomFloorOutline !== true) return;
    if (!(node.material instanceof THREE.LineBasicMaterial)) return;
    node.material.color.set(roomFloorAppearance.outlineColor);
    node.material.needsUpdate = true;
  });
  deps.sceneManager.setMaterialQuality(deps.getMaterialQuality());
}

export function reapplyDisplayMaterialsImpl(deps: ViewerCoreDisplayOpsDeps): void {
  deps.displayMaterials.reapply(deps.sceneManager.root, {
    materialQuality: deps.getMaterialQuality(),
    glossIntensity: deps.getGlossIntensity(),
    matteMode: deps.getMatteMode(),
  });
}

export function setGlossIntensityImpl(deps: ViewerCoreDisplayOpsDeps, value: number): void {
  deps.setGlossIntensityState(Math.max(0, Math.min(1, value)));
  reapplyDisplayMaterialsImpl(deps);
}

export function getGlossIntensityImpl(deps: ViewerCoreDisplayOpsDeps): number {
  return deps.getGlossIntensity();
}

export function setMatteModeImpl(deps: ViewerCoreDisplayOpsDeps, enabled: boolean): void {
  deps.setMatteModeState(Boolean(enabled));
  reapplyDisplayMaterialsImpl(deps);
}

export function getMatteModeImpl(deps: ViewerCoreDisplayOpsDeps): boolean {
  return deps.getMatteMode();
}

export function setBackgroundModeImpl(deps: ViewerCoreDisplayOpsDeps, mode: ViewerBackgroundMode): void {
  deps.setBackgroundModeState(
    mode === "white" || mode === "dark" || mode === "woodFloor" ? mode : "studio"
  );
  applyBackgroundModeImpl(deps);
}

export function getBackgroundModeImpl(deps: ViewerCoreDisplayOpsDeps): ViewerBackgroundMode {
  return deps.getBackgroundMode();
}

export function setMaterialQualityImpl(deps: ViewerCoreDisplayOpsDeps, quality: ViewerMaterialQuality): void {
  const normalized = normalizeViewerMaterialQuality(quality);
  deps.setMaterialQualityState(normalized);
  deps.materialPipeline.setLacqueredClearcoatPipeline(normalized === "lacquered");
  deps.sceneManager.setMaterialQuality(normalized);
  reapplyDisplayMaterialsImpl(deps);
  deps.setMaterialMode(resolveMaterialModeForQuality(normalized));
  syncDisplayQualityVisualPipelineImpl(deps);
}

export function getMaterialQualityImpl(deps: ViewerCoreDisplayOpsDeps): ViewerMaterialQuality {
  return deps.getMaterialQuality();
}

export function getReflectionProbeCenterImpl(deps: ViewerCoreDisplayOpsDeps): {
  x: number;
  y: number;
  z: number;
} {
  const roomBounds = deps.getRoomBounds();
  if (roomBounds) {
    return {
      x: roomBounds.centerX,
      y: Math.max(0.8, roomBounds.minY + (roomBounds.maxY - roomBounds.minY) * 0.45),
      z: roomBounds.centerZ,
    };
  }
  if (deps.boxes.size > 0) {
    const roots = Array.from(deps.boxes.values()).map((e) => e.mesh);
    runWithAllLayoutBoundsProxiesVisible(roots, () => {
      deps.boundingBox.makeEmpty();
      deps.boxes.forEach((entry) => {
        deps.boundingBox.expandByObject(entry.mesh);
      });
    });
    deps.boundingBox.getCenter(deps.center);
    return { x: deps.center.x, y: Math.max(0.8, deps.center.y), z: deps.center.z };
  }
  return { x: 0, y: 1.2, z: 0 };
}

export function updateReflectionProbeImpl(deps: ViewerCoreDisplayOpsDeps, force = false): void {
  if (!deps.getReflectionsEnabled()) return;
  deps.sceneManager.updateReflectionProbe(deps.rendererManager.renderer, {
    center: getReflectionProbeCenterImpl(deps),
    force,
  });
}

export function setReflectionsEnabledImpl(deps: ViewerCoreDisplayOpsDeps, enabled: boolean): void {
  deps.setReflectionsEnabledState(Boolean(enabled));
  deps.sceneManager.setReflectionsEnabled(deps.getReflectionsEnabled(), deps.rendererManager.renderer);
  if (deps.getReflectionsEnabled()) {
    updateReflectionProbeImpl(deps, true);
  }
  syncDisplayQualityVisualPipelineImpl(deps);
}

export function getReflectionsEnabledImpl(deps: ViewerCoreDisplayOpsDeps): boolean {
  return deps.getReflectionsEnabled();
}

export function setPhotoModeEnabledImpl(deps: ViewerCoreDisplayOpsDeps, enabled: boolean): void {
  deps.setPhotoModeEnabledState(Boolean(enabled));
  deps.rendererManager.renderer.toneMappingExposure = deps.getPhotoModeEnabled()
    ? Math.max(deps.baseToneMappingExposure, 1.2)
    : deps.baseToneMappingExposure;
  if (!deps.getPhotoModeEnabled()) syncDisplayQualityVisualPipelineImpl(deps);
}

export function getPhotoModeEnabledImpl(deps: ViewerCoreDisplayOpsDeps): boolean {
  return deps.getPhotoModeEnabled();
}

export function resolveDisplayQualityLevelImpl(
  deps: ViewerCoreDisplayOpsDeps
): "baixa" | "media" | "alta" {
  if (deps.getReflectionsEnabled()) return "alta";
  if (deps.getMaterialQuality() === "standard") return "baixa";
  return "media";
}

export function syncDisplayQualityVisualPipelineImpl(deps: ViewerCoreDisplayOpsDeps): void {
  if (deps.getPhotoModeEnabled() || deps.getUltraPerformanceMode()) return;

  const level = resolveDisplayQualityLevelImpl(deps);

  const exposureFactor = level === "baixa" ? 1.0 : level === "media" ? 1.0 : 0.92;
  deps.rendererManager.renderer.toneMappingExposure = deps.baseToneMappingExposure * exposureFactor;

  deps.ensureLightingEngine().applyShadowQualityProfile(level);

  const composer = deps.ensureComposerEngine();
  composer.applyDisplayQualityBloomProfiles(level);

  const currentMode = deps.viewerState.getCurrentMode();
  if (currentMode === "showcase") composer.ensureShowcase();
  else composer.ensureMain();
}
