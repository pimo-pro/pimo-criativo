/**
 * pimo-room v4 — sincroniza transforms de parede do viewer para ProjectRoomConfig (opt-in).
 * Não altera o contrato rectangular canónico; actualiza posição/rotação/comprimento da parede.
 */
import type { ProjectRoomConfig } from "../viewer-engine/room/roomEngineTypes";
import { applyProjectRoomDimensions, normalizeProjectRoom } from "../viewer-engine/room/RoomEngine";
import { applyWallLengthToRoom } from "./roomAdvancedEdit";

export type WallViewerTransform = {
  wallIndex: number;
  positionM: { x: number; z: number };
  rotationDeg: number;
  lengthMm?: number;
};

/**
 * Aplica transform de uma parede do viewer ao SSOT mm.
 * Para paredes canónicas (0..3), comprimento actualiza footprint; extras só patch local.
 */
export function applyWallViewerTransformToRoom(
  room: ProjectRoomConfig,
  transform: WallViewerTransform
): ProjectRoomConfig {
  const wall = room.walls[transform.wallIndex];
  if (!wall) return room;

  let next: ProjectRoomConfig = {
    ...room,
    walls: room.walls.map((w, i) =>
      i === transform.wallIndex
        ? {
            ...w,
            position: {
              x: transform.positionM.x * 1000,
              y: w.position.y,
              z: transform.positionM.z * 1000,
            },
            rotationDeg: transform.rotationDeg,
            widthMm: transform.lengthMm ?? w.widthMm,
            lengthMm: transform.lengthMm ?? w.lengthMm,
          }
        : w
    ),
  };

  if (transform.lengthMm != null && wall.label !== "extra") {
    next = applyWallLengthToRoom(next, wall.id, transform.lengthMm);
    // Reaplica posição/rotação após resize de footprint (centrado).
    next = {
      ...next,
      walls: next.walls.map((w, i) =>
        i === transform.wallIndex
          ? {
              ...w,
              position: {
                x: transform.positionM.x * 1000,
                y: w.position.y,
                z: transform.positionM.z * 1000,
              },
              rotationDeg: transform.rotationDeg,
            }
          : w
      ),
    };
  }

  if (wall.label !== "extra" && transform.lengthMm == null) {
    // Move/rotate de parede principal: manter footprint via applyProjectRoomDimensions
    // só se dimensões globais não mudaram — patch local já feito.
    return normalizeProjectRoom(next) ?? next;
  }

  return normalizeProjectRoom(next) ?? applyProjectRoomDimensions(next);
}
