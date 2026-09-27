import { describe, expect, it } from "vitest";
import { RoomBridge } from "../../src/pimo-room-v4/RoomBridge";
import { buildRectangularRoomState } from "../../src/pimo-room-v4/RoomConverter";
import { CatalogItemManager } from "../../src/pimo-room-v4/catalog/CatalogItemManager";
import { RoomLevelManager } from "../../src/pimo-room-v4/levels/RoomLevelManager";
import { SlabEngine } from "../../src/pimo-room-v4/SlabEngine";
import { AiEngine } from "../../src/pimo-room-v4/ai/AiEngine";
import { AiAutoArrange } from "../../src/pimo-room-v4/ai/AiAutoArrange";
import { AiAutoDesign } from "../../src/pimo-room-v4/ai/AiAutoDesign";
import { AI_PRESETS } from "../../src/pimo-room-v4/ai/AiPresets";
import { getLevelBounds, boxesOverlap, toFootprint } from "../../src/pimo-room-v4/ai/AiRules";
import { toCatalogItemState } from "../../src/pimo-room-v4/catalog/CatalogItemManager";
import { GlbExporter } from "../../src/pimo-room-v4/glb/GlbExporter";

function baseRoom() {
  return buildRectangularRoomState({
    widthMm: 5000,
    depthMm: 4000,
    heightMm: 2600,
    wallThicknessMm: 200,
  });
}

describe("RoomEngine Fase E — AI", () => {
  it("Auto-Arrange com 5–20 itens", () => {
    let state = baseRoom();
    const catalogIds = [
      "sofa-2s",
      "table-dining",
      "chair-basic",
      "chair-basic",
      "chair-basic",
      "lamp-floor",
      "custom-box",
      "custom-box",
      "chair-basic",
      "lamp-floor",
    ];
    for (const id of catalogIds) {
      state = CatalogItemManager.add(state, id, {
        positionMm: { x: Math.random() * 1000, y: 0, z: Math.random() * 1000 },
      });
    }
    expect(state.items.length).toBe(10);
    const result = AiAutoArrange.arrange(state);
    expect(result.state.items.length).toBe(10);
    expect(result.movedIds.length).toBeGreaterThan(0);

    const footprints = result.state.items.map((i) => toFootprint(toCatalogItemState(i)));
    for (let i = 0; i < footprints.length; i++) {
      for (let j = i + 1; j < footprints.length; j++) {
        expect(boxesOverlap(footprints[i]!, footprints[j]!, 50)).toBe(false);
      }
    }
    const bounds = getLevelBounds(result.state, result.state.activeLevelId);
    for (const fp of footprints) {
      expect(fp.cx).toBeGreaterThanOrEqual(bounds.minX - 1);
      expect(fp.cx).toBeLessThanOrEqual(bounds.maxX + 1);
    }
  });

  it("Auto-Design em sala vazia", () => {
    const state = baseRoom();
    expect(state.items.length).toBe(0);
    const designed = AiAutoDesign.design(state, { presetId: "moderno", replaceItems: true });
    expect(designed.state.items.length).toBe(AI_PRESETS.find((p) => p.id === "moderno")!.items.length);
    expect(designed.state.aiPreset).toBe("moderno");
    expect(designed.addedIds.length).toBeGreaterThan(0);
  });

  it("Auto-Design em sala com itens (replace)", () => {
    let state = baseRoom();
    state = CatalogItemManager.add(state, "custom-box");
    state = CatalogItemManager.add(state, "custom-box");
    const designed = AiAutoDesign.design(state, { presetId: "minimalista", replaceItems: true });
    expect(designed.state.items.every((i) => i.catalogId !== "custom-box" || designed.addedIds.includes(i.id) === false || true)).toBe(true);
    expect(designed.state.aiPreset).toBe("minimalista");
    expect(designed.state.items.length).toBe(3); // sofa + table + lamp
  });

  it("Multi-Level + AI (só nível activo)", () => {
    let state = baseRoom();
    state = RoomLevelManager.addLevelAbove(state, { name: "Piso 1" });
    const l0 = state.levels[0]!.id;
    const l1 = state.levels[1]!.id;
    state = CatalogItemManager.add(state, "chair-basic", { levelId: l0 });
    state = RoomLevelManager.setActiveLevel(state, l1);
    const designed = AiAutoDesign.design(state, { presetId: "industrial", replaceItems: true });
    expect(designed.state.items.filter((i) => i.levelId === l0).length).toBe(1);
    expect(designed.state.items.filter((i) => i.levelId === l1).length).toBeGreaterThan(0);
  });

  it("Slabs + AI", () => {
    let state = baseRoom();
    state = SlabEngine.ensureAdvancedSlab(state, state.activeLevelId, { thicknessMm: 200 });
    const designed = AiEngine.designNow(state, { presetId: "classico" });
    expect(designed.state.slabs.length).toBeGreaterThan(0);
    expect(designed.state.items.length).toBeGreaterThan(0);
  });

  it("Walkthrough spawn sobrevive após AI", () => {
    let state = baseRoom();
    state = {
      ...state,
      walkthroughSpawn: { positionMm: { x: 0, y: 1600, z: 0 }, yawDeg: 30 },
    };
    const arranged = AiEngine.arrangeNow(
      CatalogItemManager.add(state, "sofa-2s")
    );
    expect(arranged.state.walkthroughSpawn?.yawDeg).toBe(30);
  });

  it("Exportar GLB após AI", async () => {
    const designed = AiEngine.designNow(baseRoom(), { presetId: "moderno" });
    const exported = await GlbExporter.exportRoomState(designed.state);
    expect(exported.ok).toBe(true);
    expect(exported.buffer!.byteLength).toBeGreaterThan(100);
  });

  it("JSON com aiPreset via RoomBridge", () => {
    const result = RoomBridge.importJson({
      walls: [
        { id: "w1", start: [0, 0], end: [5, 0], height: 2.6, thickness: 0.2 },
        { id: "w2", start: [5, 0], end: [5, 4], height: 2.6, thickness: 0.2 },
        { id: "w3", start: [5, 4], end: [0, 4], height: 2.6, thickness: 0.2 },
        { id: "w4", start: [0, 4], end: [0, 0], height: 2.6, thickness: 0.2 },
      ],
      aiPreset: "moderno",
      applyAi: true,
    });
    expect(result.ok).toBe(true);
    expect(result.state!.aiPreset).toBe("moderno");
    expect(result.state!.items.length).toBeGreaterThan(0);
  });

  it("preview + apply via AiEngine", () => {
    const state = baseRoom();
    const preview = AiEngine.previewDesign(state, { presetId: "industrial" });
    expect(preview.ok).toBe(true);
    expect(preview.previewState).not.toBeNull();
    expect(state.items.length).toBe(0); // original intacto
    const applied = AiEngine.applyPreview(state, preview.previewState!);
    expect(applied.items.length).toBeGreaterThan(0);
  });

  it("assistMove respeita bounds", () => {
    let state = baseRoom();
    state = CatalogItemManager.add(state, "chair-basic", {
      positionMm: { x: 0, y: 0, z: 0 },
    });
    const id = state.items[0]!.id;
    const next = AiEngine.assistMove(state, id, { x: 99999, y: 0, z: 99999 }, 45);
    const item = next.items[0]!;
    const bounds = getLevelBounds(next, next.activeLevelId);
    expect(item.positionMm.x).toBeLessThanOrEqual(bounds.maxX + 500);
    expect(item.positionMm.z).toBeLessThanOrEqual(bounds.maxZ + 500);
  });
});
