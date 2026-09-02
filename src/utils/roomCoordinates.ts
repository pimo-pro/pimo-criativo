/**
 * Coordenadas canónicas da sala — sistema centrado (RoomManager / ViewerCore).
 * Origem no centro do footprint; X = largura, Z = profundidade, Y = altura.
 * Módulo: pimo-room v4.
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import type { RoomWallLabel } from "../3d/viewer-engine/room/roomEngineTypes";
import { ROOM_20_DEFAULTS } from "../3d/viewer-engine/room/roomEngineTypes";
import type { Wall } from "../stores/wallStore";

export type RoomPositionMm = { x: number; y: number; z: number };

/** Centro da mesh de parede em mm (alinhado a WallFactory / RoomManager). */
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

/** Layout legado em canto: sul em z≈0, x≈W/2 (mm). */
export function isLegacyCornerLayoutSulPosition(
  position: { x: number; z: number },
  widthMm: number,
  toleranceMm = 50
): boolean {
  return (
    Math.abs(position.z) <= toleranceMm &&
    Math.abs(position.x - widthMm / 2) <= toleranceMm
  );
}

export function isLegacyCornerProjectRoom(room: ProjectRoomConfig): boolean {
  const sul = room.walls.find((w) => w.label === "sul");
  if (!sul?.position) return false;
  return isLegacyCornerLayoutSulPosition(sul.position, room.widthMm);
}

/** wallStore em cm — sul em z≈0, x≈W/2. */
export function isLegacyCornerWallStoreLayout(walls: Wall[], widthCm: number): boolean {
  const sul = walls[0];
  if (!sul?.position) return false;
  const tolCm = 5;
  return (
    Math.abs(sul.position.z ?? 0) <= tolCm &&
    Math.abs((sul.position.x ?? 0) - widthCm / 2) <= tolCm
  );
}

export function cornerToCenteredPositionMm(
  position: RoomPositionMm,
  widthMm: number,
  depthMm: number
): RoomPositionMm {
  return {
    x: position.x - widthMm / 2,
    y: position.y,
    z: position.z - depthMm / 2,
  };
}

/** Migra snapshot Room 2.0 em layout de canto para centrado (sem alterar schema). */
export function migrateProjectRoomToCenteredCoords(room: ProjectRoomConfig): ProjectRoomConfig {
  if (!isLegacyCornerProjectRoom(room)) return room;
  return {
    ...room,
    walls: room.walls.map((wall) => ({
      ...wall,
      position: cornerToCenteredPositionMm(wall.position, room.widthMm, room.depthMm),
    })),
  };
}

/** Posição wallStore (cm) → metros no viewer; converte canto→centrado se legado. */
export function wallStorePositionToViewerMeters(
  wall: Wall,
  walls: Wall[],
  widthCm: number,
  depthCm: number
): { x: number; y: number; z: number } {
  let xCm = wall.position?.x ?? 0;
  let zCm = wall.position?.z ?? 0;
  if (isLegacyCornerWallStoreLayout(walls, widthCm)) {
    xCm -= widthCm / 2;
    zCm -= depthCm / 2;
  }
  return {
    x: xCm / 100,
    y: wall.position?.y != null ? wall.position.y / 100 : Math.max(0.1, wall.heightCm / 100) / 2,
    z: zCm / 100,
  };
}

/** Layout conectado em cm (centros de parede), sistema centrado. */
export function computeCenteredConnectedLayoutCm(
  walls: Wall[]
): Array<{ x: number; z: number; rotation: number }> {
  if (walls.length === 0) return [];
  const n = Math.min(4, walls.length);
  const lengths = walls.map((wall) => wall.lengthCm ?? 300);
  const W = lengths[0];
  const D = lengths[1] ?? lengths[0];
  const tHalf = (walls[0]?.thicknessCm ?? 20) / 2;
  const layout: Array<{ x: number; z: number; rotation: number }> = [];
  if (n >= 1) layout.push({ x: 0, z: -D / 2 - tHalf, rotation: 0 });
  if (n >= 2) layout.push({ x: W / 2 + tHalf, z: 0, rotation: 90 });
  if (n >= 3) layout.push({ x: 0, z: D / 2 + tHalf, rotation: 0 });
  if (n >= 4) layout.push({ x: -W / 2 - tHalf, z: 0, rotation: 90 });
  return layout;
}
