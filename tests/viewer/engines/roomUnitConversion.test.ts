import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom } from "../../../src/3d/viewer-engine/room/RoomEngine";
import {
  cmToMm,
  mmToCm,
  projectRoomToRoomSnapshot,
  projectRoomToWallStoreWalls,
  wallStoreFootprintMm,
  wallStoreToProjectRoom,
} from "../../../src/3d/viewer-engine/room/roomUnitConversion";
import type { Wall } from "../../../src/stores/wallStore";

function mkWall(partial: Partial<Wall> & Pick<Wall, "id">): Wall {
  return {
    lengthCm: 400,
    heightCm: 260,
    thicknessCm: 20,
    color: "#d1d5db",
    openings: [],
    ...partial,
  };
}

describe("roomUnitConversion (Z-03.3)", () => {
  it("converte mm ↔ cm de forma simétrica", () => {
    expect(mmToCm(4000)).toBe(400);
    expect(cmToMm(400)).toBe(4000);
  });

  it("footprint usa média das paredes opostas (não só w1)", () => {
    const walls: Wall[] = [
      mkWall({ id: "w0", lengthCm: 400 }),
      mkWall({ id: "w1", lengthCm: 300 }),
      mkWall({ id: "w2", lengthCm: 400 }),
      mkWall({ id: "w3", lengthCm: 350 }),
    ];
    const fp = wallStoreFootprintMm(walls);
    expect(fp).toEqual({ widthMm: 4000, depthMm: 3250, heightMm: 2600 });
  });

  it("ProjectRoomConfig → wallStore → ProjectRoomConfig mantém dimensões", () => {
    const room = createDefaultProjectRoom();
    const walls = projectRoomToWallStoreWalls(room);
    const roundTrip = wallStoreToProjectRoom(walls);
    expect(roundTrip?.widthMm).toBe(room.widthMm);
    expect(roundTrip?.depthMm).toBe(room.depthMm);
    expect(roundTrip?.heightMm).toBe(room.heightMm);
    expect(roundTrip?.walls).toHaveLength(4);
  });

  it("roomSnapshot derivado do SSOT espelha wallStore", () => {
    const room = createDefaultProjectRoom();
    const snapshot = projectRoomToRoomSnapshot(room, { selectedWallId: null, mainWallIndex: 0 });
    const walls = projectRoomToWallStoreWalls(room);
    expect(snapshot.walls[0]?.lengthCm).toBe(walls[0]?.lengthCm);
    expect(snapshot.mainWallIndex).toBe(0);
  });
});
