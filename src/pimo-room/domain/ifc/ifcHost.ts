/**
 * Pré-visualização IFC no ViewerCore (caixas a partir do RoomState / modelo).
 */
import * as THREE from "three";
import type { RoomState } from "../RoomState";
import { RoomLevelGeometry } from "../levels/RoomLevelGeometry";
import { enhancePbrMaterials } from "../glb/glbMaterials";
import { getRoomEngineViewerHost } from "../roomEngineStore";

const GROUP_NAME = "roomIfcPreview";

type ViewerCoreLoose = {
  sceneManager?: { scene: THREE.Scene };
};

let previewGroup: THREE.Group | null = null;

function getCore(): ViewerCoreLoose | null {
  return getRoomEngineViewerHost() as unknown as ViewerCoreLoose | null;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry?.dispose();
      const m = c.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

/** Meshes simples das paredes do nível activo (WebGL). */
export function syncIfcPreviewFromRoomState(state: RoomState): void {
  const core = getCore();
  if (!core?.sceneManager?.scene) return;
  clearIfcPreview();

  const desc = RoomLevelGeometry.forLevel(state, state.activeLevelId);
  if (!desc) return;

  previewGroup = new THREE.Group();
  previewGroup.name = GROUP_NAME;
  const baseY = desc.baseElevationM;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc8c2b8,
    roughness: 0.85,
    metalness: 0.02,
  });

  for (const wall of state.walls.filter((w) => w.levelId === state.activeLevelId)) {
    const dx = (wall.endMm.x - wall.startMm.x) / 1000;
    const dz = (wall.endMm.z - wall.startMm.z) / 1000;
    const len = Math.hypot(dx, dz) || 0.1;
    const h = wall.heightMm / 1000;
    const t = wall.thicknessMm / 1000;
    const geo = new THREE.BoxGeometry(len, h, t);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(
      (wall.startMm.x + wall.endMm.x) / 2000,
      baseY + h / 2,
      (wall.startMm.z + wall.endMm.z) / 2000
    );
    mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    previewGroup.add(mesh);
  }

  enhancePbrMaterials(previewGroup);
  core.sceneManager.scene.add(previewGroup);
}

export function clearIfcPreview(): void {
  if (!previewGroup) return;
  previewGroup.parent?.remove(previewGroup);
  disposeGroup(previewGroup);
  previewGroup = null;
}
