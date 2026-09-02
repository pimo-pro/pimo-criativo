/**
 * Posiciona grupos de porta/janela no espaço local da parede (RoomManager).
 * horizontalOffsetMm / floorOffsetMm seguem openingConstraints (canto inferior-esquerdo da abertura).
 */

import * as THREE from "three";
import type { DoorWindowConfig } from "./types";
import { clampOpeningToWall } from "../../utils/openingConstraints";

export function placeOpeningGroupOnWall(
  group: THREE.Object3D,
  wall: THREE.Mesh,
  config: DoorWindowConfig
): void {
  const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 3000;
  const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2800;
  const wallLen = wallLenMm / 1000;
  const wallH = wallHeightMm / 1000;
  const widthM = Math.max(0.01, config.widthMm / 1000);
  const heightM = Math.max(0.01, config.heightMm / 1000);

  const clamped = clampOpeningToWall(config, wallLenMm, wallHeightMm);
  config.horizontalOffsetMm = clamped.horizontalOffsetMm;
  config.floorOffsetMm = clamped.floorOffsetMm;

  const centerX = -wallLen / 2 + clamped.horizontalOffsetMm / 1000 + widthM / 2;
  const centerY = -wallH / 2 + clamped.floorOffsetMm / 1000 + heightM / 2;
  const t = (wall.userData.wallThicknessM as number | undefined) ?? 0.12;
  group.position.set(centerX, centerY, t / 2 + 0.02);

  group.userData.config = { ...config };
}
