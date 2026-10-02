import { describe, expect, it } from "vitest";
import { FloorEngine } from "../../src/pimo-room-v4/FloorEngine";
import { OpeningsEngine } from "../../src/pimo-room-v4/OpeningsEngine";
import { RoomBridge } from "../../src/pimo-room-v4/RoomBridge";
import { buildRectangularRoomState } from "../../src/pimo-room-v4/RoomConverter";
import { patchProjectOpeningFromDoorConfig } from "../../src/pimo-room-v4/openingsHost";
import type { DoorWindowConfig } from "../../src/3d/room/types";

describe("Pré-release RoomEngine 4.0", () => {
  it("FloorEngine alinha footprint e slab à RoomGeometry", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    expect(state.footprint?.widthMm).toBe(4000);
    // Forçar sync após “import” — footprint segue paredes
    state = {
      ...state,
      footprint: {
        widthMm: 1000,
        depthMm: 1000,
        heightMm: 2600,
        wallThicknessMm: 200,
      },
    };
    const synced = FloorEngine.syncAllLevels(state);
    expect(synced.footprint?.widthMm).toBeGreaterThanOrEqual(3900);
    expect(synced.footprint?.depthMm).toBeGreaterThanOrEqual(2900);
    const slab = synced.slabs.find((s) => s.levelId === synced.activeLevelId);
    expect(slab?.polygonMm.length).toBe(4);
    expect(slab?.autoFromWalls).toBe(true);
  });

  it("import JSON actualiza piso automaticamente", () => {
    const result = RoomBridge.importJson({
      walls: [
        { id: "w1", start: [-3, -2], end: [3, -2], height: 2.6, thickness: 0.2 },
        { id: "w2", start: [3, -2], end: [3, 2], height: 2.6, thickness: 0.2 },
        { id: "w3", start: [3, 2], end: [-3, 2], height: 2.6, thickness: 0.2 },
        { id: "w4", start: [-3, 2], end: [-3, -2], height: 2.6, thickness: 0.2 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.state!.footprint!.widthMm).toBeGreaterThanOrEqual(5900);
    expect(result.state!.footprint!.depthMm).toBeGreaterThanOrEqual(3900);
    expect(result.state!.slabs.length).toBeGreaterThanOrEqual(1);
  });

  it("mover porta/janela sincroniza posição da abertura", () => {
    const state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const wallId = state.walls[0]!.id;
    let next = OpeningsEngine.addOpening(state, {
      type: "door",
      wallId,
      kind: "normal",
      offsetAlongWallMm: 500,
      widthMm: 900,
      heightMm: 2100,
      sillMm: 0,
      thicknessMm: 40,
    });
    const id = next.openings[0]!.id;
    next = OpeningsEngine.syncPositionFromDoorWindow(next, id, {
      offsetAlongWallMm: 1200,
      sillMm: 0,
    });
    expect(next.openings[0]!.offsetAlongWallMm).toBe(1200);

    const project = RoomBridge.roomStateToProjectRoom(next);
    const config: DoorWindowConfig = {
      widthMm: 900,
      heightMm: 2100,
      floorOffsetMm: 100,
      horizontalOffsetMm: 1500,
    };
    const patched = patchProjectOpeningFromDoorConfig(project, id, config);
    const opening = patched.openings.find((o) => o.id === id)!;
    expect(opening.horizontalOffsetMm).toBe(1500);
    expect(opening.xPosMm).toBe(1500);
    expect(opening.floorOffsetMm).toBe(100);
    expect(opening.verticalOffsetMm).toBe(100);
  });

  it("teclado: nudge / rotate / duplicate / delete em aberturas", () => {
    const state = buildRectangularRoomState({
      widthMm: 5000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const wallId = state.walls[0]!.id;
    let next = OpeningsEngine.addOpening(state, {
      type: "window",
      wallId,
      kind: "normal",
      offsetAlongWallMm: 800,
      widthMm: 1200,
      heightMm: 1200,
      sillMm: 900,
      thicknessMm: 40,
    });
    const id = next.openings[next.openings.length - 1]!.id;
    expect(next.openings.find((o) => o.id === id)!.offsetAlongWallMm).toBe(800);

    next = OpeningsEngine.nudge(next, id, { alongWallMm: OpeningsEngine.nudgeStepMm(false) });
    expect(next.openings.find((o) => o.id === id)!.offsetAlongWallMm).toBe(850);

    next = OpeningsEngine.nudge(next, id, { alongWallMm: OpeningsEngine.nudgeStepMm(true) });
    expect(next.openings.find((o) => o.id === id)!.offsetAlongWallMm).toBe(1050);

    next = OpeningsEngine.rotate(next, id, 1);
    expect(next.openings.find((o) => o.id === id)!.kind).toBe("correr");

    next = OpeningsEngine.duplicate(next, id);
    const afterDup = next.openings.filter((o) => o.type === "window");
    expect(afterDup.length).toBeGreaterThanOrEqual(2);
    const dupId = next.openings[next.openings.length - 1]!.id;
    expect(dupId).not.toBe(id);

    next = OpeningsEngine.removeOpening(next, dupId);
    expect(next.openings.some((o) => o.id === dupId)).toBe(false);
    expect(next.openings.some((o) => o.id === id)).toBe(true);
  });

  it("mensagens RoomBridge usam texto pimo (floorplan)", () => {
    expect(() => RoomBridge.jsonToRoomState({ foo: 1 })).toThrow(/floorplan/);
    expect(() => RoomBridge.jsonToRoomState({ foo: 1 })).toThrowError(
      /não reconhecido como floorplan \/ RoomState/
    );
  });
});
