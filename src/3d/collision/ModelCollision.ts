import * as THREE from "three";
import type { RoomBounds } from "../../pimo-room/mesh/impl/RoomManager";
import { setBox3FromObjectExcludingLayoutProxy } from "../viewer-engine/box/boxAabbUtils";

/**
 * Impede interseção modelo x paredes empurrando o modelo pelo menor eixo de sobreposição.
 */
export function preventModelWallIntersection(
  model: THREE.Object3D,
  walls: THREE.Mesh[]
): void {
  const maxIterations = 6;
  const modelBox = new THREE.Box3();
  const wallBox = new THREE.Box3();
  const modelCenter = new THREE.Vector3();
  const wallCenter = new THREE.Vector3();

  for (let i = 0; i < maxIterations; i += 1) {
    model.updateMatrixWorld(true);
    setBox3FromObjectExcludingLayoutProxy(modelBox, model);
    let hadIntersection = false;

    for (const wall of walls) {
      wall.updateMatrixWorld(true);
      wallBox.setFromObject(wall);
      if (!modelBox.intersectsBox(wallBox)) continue;
      hadIntersection = true;

      const overlapX = Math.max(
        0,
        Math.min(modelBox.max.x, wallBox.max.x) - Math.max(modelBox.min.x, wallBox.min.x)
      );
      const overlapY = Math.max(
        0,
        Math.min(modelBox.max.y, wallBox.max.y) - Math.max(modelBox.min.y, wallBox.min.y)
      );
      const overlapZ = Math.max(
        0,
        Math.min(modelBox.max.z, wallBox.max.z) - Math.max(modelBox.min.z, wallBox.min.z)
      );
      const minOverlap = Math.min(overlapX, overlapY, overlapZ);
      if (minOverlap <= 0) continue;

      modelBox.getCenter(modelCenter);
      wallBox.getCenter(wallCenter);

      if (minOverlap === overlapX) {
        const dx =
          modelCenter.x < wallCenter.x
            ? wallBox.min.x - modelBox.max.x
            : wallBox.max.x - modelBox.min.x;
        model.position.x += dx;
      } else if (minOverlap === overlapZ) {
        const dz =
          modelCenter.z < wallCenter.z
            ? wallBox.min.z - modelBox.max.z
            : wallBox.max.z - modelBox.min.z;
        model.position.z += dz;
      } else {
        const dy =
          modelCenter.y < wallCenter.y
            ? wallBox.min.y - modelBox.max.y
            : wallBox.max.y - modelBox.min.y;
        model.position.y += dy;
      }
    }

    if (!hadIntersection) break;
  }
}

/**
 * Mantém o modelo dentro dos limites da sala no plano X/Z.
 */
export function keepModelInsideRoom(
  model: THREE.Object3D,
  roomBounds: RoomBounds,
  margin = 0.02
): void {
  const box = new THREE.Box3();
  setBox3FromObjectExcludingLayoutProxy(box, model);
  let dx = 0;
  let dz = 0;

  const minX = roomBounds.minX + margin;
  const maxX = roomBounds.maxX - margin;
  const minZ = roomBounds.minZ + margin;
  const maxZ = roomBounds.maxZ - margin;

  if (box.min.x < minX) dx += minX - box.min.x;
  if (box.max.x > maxX) dx -= box.max.x - maxX;
  if (box.min.z < minZ) dz += minZ - box.min.z;
  if (box.max.z > maxZ) dz -= box.max.z - maxZ;

  if (dx !== 0 || dz !== 0) {
    model.position.x += dx;
    model.position.z += dz;
  }
}

