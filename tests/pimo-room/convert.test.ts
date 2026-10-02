import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom } from "../../src/3d/viewer-engine/room/RoomEngine";
import {
  fromExternalGraph,
  fromProjectRoomConfig,
  toProjectRoomConfig,
} from "../../src/pimo-room/convert";

describe("pimo-room convert (M2)", () => {
  it("fromProjectRoomConfig ↔ toProjectRoomConfig preserva footprint mm", () => {
    const room = createDefaultProjectRoom();
    const state = fromProjectRoomConfig(room);
    const back = toProjectRoomConfig(state);
    expect(back.widthMm).toBe(room.widthMm);
    expect(back.depthMm).toBe(room.depthMm);
    expect(back.heightMm).toBe(room.heightMm);
    expect(back.wallThicknessMm).toBe(room.wallThicknessMm);
    expect(back.walls.length).toBeGreaterThanOrEqual(4);
  });

  it("fromExternalGraph aceita ProjectRoomConfig (grafo interno)", () => {
    const room = createDefaultProjectRoom();
    const state = fromExternalGraph(room);
    expect(state.walls.length).toBeGreaterThanOrEqual(4);
    const projectRoom = toProjectRoomConfig(state);
    expect(projectRoom.walls.length).toBeGreaterThanOrEqual(4);
    expect(projectRoom.widthMm).toBeGreaterThanOrEqual(room.widthMm);
    expect(projectRoom.depthMm).toBeGreaterThanOrEqual(room.depthMm);
    expect(Number.isFinite(projectRoom.heightMm)).toBe(true);
  });

  it("fromExternalGraph rejeita JSON inválido", () => {
    expect(() => fromExternalGraph({ foo: 1 })).toThrow(/não reconhecido/);
  });
});
