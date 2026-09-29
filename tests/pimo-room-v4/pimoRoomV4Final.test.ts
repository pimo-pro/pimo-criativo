import { describe, expect, it } from "vitest";
import {
  PimoRoom,
  RoomEngineBoundary,
  ROOM_ENGINE_PHASE,
  ROOM_ENGINE_VERSION,
  RoomIndustrialAdapter,
  applyAiPreset,
  attachRoomMetadataToDocument,
  autoArrange,
  autoDesign,
  buildRoomReportMetadata,
  exportGlb,
  loadRoom,
  setRoomState,
  getRoomState,
} from "../../src/pimo-room-v4";
import { buildRectangularRoomState } from "../../src/pimo-room-v4/RoomConverter";
import { CatalogItemManager } from "../../src/pimo-room-v4/catalog/CatalogItemManager";
import { RoomBridge } from "../../src/pimo-room-v4/RoomBridge";
import { buildSimpleIfcOneLevel } from "./fixtures/ifcFixtures";

describe("pimo-room v4 — Final Integration", () => {
  it("versionamento oficial", () => {
    expect(ROOM_ENGINE_VERSION).toBe("4.0");
    expect(ROOM_ENGINE_PHASE).toBe("FINAL");
    expect(PimoRoom.version).toBe("4.0");
    expect(PimoRoom.phase).toBe("FINAL");
    expect(PimoRoom.alfaVersion).toBe("4.0");
    expect(RoomEngineBoundary.version).toBe("4.0");
    expect(typeof RoomEngineBoundary.viewer.setHost).toBe("function");
    expect(typeof RoomEngineBoundary.viewer.getHost).toBe("function");
  });

  it("API pública loadRoom / get/setRoomState", () => {
    const loaded = loadRoom({
      walls: [
        { id: "w1", start: [0, 0], end: [4, 0], height: 2.6, thickness: 0.2 },
        { id: "w2", start: [4, 0], end: [4, 3], height: 2.6, thickness: 0.2 },
        { id: "w3", start: [4, 3], end: [0, 3], height: 2.6, thickness: 0.2 },
        { id: "w4", start: [0, 3], end: [0, 0], height: 2.6, thickness: 0.2 },
      ],
    });
    expect(loaded.ok).toBe(true);
    setRoomState(loaded.state);
    expect(getRoomState()?.walls.length).toBeGreaterThanOrEqual(4);
  });

  it("adapter industrial não cria workspaceBoxes (cutlist-safe)", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = CatalogItemManager.add(state, "sofa-2s");
    const sync = RoomIndustrialAdapter.sync(state);
    expect(sync.workspaceBoxes).toEqual([]);
    expect(sync.constraints.cutlistSafe).toBe(true);
    expect(RoomIndustrialAdapter.assertIndustrialIsolation(sync)).toBe(true);
    expect(sync.projectRoom.widthMm).toBeGreaterThan(0);
    expect(sync.furnitureHints.length).toBe(1);
    expect(sync.furnitureHints[0]!.industrialSafe).toBe(true);
  });

  it("metadados PDF/cutlist anexáveis sem mutar documento industrial", () => {
    const state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const meta = buildRoomReportMetadata(state);
    expect(meta.roomEngineVersion).toBe("4.0");
    expect(meta.levels.length).toBe(1);
    const doc = attachRoomMetadataToDocument({ cutlist: [], nesting: {} }, state);
    expect(doc.cutlist).toEqual([]);
    expect(doc.pimoRoom?.footprint.widthMm).toBeGreaterThan(0);
  });

  it("AI + indústria: design não gera caixas de fabrico", () => {
    const state = buildRectangularRoomState({
      widthMm: 5000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const designed = autoDesign("moderno", state);
    expect(designed).not.toBeNull();
    const sync = RoomIndustrialAdapter.sync(designed!.state);
    expect(sync.workspaceBoxes.length).toBe(0);
    expect(sync.metadata.items.length).toBeGreaterThan(0);
  });

  it("applyAiPreset + autoArrange via API", () => {
    let state = buildRectangularRoomState({
      widthMm: 5000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const preset = applyAiPreset("minimalista", state);
    expect(preset.ok).toBe(true);
    expect(preset.state!.items.length).toBeGreaterThan(0);
    const arranged = autoArrange(preset.state!);
    expect(arranged!.movedIds.length).toBeGreaterThanOrEqual(0);
  });

  it("export GLB após AI", async () => {
    const state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const designed = autoDesign("industrial", state)!;
    const exported = await exportGlb(designed.state);
    expect(exported.ok).toBe(true);
    expect(exported.buffer!.byteLength).toBeGreaterThan(100);
  });

  it("import IFC via bridge (integração)", async () => {
    const result = await RoomBridge.importIfcText(buildSimpleIfcOneLevel(), "admin.ifc");
    expect(result.ok).toBe(true);
    const sync = RoomIndustrialAdapter.sync(result.state!);
    expect(sync.projectRoom.openings.length).toBeGreaterThanOrEqual(0);
    expect(sync.workspaceBoxes).toEqual([]);
  });

  it("shim room-engine reexporta pimo-room-v4", async () => {
    const shim = await import("../../src/room-engine");
    expect(shim.ROOM_ENGINE_PHASE).toBe("FINAL");
    expect(shim.ROOM_ENGINE_VERSION).toBe("4.0");
    expect(typeof shim.loadRoom).toBe("function");
  });
});
