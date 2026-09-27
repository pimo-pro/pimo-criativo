import { describe, expect, it } from "vitest";
import { RoomBridge } from "../../src/pimo-room-v4/RoomBridge";
import { RoomLevelManager } from "../../src/pimo-room-v4/levels/RoomLevelManager";
import { RoomLevelGeometry } from "../../src/pimo-room-v4/levels/RoomLevelGeometry";
import { SlabEngine } from "../../src/pimo-room-v4/SlabEngine";
import { RoomConverter, buildRectangularRoomState } from "../../src/pimo-room-v4/RoomConverter";
import { enrichLevelsWithElevations } from "../../src/pimo-room-v4/levels/RoomLevelState";

describe("RoomEngine Fase B", () => {
  it("importa JSON com 2 níveis", () => {
    const result = RoomBridge.importJson({
      levels: [
        { id: "L0", ordinal: 0, height: 2.7, name: "Rés-do-chão" },
        { id: "L1", ordinal: 1, height: 2.6, name: "1º andar" },
      ],
      walls: [
        { id: "w0a", parentId: "L0", start: [-2, -1.5], end: [2, -1.5], height: 2.7, thickness: 0.2 },
        { id: "w0b", parentId: "L0", start: [2, -1.5], end: [2, 1.5], height: 2.7, thickness: 0.2 },
        { id: "w0c", parentId: "L0", start: [2, 1.5], end: [-2, 1.5], height: 2.7, thickness: 0.2 },
        { id: "w0d", parentId: "L0", start: [-2, 1.5], end: [-2, -1.5], height: 2.7, thickness: 0.2 },
        { id: "w1a", parentId: "L1", start: [-2, -1.5], end: [2, -1.5], height: 2.6, thickness: 0.2 },
        { id: "w1b", parentId: "L1", start: [2, -1.5], end: [2, 1.5], height: 2.6, thickness: 0.2 },
        { id: "w1c", parentId: "L1", start: [2, 1.5], end: [-2, 1.5], height: 2.6, thickness: 0.2 },
        { id: "w1d", parentId: "L1", start: [-2, 1.5], end: [-2, -1.5], height: 2.6, thickness: 0.2 },
      ],
      camera: { position: [0, 1.6, 0], yawDeg: 90 },
    });
    expect(result.ok).toBe(true);
    expect(result.state!.levels).toHaveLength(2);
    expect(result.state!.walls.filter((w) => w.levelId === "L0")).toHaveLength(4);
    expect(result.state!.walls.filter((w) => w.levelId === "L1")).toHaveLength(4);
    expect(result.state!.walkthroughSpawn?.yawDeg).toBe(90);
    const elev = enrichLevelsWithElevations(result.state!.levels);
    expect(elev[1]!.baseElevationMm).toBeGreaterThan(2500);
  });

  it("importa JSON com slab e material", () => {
    const result = RoomBridge.importJson({
      walls: [
        { id: "w1", start: [0, 0], end: [4, 0], height: 2.6, thickness: 0.15 },
        { id: "w2", start: [4, 0], end: [4, 3], height: 2.6, thickness: 0.15 },
        { id: "w3", start: [4, 3], end: [0, 3], height: 2.6, thickness: 0.15 },
        { id: "w4", start: [0, 3], end: [0, 0], height: 2.6, thickness: 0.15 },
      ],
      slabs: [{ id: "s1", thickness: 0.25, elevation: 0, polygon: [[0, 0], [4, 0], [4, 3], [0, 3]] }],
    });
    expect(result.ok).toBe(true);
    const slab = SlabEngine.getActiveSlab(result.state!);
    expect(slab).not.toBeNull();
    expect(slab!.thicknessMm).toBe(250);
    expect(slab!.material?.kind).toBe("preset");
  });

  it("Adicionar Nível clona paredes e actualiza ProjectRoomConfig do activo", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = RoomLevelManager.addLevelAbove(state, { name: "Piso 1" });
    expect(state.levels).toHaveLength(2);
    expect(state.walls.length).toBeGreaterThanOrEqual(8);
    const project = RoomConverter.toProjectRoomConfig(state);
    expect(project.heightMm).toBe(2600);
    const stacked = RoomLevelGeometry.allStacked(state);
    expect(stacked).toHaveLength(2);
    expect(stacked[1]!.baseElevationM).toBeCloseTo(2.6, 1);
  });

  it("SlabEngine offset e espessura", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = SlabEngine.ensureAdvancedSlab(state, state.activeLevelId, { thicknessMm: 180 });
    const slab = SlabEngine.getActiveSlab(state)!;
    state = SlabEngine.setOffset(state, slab.id, { x: 100, z: -50 });
    const updated = SlabEngine.getActiveSlab(state)!;
    expect(updated.offsetMm).toEqual({ x: 100, z: -50 });
    expect(updated.thicknessMm).toBe(180);
  });
});
