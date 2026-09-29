/**
 * Liga WalkthroughCamera ao ViewerCore activo (WebGL).
 */
import * as THREE from "three";
import type { RoomState } from "../RoomState";
import { RoomLevelGeometry } from "../levels/RoomLevelGeometry";
import { getRoomEngineViewerHost } from "../roomEngineStore";
import { WalkthroughCamera, type WalkthroughBoundsM } from "./WalkthroughCamera";

type ViewerCoreLoose = {
  cameraManager?: { camera: THREE.PerspectiveCamera };
  controls?: { controls: { enabled: boolean } };
  rendererManager?: { renderer: { domElement: HTMLElement } };
  sceneManager?: { scene: THREE.Scene; root?: THREE.Object3D };
};

let activeWalkthrough: WalkthroughCamera | null = null;
let ghostGroup: THREE.Group | null = null;

function getCore(): ViewerCoreLoose | null {
  return getRoomEngineViewerHost() as unknown as ViewerCoreLoose | null;
}

function boundsFromState(state: RoomState): WalkthroughBoundsM {
  const desc = RoomLevelGeometry.forLevel(state, state.activeLevelId);
  const fp = desc?.geometry.footprintMm;
  const w = (fp?.widthMm ?? state.footprint?.widthMm ?? 4000) / 1000;
  const d = (fp?.depthMm ?? state.footprint?.depthMm ?? 4000) / 1000;
  const h = (fp?.heightMm ?? state.footprint?.heightMm ?? 2600) / 1000;
  const baseY = desc?.baseElevationM ?? 0;
  return {
    minX: -w / 2,
    maxX: w / 2,
    minZ: -d / 2,
    maxZ: d / 2,
    minY: baseY,
    maxY: baseY + h,
  };
}

function clearGhosts(core: ViewerCoreLoose): void {
  if (!ghostGroup) return;
  ghostGroup.parent?.remove(ghostGroup);
  ghostGroup.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
  ghostGroup = null;
  void core;
}

/** Fantasmas translúcidos dos outros níveis (empilhados). */
export function syncLevelGhosts(state: RoomState): void {
  const core = getCore();
  if (!core?.sceneManager?.scene) return;
  clearGhosts(core);
  const stacked = RoomLevelGeometry.allStacked(state);
  if (stacked.length <= 1) return;
  ghostGroup = new THREE.Group();
  ghostGroup.name = "roomLevelGhosts";
  for (const desc of stacked) {
    if (desc.level.id === state.activeLevelId) continue;
    const fp = desc.geometry.footprintMm;
    const w = Math.max(0.1, fp.widthMm / 1000);
    const d = Math.max(0.1, fp.depthMm / 1000);
    const geo = new THREE.BoxGeometry(w, 0.05, d);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, desc.baseElevationM + 0.025, 0);
    ghostGroup.add(mesh);
  }
  core.sceneManager.scene.add(ghostGroup);
}

export function isWalkthroughActive(): boolean {
  return activeWalkthrough?.isActive() === true;
}

export function startWalkthrough(state: RoomState): { ok: boolean; error?: string } {
  const core = getCore();
  if (!core?.cameraManager?.camera || !core.rendererManager?.renderer?.domElement) {
    return { ok: false, error: "ViewerCore não está pronto" };
  }
  stopWalkthrough();
  syncLevelGhosts(state);
  void import("../catalog/catalogHost").then(({ syncCatalogItems }) => {
    void syncCatalogItems(state);
  });
  const bounds = boundsFromState(state);
  const spawn = state.walkthroughSpawn;
  const level = RoomLevelGeometry.forLevel(state, state.activeLevelId);
  const baseY = level?.baseElevationM ?? 0;
  const wt = new WalkthroughCamera(
    core.cameraManager.camera,
    core.rendererManager.renderer.domElement,
    () => core.controls?.controls ?? null,
    bounds,
    {
      spawn: spawn
        ? {
            x: spawn.positionMm.x / 1000,
            y: baseY + (spawn.positionMm.y || 1600) / 1000,
            z: spawn.positionMm.z / 1000,
            yawDeg: spawn.yawDeg,
          }
        : { x: 0, y: baseY + 1.6, z: 0, yawDeg: 0 },
    }
  );
  wt.start();
  activeWalkthrough = wt;
  return { ok: true };
}

export function stopWalkthrough(): void {
  activeWalkthrough?.dispose();
  activeWalkthrough = null;
  const core = getCore();
  if (core) clearGhosts(core);
}
