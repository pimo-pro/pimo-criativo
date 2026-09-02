/**
 * Material e aparência do overlay de piso da sala (Room 2.1) — distinto do ground global.
 */
import * as THREE from "three";
import type { RoomFloorMode } from "../room/roomEngineTypes";
import type { ViewerBackgroundMode } from "../../../context/projectTypes";

export const ROOM_FLOOR_EXPAND_M: Record<RoomFloorMode, number> = {
  room: 0,
  hybrid: 0.35,
  full: 4,
};

export type RoomFloorOverlayAppearance = {
  color: string;
  opacity: number;
  roughness: number;
  metalness: number;
  outlineColor: string;
};

export function getRoomFloorExpandM(mode: RoomFloorMode): number {
  return mode === "hybrid"
    ? ROOM_FLOOR_EXPAND_M.hybrid
    : mode === "full"
      ? ROOM_FLOOR_EXPAND_M.full
      : ROOM_FLOOR_EXPAND_M.room;
}

export function getRoomFloorOverlayAppearance(
  backgroundMode: ViewerBackgroundMode
): RoomFloorOverlayAppearance {
  switch (backgroundMode) {
    case "woodFloor":
      return {
        color: "#b08968",
        opacity: 0.92,
        roughness: 0.82,
        metalness: 0.04,
        outlineColor: "#8b6914",
      };
    case "dark":
      return {
        color: "#4b5563",
        opacity: 0.88,
        roughness: 0.8,
        metalness: 0.03,
        outlineColor: "#9ca3af",
      };
    case "white":
      return {
        color: "#eef1f5",
        opacity: 0.9,
        roughness: 0.76,
        metalness: 0.04,
        outlineColor: "#cbd5e1",
      };
    default:
      return {
        color: "#c5cdd8",
        opacity: 0.88,
        roughness: 0.78,
        metalness: 0.05,
        outlineColor: "#94a3b8",
      };
  }
}

export function createRoomFloorOverlayMaterial(
  appearance: RoomFloorOverlayAppearance
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(appearance.color),
    roughness: appearance.roughness,
    metalness: appearance.metalness,
    transparent: appearance.opacity < 1,
    opacity: appearance.opacity,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  return mat;
}

export function createRoomFloorOutline(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  expandM: number,
  y: number,
  outlineColor: string
): THREE.LineLoop {
  const x0 = minX - expandM;
  const x1 = maxX + expandM;
  const z0 = minZ - expandM;
  const z1 = maxZ + expandM;
  const points = [
    new THREE.Vector3(x0, 0, z0),
    new THREE.Vector3(x1, 0, z0),
    new THREE.Vector3(x1, 0, z1),
    new THREE.Vector3(x0, 0, z1),
  ];
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(outlineColor),
    transparent: true,
    opacity: 0.55,
    depthTest: true,
  });
  const line = new THREE.LineLoop(geom, mat);
  line.position.y = y;
  line.name = "room-floor-outline";
  line.userData.isRoomFloorOutline = true;
  line.renderOrder = 1;
  return line;
}
