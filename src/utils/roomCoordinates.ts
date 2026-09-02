/**
 * Coordenadas mínimas da sala — stub para autoRoomFill / contratos mm.
 * Sistema Sala 3D removido (feature/sala-rebuild-opensource).
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import type { RoomWallLabel } from "../3d/viewer-engine/room/roomEngineTypes";
import { ROOM_20_DEFAULTS } from "../3d/viewer-engine/room/roomEngineTypes";
import type { Wall } from "../stores/wallStore";

export type RoomPositionMm = { x: number; y: number; z: number };

export function centeredWallPositionForLabel(
  label: RoomWallLabel,
  widthMm: number,
  depthMm: number,
  heightMm: number,
  wallThicknessMm: number = ROOM_20_DEFAULTS.wallThicknessMm
): RoomPositionMm {
  const y = heightMm / 2;
  const tHalf = wallThicknessMm / 2;
  const halfW = widthMm / 2;
  const halfD = depthMm / 2;
  switch (label) {
    case "sul":
      return { x: 0, y, z: -halfD - tHalf };
    case "este":
      return { x: halfW + tHalf, y, z: 0 };
    case "norte":
      return { x: 0, y, z: halfD + tHalf };
    case "oeste":
      return { x: -halfW - tHalf, y, z: 0 };
    default:
      return { x: 0, y, z: 0 };
  }
}

export function isLegacyCornerLayoutSulPosition(
  _position: { x: number; z: number },
  _widthMm: number
): boolean {
  void _position;
  void _widthMm;
  return false;
}

export function isLegacyCornerProjectRoom(_room: ProjectRoomConfig): boolean {
  void _room;
  return false;
}

export function isLegacyCornerWallStoreLayout(_walls: Wall[], _widthCm: number): boolean {
  void _walls;
  void _widthCm;
  return false;
}

export function cornerToCenteredPositionMm(
  position: { x: number; y?: number; z: number },
  widthMm: number,
  depthMm: number
): RoomPositionMm {
  return {
    x: position.x - widthMm / 2,
    y: position.y ?? 0,
    z: position.z - depthMm / 2,
  };
}

export function migrateProjectRoomToCenteredCoords(room: ProjectRoomConfig): ProjectRoomConfig {
  return room;
}

export function wallStorePositionToViewerMeters(
  position: { x: number; y?: number; z: number } | undefined
): { x: number; y: number; z: number } {
  return {
    x: ((position?.x ?? 0) * 10) / 1000,
    y: ((position?.y ?? 0) * 10) / 1000,
    z: ((position?.z ?? 0) * 10) / 1000,
  };
}

export function computeCenteredConnectedLayoutCm(
  walls: Wall[]
): Array<{ x: number; z: number; rotation: number }> {
  return walls.map(() => ({ x: 0, z: 0, rotation: 0 }));
}
