import { describe, expect, it } from "vitest";
import { RoomBridge } from "../../src/pimo-room-v4/RoomBridge";
import { RoomLevelManager } from "../../src/pimo-room-v4/levels/RoomLevelManager";
import { CatalogItemManager } from "../../src/pimo-room-v4/catalog/CatalogItemManager";
import { CATALOG_PRESETS } from "../../src/pimo-room-v4/catalog/CatalogPresets";
import { createPlaceholderMesh } from "../../src/pimo-room-v4/catalog/createPlaceholderMesh";
import { buildRectangularRoomState } from "../../src/pimo-room-v4/RoomConverter";
import { RoomConverter } from "../../src/pimo-room-v4/RoomConverter";

describe("RoomEngine Fase C — Catálogo", () => {
  it("importa JSON com items[]", () => {
    const result = RoomBridge.importJson({
      walls: [
        { id: "w1", start: [0, 0], end: [4, 0], height: 2.6, thickness: 0.2 },
        { id: "w2", start: [4, 0], end: [4, 3], height: 2.6, thickness: 0.2 },
        { id: "w3", start: [4, 3], end: [0, 3], height: 2.6, thickness: 0.2 },
        { id: "w4", start: [0, 3], end: [0, 0], height: 2.6, thickness: 0.2 },
      ],
      items: [
        {
          id: "chair-1",
          catalogId: "chair-basic",
          type: "item",
          itemType: "chair",
          position: [0.5, 0, 0.2],
          rotationDeg: 45,
          scale: { x: 1, y: 1, z: 1 },
        },
        {
          id: "table-1",
          catalogId: "table-dining",
          type: "furniture",
          position: [0, 0, -0.5],
          rotationDeg: 0,
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.state!.items.length).toBe(2);
    expect(result.state!.items[0]!.catalogId).toBe("chair-basic");
    expect(result.state!.items[0]!.rotationDeg).toBe(45);
    expect(result.projectRoom!.catalogItems?.length).toBe(2);
  });

  it("adiciona, move, rotaciona e remove item manualmente", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = CatalogItemManager.add(state, "sofa-2s", {
      positionMm: { x: 100, y: 0, z: -200 },
    });
    expect(state.items).toHaveLength(1);
    const id = state.items[0]!.id;
    state = CatalogItemManager.move(state, id, { x: 500, y: 0, z: 300 });
    expect(state.items[0]!.positionMm).toEqual({ x: 500, y: 0, z: 300 });
    state = CatalogItemManager.rotate(state, id, 90);
    expect(state.items[0]!.rotationDeg).toBe(90);
    state = CatalogItemManager.duplicate(state, id);
    expect(state.items).toHaveLength(2);
    state = CatalogItemManager.remove(state, id);
    expect(state.items).toHaveLength(1);
    expect(state.items[0]!.id).not.toBe(id);
  });

  it("mantém itens ao trocar de nível (filtra por levelId)", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    const l0 = state.activeLevelId;
    state = CatalogItemManager.add(state, "chair-basic", {
      positionMm: { x: 0, y: 0, z: 0 },
      levelId: l0,
    });
    state = RoomLevelManager.addLevelAbove(state, { name: "Piso 1" });
    const l1 = state.levels[1]!.id;
    state = CatalogItemManager.add(state, "lamp-floor", {
      positionMm: { x: 200, y: 0, z: 0 },
      levelId: l1,
    });
    expect(CatalogItemManager.list(state, l0)).toHaveLength(1);
    expect(CatalogItemManager.list(state, l1)).toHaveLength(1);
    state = RoomLevelManager.setActiveLevel(state, l1);
    expect(CatalogItemManager.list(state, state.activeLevelId)[0]!.catalogId).toBe("lamp-floor");
  });

  it("converte CatalogItemState → ProjectRoomConfig metadados e volta", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = CatalogItemManager.add(state, "table-dining", {
      positionMm: { x: -100, y: 0, z: 50 },
    });
    const project = RoomConverter.toProjectRoomConfig(state);
    expect(project.catalogItems).toHaveLength(1);
    expect(project.catalogItems![0]!.catalogId).toBe("table-dining");
    const back = RoomConverter.fromProjectRoomConfig(project);
    expect(back.items).toHaveLength(1);
    expect(back.items[0]!.positionMm.x).toBe(-100);
  });

  it("presets e placeholders cobrem todos os tipos", () => {
    expect(CATALOG_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of CATALOG_PRESETS) {
      const mesh = createPlaceholderMesh(preset);
      expect(mesh.children.length).toBeGreaterThan(0);
      mesh.traverse((c) => {
        if ("geometry" in c && c.geometry) {
          (c.geometry as { dispose?: () => void }).dispose?.();
        }
      });
    }
  });

  it("RoomBridge.catalogItemsToProjectMeta exporta metadados", () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = CatalogItemManager.add(state, "custom-box");
    const meta = RoomBridge.catalogItemsToProjectMeta(state);
    expect(meta[0]!.type).toBe("custom");
    expect(meta[0]!.scale).toEqual({ x: 1, y: 1, z: 1 });
  });
});
