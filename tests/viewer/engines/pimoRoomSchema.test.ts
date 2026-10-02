import { describe, expect, it } from "vitest";
import {
  createDefaultProjectRoom,
  normalizeProjectRoom,
  projectRoomToWallStoreWalls,
  wallStoreToProjectRoom,
} from "../../../src/3d/viewer-engine/room/RoomEngine";
import {
  PIMO_ROOM_MODULE,
  pimoRoomGraphToProjectRoom,
  projectRoomToPimoRoomGraph,
} from "../../../src/pimo-room/mesh/impl/pimoRoomSchema";

describe("pimo-room schema + snapshot cm (M10.b)", () => {
  it("identifica o módulo como pimo-room v4", () => {
    expect(PIMO_ROOM_MODULE.name).toBe("pimo-room");
    expect(PIMO_ROOM_MODULE.version.startsWith("4.")).toBe(true);
  });

  it("round-trip ProjectRoomConfig ↔ grafo pimo-room preserva footprint", () => {
    const room = createDefaultProjectRoom();
    const graph = projectRoomToPimoRoomGraph(room);
    expect(graph.walls).toHaveLength(4);
    expect(graph.doors.length + graph.windows.length).toBe(room.openings.length);
    expect(graph.zones[0]?.spaceRole).toBe("room");

    const back = pimoRoomGraphToProjectRoom(graph);
    const normalized = normalizeProjectRoom(back);
    expect(normalized).not.toBeNull();
    expect(normalized!.widthMm).toBe(room.widthMm);
    expect(normalized!.depthMm).toBe(room.depthMm);
    expect(normalized!.heightMm).toBe(room.heightMm);
    expect(normalized!.walls).toHaveLength(4);
  });

  it("projectRoom → paredes cm → ProjectRoomConfig preserva footprint", () => {
    const room = createDefaultProjectRoom();
    const walls = projectRoomToWallStoreWalls(room);
    expect(walls.length).toBe(4);
    expect(walls.every((w) => w.openings)).toBe(true);

    const back = wallStoreToProjectRoom(walls, {
      locked: room.locked,
      visible: room.visible,
      floorMode: room.floorMode,
      ceilingVisible: room.ceilingVisible,
      hiddenWalls: room.hiddenWalls,
      utilities: room.utilities,
    });
    expect(back).not.toBeNull();
    expect(back!.widthMm).toBe(room.widthMm);
    expect(back!.depthMm).toBe(room.depthMm);
    expect(back!.openings.length).toBe(room.openings.length);
  });

  it("alterar dimensões no SSOT reflecte-se nas paredes cm derivadas", () => {
    const room = createDefaultProjectRoom();
    const scaled = normalizeProjectRoom({
      ...room,
      widthMm: 5000,
      depthMm: 3500,
      heightMm: 2700,
      walls: room.walls.map((w) => ({
        ...w,
        widthMm: w.label === "sul" || w.label === "norte" ? 5000 : 3500,
        lengthMm: w.label === "sul" || w.label === "norte" ? 5000 : 3500,
        heightMm: 2700,
      })),
    });
    expect(scaled).not.toBeNull();
    const walls = projectRoomToWallStoreWalls(scaled!);
    expect(walls[0]?.lengthCm).toBeCloseTo(500, 0);
    expect(walls[1]?.lengthCm).toBeCloseTo(350, 0);
    expect(walls[0]?.heightCm).toBeCloseTo(270, 0);
  });
});
