/**
 * Acesso ao estado interno do Viewer para pré-visualização do Photo Mode
 * sem alterar ViewerCore.ts (campos privados via asserção em runtime).
 */
import * as THREE from "three";
import type { Viewer } from "../../3d/core/Viewer";
import type { ViewerBackgroundMode } from "../../context/projectTypes";
import { getActiveViewerCore } from "./pimoViewerRuntime";

export type PhotoModeLightBaseline = {
  key: number;
  fill: number;
  ambient: number;
  rim: number;
  castShadow: boolean;
  shadowRadius: number;
  shadowBias: number;
  toneMappingExposure: number;
  shadowMapEnabled: boolean;
  shadowMapType: THREE.ShadowMapType;
};

export type PhotoModeChromeBaseline = {
  groundVisible: boolean;
  gridVisible: boolean;
  roomGroupVisible: boolean;
  roomWallVisibilities: Array<{ mesh: THREE.Mesh; visible: boolean }>;
  selectionOutlineVisible: boolean;
  wallSelectionOutlineVisible: boolean;
  dimensionsOverlayVisible: boolean;
  wallGizmoVisible: boolean;
};

type ViewerInternals = {
  lights: {
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.Light;
    ambient: THREE.Light;
    rimLight: THREE.Light;
  };
  rendererManager: { renderer: THREE.WebGLRenderer };
  selectionOutline: THREE.Object3D | null;
  wallSelectionOutline: THREE.BoxHelper | null;
  dimensionsOverlayHandle: { group: THREE.Group } | null;
  roomBuilder: { getGroup: () => THREE.Group };
  sceneManager: {
    getGroundVisible: () => boolean;
    setGroundVisible: (_v: boolean) => void;
    getGridVisible: () => boolean;
    setGridVisible: (_v: boolean) => void;
  };
  wallGizmo: { group: THREE.Group } | null;
};

type RoomWallRow = { mesh: THREE.Mesh };

function getInternals(viewer: Viewer): ViewerInternals | null {
  const v = viewer as unknown as Partial<ViewerInternals> & { roomBoxWalls?: RoomWallRow[] };
  if (
    !v.lights ||
    !v.rendererManager ||
    !v.sceneManager ||
    !v.roomBuilder ||
    v.selectionOutline === undefined
  ) {
    return null;
  }
  return {
    lights: v.lights,
    rendererManager: v.rendererManager,
    selectionOutline: v.selectionOutline,
    wallSelectionOutline: v.wallSelectionOutline ?? null,
    dimensionsOverlayHandle: v.dimensionsOverlayHandle ?? null,
    roomBuilder: v.roomBuilder,
    sceneManager: v.sceneManager,
    wallGizmo: v.wallGizmo ?? null,
  };
}

export function getViewerFromWindow(): Viewer | null {
  return (getActiveViewerCore() as unknown as Viewer | null) ?? null;
}

export function captureLightBaseline(viewer: Viewer): PhotoModeLightBaseline | null {
  const core = getInternals(viewer);
  if (!core) return null;
  const { lights, rendererManager } = core;
  const r = rendererManager.renderer;
  return {
    key: lights.keyLight.intensity,
    fill: lights.fillLight.intensity,
    ambient: lights.ambient.intensity,
    rim: lights.rimLight.intensity,
    castShadow: lights.keyLight.castShadow,
    shadowRadius: lights.keyLight.shadow.radius,
    shadowBias: lights.keyLight.shadow.bias,
    toneMappingExposure: r.toneMappingExposure,
    shadowMapEnabled: r.shadowMap.enabled,
    shadowMapType: r.shadowMap.type,
  };
}

export function applyLightPreview(viewer: Viewer, base: PhotoModeLightBaseline, shadowFactor: number, advancedRealism: boolean): void {
  const core = getInternals(viewer);
  if (!core) return;
  const { lights, rendererManager } = core;
  const renderer = rendererManager.renderer;
  const eased = 0.55 + THREE.MathUtils.clamp(shadowFactor, 0, 1) * 0.45;
  const photoExposure = 1.22;
  if (advancedRealism) {
    lights.keyLight.intensity = base.key * (eased * 1.25);
    lights.fillLight.intensity = base.fill * (0.85 + shadowFactor * 0.3);
    lights.ambient.intensity = base.ambient * (0.95 + shadowFactor * 0.15);
    lights.rimLight.intensity = base.rim * (0.9 + shadowFactor * 0.25);
    lights.keyLight.castShadow = true;
    lights.keyLight.shadow.radius = Math.max(4, base.shadowRadius * 1.6);
    lights.keyLight.shadow.bias = -0.0001;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMappingExposure = Math.max(base.toneMappingExposure, photoExposure);
  } else {
    lights.keyLight.intensity = base.key * (eased * 1.12);
    lights.fillLight.intensity = base.fill * (0.75 + shadowFactor * 0.4);
    lights.ambient.intensity = base.ambient * (0.85 + shadowFactor * 0.25);
    lights.rimLight.intensity = base.rim * (0.65 + shadowFactor * 0.5);
    lights.keyLight.castShadow = shadowFactor > 0.15 ? base.castShadow : false;
    lights.keyLight.shadow.radius = Math.max(3, base.shadowRadius * (0.7 + shadowFactor * 0.6));
    lights.keyLight.shadow.bias = base.shadowBias;
    renderer.toneMappingExposure = Math.max(base.toneMappingExposure, 1.12);
    renderer.shadowMap.enabled = base.shadowMapEnabled;
    renderer.shadowMap.type = base.shadowMapType;
  }
}

export function restoreLightBaseline(viewer: Viewer, base: PhotoModeLightBaseline): void {
  const core = getInternals(viewer);
  if (!core) return;
  const { lights, rendererManager } = core;
  const renderer = rendererManager.renderer;
  lights.keyLight.intensity = base.key;
  lights.fillLight.intensity = base.fill;
  lights.ambient.intensity = base.ambient;
  lights.rimLight.intensity = base.rim;
  lights.keyLight.castShadow = base.castShadow;
  lights.keyLight.shadow.radius = base.shadowRadius;
  lights.keyLight.shadow.bias = base.shadowBias;
  renderer.toneMappingExposure = base.toneMappingExposure;
  renderer.shadowMap.enabled = base.shadowMapEnabled;
  renderer.shadowMap.type = base.shadowMapType;
}

export function captureChromeBaseline(viewer: Viewer): PhotoModeChromeBaseline | null {
  const core = getInternals(viewer);
  const v = viewer as unknown as { roomBoxWalls?: RoomWallRow[] };
  if (!core || !v.roomBoxWalls) return null;
  const roomGroup = core.roomBuilder.getGroup();
  const roomWallVisibilities = v.roomBoxWalls.map((wall) => ({
    mesh: wall.mesh,
    visible: wall.mesh.visible,
  }));
  const wallGizmo = core.wallGizmo;
  return {
    groundVisible: core.sceneManager.getGroundVisible(),
    gridVisible: core.sceneManager.getGridVisible(),
    roomGroupVisible: roomGroup.visible,
    roomWallVisibilities,
    selectionOutlineVisible: core.selectionOutline?.visible ?? false,
    wallSelectionOutlineVisible: core.wallSelectionOutline?.visible ?? false,
    dimensionsOverlayVisible: core.dimensionsOverlayHandle?.group?.visible ?? false,
    wallGizmoVisible: wallGizmo?.group.visible ?? false,
  };
}

export function applyProjectTransparentChrome(viewer: Viewer, chrome: PhotoModeChromeBaseline): void {
  const core = getInternals(viewer);
  if (!core) return;
  core.sceneManager.setGroundVisible(false);
  core.sceneManager.setGridVisible(false);
  const roomGroup = core.roomBuilder.getGroup();
  roomGroup.visible = false;
  chrome.roomWallVisibilities.forEach(({ mesh }) => {
    mesh.visible = false;
  });
  if (core.selectionOutline) core.selectionOutline.visible = false;
  if (core.wallSelectionOutline) core.wallSelectionOutline.visible = false;
  if (core.dimensionsOverlayHandle?.group) core.dimensionsOverlayHandle.group.visible = false;
  if (core.wallGizmo) core.wallGizmo.group.visible = false;
  core.rendererManager.renderer.shadowMap.enabled = false;
}

export function restoreChromeBaseline(viewer: Viewer, chrome: PhotoModeChromeBaseline): void {
  const core = getInternals(viewer);
  if (!core) return;
  core.sceneManager.setGroundVisible(chrome.groundVisible);
  core.sceneManager.setGridVisible(chrome.gridVisible);
  const roomGroup = core.roomBuilder.getGroup();
  roomGroup.visible = chrome.roomGroupVisible;
  chrome.roomWallVisibilities.forEach(({ mesh, visible }) => {
    mesh.visible = visible;
  });
  if (core.selectionOutline) core.selectionOutline.visible = chrome.selectionOutlineVisible;
  if (core.wallSelectionOutline) core.wallSelectionOutline.visible = chrome.wallSelectionOutlineVisible;
  if (core.dimensionsOverlayHandle?.group) {
    core.dimensionsOverlayHandle.group.visible = chrome.dimensionsOverlayVisible;
  }
  if (core.wallGizmo) core.wallGizmo.group.visible = chrome.wallGizmoVisible;
}

export function mapPhotoBackgroundToViewerMode(bg: string): ViewerBackgroundMode {
  if (bg === "white" || bg === "transparent") return "white";
  if (bg === "hdri") return "studio";
  return "studio";
}
