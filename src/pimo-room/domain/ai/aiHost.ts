/**
 * Preview ghost + animações lerp no ViewerCore (Fase E).
 */
import * as THREE from "three";
import { createPlaceholderMesh } from "../catalog/createPlaceholderMesh";
import { getCatalogPreset } from "../catalog/CatalogPresets";
import { toCatalogItemState } from "../catalog/CatalogItemManager";
import type { RoomState } from "../RoomState";
import { RoomLevelGeometry } from "../levels/RoomLevelGeometry";
import { getRoomEngineViewerHost } from "../roomEngineStore";
import { syncCatalogItems } from "../catalog/catalogHost";

const GHOST_NAME = "roomAiGhosts";
const HIGHLIGHT_NAME = "roomAiHighlight";

type ViewerCoreLoose = {
  sceneManager?: { scene: THREE.Scene };
};

let ghostGroup: THREE.Group | null = null;
let animFrame = 0;
let animating = false;

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

export function clearAiPreview(): void {
  if (ghostGroup) {
    ghostGroup.parent?.remove(ghostGroup);
    disposeGroup(ghostGroup);
    ghostGroup = null;
  }
  const core = getCore();
  const hl = core?.sceneManager?.scene.getObjectByName(HIGHLIGHT_NAME);
  if (hl) {
    hl.parent?.remove(hl);
  }
}

/** Ghosts translúcidos do layout proposto. */
export function showAiPreview(previewState: RoomState, affectedIds: string[]): void {
  const core = getCore();
  if (!core?.sceneManager?.scene) return;
  clearAiPreview();

  ghostGroup = new THREE.Group();
  ghostGroup.name = GHOST_NAME;
  const baseY =
    RoomLevelGeometry.forLevel(previewState, previewState.activeLevelId)?.baseElevationM ?? 0;
  const levelItems = previewState.items.filter((i) => i.levelId === previewState.activeLevelId);

  for (const raw of levelItems) {
    const item = toCatalogItemState(raw);
    const preset = getCatalogPreset(item.catalogId);
    const root = preset
      ? createPlaceholderMesh(preset)
      : createPlaceholderMesh({
          id: item.catalogId,
          name: item.name,
          type: item.type,
          sizeMm: { width: 600, depth: 600, height: 600 },
          color: "#88aacc",
        });
    root.position.set(
      item.positionMm.x / 1000,
      baseY + item.positionMm.y / 1000,
      item.positionMm.z / 1000
    );
    root.rotation.y = (item.rotationDeg * Math.PI) / 180;
    root.scale.set(item.scale.x, item.scale.y, item.scale.z);
    const affected = affectedIds.includes(item.id);
    root.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const m of mats) {
          if (m && "transparent" in m) {
            const sm = m as THREE.MeshStandardMaterial;
            sm.transparent = true;
            sm.opacity = affected ? 0.55 : 0.35;
            sm.depthWrite = false;
            if (affected && sm.emissive) sm.emissive.setHex(0x336699);
          }
        }
      }
    });
    ghostGroup.add(root);
  }

  core.sceneManager.scene.add(ghostGroup);
}

/**
 * Anima itens do catálogo até às posições do estado alvo, depois sincroniza.
 */
export async function animateApplyAiLayout(
  fromState: RoomState,
  toState: RoomState,
  durationMs = 500
): Promise<void> {
  const core = getCore();
  if (!core?.sceneManager?.scene) {
    await syncCatalogItems(toState);
    return;
  }

  clearAiPreview();
  await syncCatalogItems(fromState);

  const group = core.sceneManager.scene.getObjectByName("roomCatalogItems") as THREE.Group | null;
  if (!group) {
    await syncCatalogItems(toState);
    return;
  }

  const baseY =
    RoomLevelGeometry.forLevel(toState, toState.activeLevelId)?.baseElevationM ?? 0;
  const targets = new Map(
    toState.items
      .filter((i) => i.levelId === toState.activeLevelId)
      .map((i) => [
        i.id,
        {
          x: i.positionMm.x / 1000,
          y: baseY + i.positionMm.y / 1000,
          z: i.positionMm.z / 1000,
          rotY: (i.rotationDeg * Math.PI) / 180,
        },
      ])
  );

  type Anim = {
    obj: THREE.Object3D;
    from: { x: number; y: number; z: number; rotY: number };
    to: { x: number; y: number; z: number; rotY: number };
  };
  const anims: Anim[] = [];
  for (const child of group.children) {
    const id = child.userData?.roomCatalogItemId as string | undefined;
    if (!id || !targets.has(id)) continue;
    const to = targets.get(id)!;
    anims.push({
      obj: child,
      from: {
        x: child.position.x,
        y: child.position.y,
        z: child.position.z,
        rotY: child.rotation.y,
      },
      to,
    });
    // highlight
    child.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material && "emissive" in c.material) {
        (c.material as THREE.MeshStandardMaterial).emissive.setHex(0x224466);
      }
    });
  }

  if (anims.length === 0) {
    await syncCatalogItems(toState);
    return;
  }

  animating = true;
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (!animating) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const e = 1 - Math.pow(1 - t, 3); // ease-out
      for (const a of anims) {
        a.obj.position.x = a.from.x + (a.to.x - a.from.x) * e;
        a.obj.position.y = a.from.y + (a.to.y - a.from.y) * e;
        a.obj.position.z = a.from.z + (a.to.z - a.from.z) * e;
        a.obj.rotation.y = a.from.rotY + (a.to.rotY - a.from.rotY) * e;
      }
      if (t < 1) {
        animFrame = requestAnimationFrame(tick);
      } else {
        animating = false;
        resolve();
      }
    };
    animFrame = requestAnimationFrame(tick);
  });

  await syncCatalogItems(toState);
}

export function cancelAiAnimation(): void {
  animating = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = 0;
}
