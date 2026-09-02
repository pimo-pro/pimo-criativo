import * as THREE from "three";
import type { RoomBounds } from "../room/RoomManager";

const raycaster = new THREE.Raycaster();

/**
 * Oculta apenas a primeira parede principal que bloqueia a linha entre
 * câmera e centro da sala. Todas as outras paredes permanecem visíveis.
 */
export function updateWallCulling(
  camera: THREE.Camera,
  roomBounds: RoomBounds,
  wallsMain: THREE.Mesh[]
): void {
  if (!wallsMain.length) return;

  const target = new THREE.Vector3(roomBounds.centerX, 1.5, roomBounds.centerZ);
  const dir = target.clone().sub(camera.position);

  // Sem direção válida: mantém tudo visível.
  if (dir.lengthSq() < 1e-8) {
    wallsMain.forEach((w) => {
      w.visible = true;
    });
    return;
  }

  raycaster.set(camera.position, dir.normalize());
  const hits = raycaster.intersectObjects(wallsMain, false);

  // Reset: nenhuma parede oculta por padrão.
  wallsMain.forEach((w) => {
    w.visible = true;
  });

  if (!hits.length) return;

  // Somente a primeira parede que bloqueia a câmera deve desaparecer.
  const firstHit = hits[0].object as THREE.Mesh;
  firstHit.visible = false;
}

