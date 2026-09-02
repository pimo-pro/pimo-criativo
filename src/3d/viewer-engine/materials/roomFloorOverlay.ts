/**
 * STUB — aparência mínima do overlay de piso (consumida por ViewerCoreDisplayOps).
 * Sistema Sala removido (feature/sala-rebuild-opensource).
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
  return ROOM_FLOOR_EXPAND_M[mode] ?? 0;
}

export function getRoomFloorOverlayAppearance(
  _backgroundMode: ViewerBackgroundMode
): RoomFloorOverlayAppearance {
  void _backgroundMode;
  return {
    color: "#9ca3af",
    opacity: 0.85,
    roughness: 0.85,
    metalness: 0.02,
    outlineColor: "#6b7280",
  };
}

export function createRoomFloorOverlayMaterial(
  appearance: RoomFloorOverlayAppearance
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: appearance.color,
    transparent: true,
    opacity: appearance.opacity,
    roughness: appearance.roughness,
    metalness: appearance.metalness,
  });
}

export function createRoomFloorOutline(
  _geometry: THREE.BufferGeometry,
  appearance: RoomFloorOverlayAppearance
): THREE.LineLoop {
  void _geometry;
  const geom = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({ color: appearance.outlineColor });
  return new THREE.LineLoop(geom, mat);
}
