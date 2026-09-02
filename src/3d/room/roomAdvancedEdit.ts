/**
 * pimo-room v4 — helpers de edição avançada da sala (comprimento de parede / footprint).
 */
import type { ProjectRoomConfig, ProjectRoomWall, RoomWallLabel } from "../viewer-engine/room/roomEngineTypes";
import { applyProjectRoomDimensions, normalizeProjectRoom } from "../viewer-engine/room/RoomEngine";

/** Actualiza o comprimento de uma parede canónica e sincroniza width/depth da sala. */
export function applyWallLengthToRoom(
  room: ProjectRoomConfig,
  wallId: string,
  lengthMm: number
): ProjectRoomConfig {
  const wall = room.walls.find((w) => w.id === wallId);
  if (!wall) return room;
  const nextLen = Math.max(500, lengthMm);
  let widthMm = room.widthMm;
  let depthMm = room.depthMm;
  const label: RoomWallLabel = wall.label;
  if (label === "sul" || label === "norte") widthMm = nextLen;
  else if (label === "este" || label === "oeste") depthMm = nextLen;
  else {
    const walls: ProjectRoomWall[] = room.walls.map((w) =>
      w.id === wallId ? { ...w, widthMm: nextLen, lengthMm: nextLen } : w
    );
    return normalizeProjectRoom({ ...room, walls }) ?? room;
  }
  return applyProjectRoomDimensions(
    normalizeProjectRoom({ ...room, widthMm, depthMm }) ?? { ...room, widthMm, depthMm }
  );
}
