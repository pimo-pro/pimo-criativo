import { describe, expect, it } from "vitest";
import { RoomBridge } from "../../src/pimo-room/domain/RoomBridge";
import { RoomConverter, buildRectangularRoomState } from "../../src/pimo-room/domain/RoomConverter";
import { RoomValidator } from "../../src/pimo-room/domain/RoomValidator";

describe("RoomEngine Fase A", () => {
  it("converte retângulo ↔ ProjectRoomConfig", () => {
    const state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    expect(state.walls.length).toBeGreaterThanOrEqual(4);
    const project = RoomConverter.toProjectRoomConfig(state);
    expect(project.widthMm).toBe(4000);
    expect(project.depthMm).toBe(3000);
    expect(project.walls.length).toBe(4);
    const roundTrip = RoomConverter.fromProjectRoomConfig(project);
    expect(roundTrip.footprint?.widthMm).toBe(4000);
  });

  it("importa JSON floorplan simplificado (metros)", () => {
    const json = {
      walls: [
        { id: "w1", start: [-2, -1.5], end: [2, -1.5], height: 2.6, thickness: 0.2 },
        { id: "w2", start: [2, -1.5], end: [2, 1.5], height: 2.6, thickness: 0.2 },
        { id: "w3", start: [2, 1.5], end: [-2, 1.5], height: 2.6, thickness: 0.2 },
        { id: "w4", start: [-2, 1.5], end: [-2, -1.5], height: 2.6, thickness: 0.2 },
      ],
      doors: [{ id: "d1", type: "door", wallId: "w1", width: 0.9, height: 2.1, position: [0, 1.05, 0] }],
      windows: [{ id: "win1", type: "window", wallId: "w3", width: 1.2, height: 1.2, position: [0, 1.5, 0] }],
    };
    const result = RoomBridge.importJson(json);
    expect(result.ok).toBe(true);
    expect(result.projectRoom).not.toBeNull();
    expect(result.projectRoom!.widthMm).toBeGreaterThanOrEqual(3900);
    expect(result.projectRoom!.depthMm).toBeGreaterThanOrEqual(2900);
    expect(result.projectRoom!.openings.length).toBeGreaterThanOrEqual(1);
  });

  it("importa grafo nodes floorplan", () => {
    const result = RoomBridge.importJson({
      nodes: {
        w1: { type: "wall", start: [0, 0], end: [4, 0], height: 2.7, thickness: 0.15 },
        w2: { type: "wall", start: [4, 0], end: [4, 3], height: 2.7, thickness: 0.15 },
        w3: { type: "wall", start: [4, 3], end: [0, 3], height: 2.7, thickness: 0.15 },
        w4: { type: "wall", start: [0, 3], end: [0, 0], height: 2.7, thickness: 0.15 },
        d1: { type: "door", wallId: "w1", width: 0.8, height: 2.1, position: [0, 1.05, 0] },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.state!.walls).toHaveLength(4);
    expect(RoomValidator.hasErrors(result.state!)).toBe(false);
  });
});
