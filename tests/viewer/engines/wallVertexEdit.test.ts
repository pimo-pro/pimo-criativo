/**
 * pimo-room v4 — edição de vértices / transforms de parede → ProjectRoomConfig.
 */
import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom } from "../../../src/3d/viewer-engine/room/RoomEngine";
import { applyWallViewerTransformToRoom } from "../../../src/3d/room/wallVertexEdit";

describe("applyWallViewerTransformToRoom", () => {
  it("actualiza posição e rotação da parede sem partir o footprint global", () => {
    const room = createDefaultProjectRoom();
    const wallIndex = 0;
    const next = applyWallViewerTransformToRoom(room, {
      wallIndex,
      positionM: { x: 0.5, z: -2.1 },
      rotationDeg: 5,
    });
    expect(next.widthMm).toBe(room.widthMm);
    expect(next.depthMm).toBe(room.depthMm);
    expect(next.walls[wallIndex].position.x).toBeCloseTo(500, 0);
    expect(next.walls[wallIndex].position.z).toBeCloseTo(-2100, 0);
    expect(next.walls[wallIndex].rotationDeg).toBeCloseTo(5, 5);
    expect(next.openings.length).toBe(room.openings.length);
  });

  it("redimensiona parede sul e sincroniza widthMm da sala", () => {
    const room = createDefaultProjectRoom();
    const sulIndex = room.walls.findIndex((w) => w.label === "sul");
    expect(sulIndex).toBeGreaterThanOrEqual(0);
    const next = applyWallViewerTransformToRoom(room, {
      wallIndex: sulIndex,
      positionM: {
        x: room.walls[sulIndex].position.x / 1000,
        z: room.walls[sulIndex].position.z / 1000,
      },
      rotationDeg: room.walls[sulIndex].rotationDeg,
      lengthMm: 4200,
    });
    expect(next.widthMm).toBe(4200);
    expect(next.walls[sulIndex].widthMm).toBe(4200);
  });

  it("preserva aberturas e ids de paredes ao mover", () => {
    const room = createDefaultProjectRoom();
    const ids = room.walls.map((w) => w.id);
    const openingIds = room.openings.map((o) => o.id);
    const next = applyWallViewerTransformToRoom(room, {
      wallIndex: 1,
      positionM: { x: 2, z: 0 },
      rotationDeg: 90,
    });
    expect(next.walls.map((w) => w.id)).toEqual(ids);
    expect(next.openings.map((o) => o.id)).toEqual(openingIds);
  });
});
