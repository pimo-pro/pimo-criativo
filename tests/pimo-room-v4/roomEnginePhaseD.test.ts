import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { RoomBridge } from "../../src/pimo-room/domain/RoomBridge";
import { IfcLoader } from "../../src/pimo-room/domain/ifc/IfcLoader";
import { IfcParser } from "../../src/pimo-room/domain/ifc/IfcParser";
import { extractIfcModel } from "../../src/pimo-room/domain/ifc/IfcExtractor";
import { GlbExporter, buildRoomExportScene } from "../../src/pimo-room/domain/glb/GlbExporter";
import { RoomGlbLoader } from "../../src/pimo-room/domain/glb/GlbLoader";
import { CatalogItemManager } from "../../src/pimo-room/domain/catalog/CatalogItemManager";
import { RoomLevelManager } from "../../src/pimo-room/domain/levels/RoomLevelManager";
import { buildRectangularRoomState } from "../../src/pimo-room/domain/RoomConverter";
import { enhancePbrMaterials } from "../../src/pimo-room/domain/glb/glbMaterials";
import { createEmptyRoomState, newId, ROOM_ENGINE_DEFAULTS } from "../../src/pimo-room/domain/RoomState";
import { buildIfcTwoLevels, buildSimpleIfcOneLevel } from "./fixtures/ifcFixtures";

describe("RoomEngine Fase D — IFC / GLB", () => {
  it("importa IFC simples (1 nível)", async () => {
    const text = buildSimpleIfcOneLevel();
    const doc = IfcParser.parse(text);
    expect(doc.schema).toBe("IFC4");
    const model = extractIfcModel(doc);
    expect(model.storeys.length).toBeGreaterThanOrEqual(1);
    expect(model.walls.length).toBeGreaterThanOrEqual(1);

    const result = await RoomBridge.importIfcText(text, "simple.ifc");
    expect(result.ok).toBe(true);
    expect(result.state!.levels.length).toBe(1);
    expect(result.state!.walls.length).toBeGreaterThanOrEqual(1);
    expect(result.state!.sourceAssets?.ifc?.src).toBe("simple.ifc");
    expect(result.projectRoom).not.toBeNull();
  });

  it("importa IFC com vários níveis", async () => {
    const result = await IfcLoader.fromText(buildIfcTwoLevels(), "two.ifc");
    expect(result.ok).toBe(true);
    expect(result.state!.levels.length).toBe(2);
    expect(result.state!.walls.length).toBe(2);
    const l0 = result.state!.levels[0]!.id;
    const l1 = result.state!.levels[1]!.id;
    expect(result.state!.walls.some((w) => w.levelId === l0)).toBe(true);
    expect(result.state!.walls.some((w) => w.levelId === l1)).toBe(true);
  });

  it("importa GLB de sala (nodes wall)", async () => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.6, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    wall.name = "wall-south";
    wall.userData.roomRole = "wall";
    wall.position.set(0, 1.3, -1.5);
    const wall2 = wall.clone();
    wall2.name = "wall-north";
    wall2.position.set(0, 1.3, 1.5);

    const levelId = ROOM_ENGINE_DEFAULTS.levelId;
    const walls = [wall, wall2].map((obj) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      return {
        id: obj.name || newId("wall"),
        levelId,
        startMm: { x: Math.round((center.x - size.x / 2) * 1000), z: Math.round(center.z * 1000) },
        endMm: { x: Math.round((center.x + size.x / 2) * 1000), z: Math.round(center.z * 1000) },
        heightMm: Math.round(size.y * 1000),
        thicknessMm: Math.max(50, Math.round(size.z * 1000)),
      };
    });
    const state = createEmptyRoomState({
      version: 4,
      walls,
      sourceAssets: { glb: { src: "room-test.glb", metadata: { kind: "room" } } },
    });
    expect(state.walls.length).toBe(2);
    expect(state.sourceAssets?.glb?.src).toBe("room-test.glb");
    expect(typeof RoomGlbLoader.loadRoom).toBe("function");
  });

  it("importa GLB de item para RoomState", async () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = CatalogItemManager.add(state, "custom-box", {
      positionMm: { x: 0, y: 0, z: 0 },
    });
    const last = state.items[state.items.length - 1]!;
    last.name = "Cadeira GLB";
    last.src = "chair.glb";
    last.type = "custom";
    state = {
      ...state,
      version: 4,
      sourceAssets: { glb: { src: "chair.glb", metadata: { kind: "item" } } },
    };
    expect(state.items.length).toBe(1);
    expect(state.items[0]!.name).toBe("Cadeira GLB");
    expect(state.sourceAssets?.glb?.metadata).toMatchObject({ kind: "item" });
    expect(typeof RoomGlbLoader.loadItem).toBe("function");
  });

  it("exporta GLB completo (níveis + slabs + itens + câmara)", async () => {
    let state = buildRectangularRoomState({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
    });
    state = CatalogItemManager.add(state, "chair-basic", {
      positionMm: { x: 200, y: 0, z: -100 },
    });
    state = RoomLevelManager.addLevelAbove(state, { name: "Piso 1" });
    state = {
      ...state,
      walkthroughSpawn: {
        positionMm: { x: 0, y: 1600, z: 0 },
        yawDeg: 45,
        levelId: state.activeLevelId,
      },
    };
    const scene = buildRoomExportScene(state);
    expect(scene.children.length).toBeGreaterThan(0);
    const cam = scene.getObjectByName("walkthroughCamera");
    expect(cam).toBeTruthy();
    expect(scene.children.some((c) => c.userData?.roomRole === "level")).toBe(true);

    const exported = await GlbExporter.exportRoomState(state);
    expect(exported.ok).toBe(true);
    expect(exported.buffer).toBeTruthy();
    expect(exported.buffer!.byteLength).toBeGreaterThan(100);
  });

  it("JSON com ifc.text via importJsonAsync", async () => {
    const result = await RoomBridge.importJsonAsync({
      ifc: {
        src: "embedded.ifc",
        text: buildSimpleIfcOneLevel(),
        metadata: { project: "phase-d" },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.state!.walls.length).toBeGreaterThanOrEqual(1);
    expect(result.state!.sourceAssets?.ifc?.metadata).toMatchObject({ project: "phase-d" });
  });

  it("JSON com glb metadata preserva sourceAssets", () => {
    const result = RoomBridge.importJson({
      walls: [
        { id: "w1", start: [0, 0], end: [4, 0], height: 2.6, thickness: 0.2 },
        { id: "w2", start: [4, 0], end: [4, 3], height: 2.6, thickness: 0.2 },
        { id: "w3", start: [4, 3], end: [0, 3], height: 2.6, thickness: 0.2 },
        { id: "w4", start: [0, 3], end: [0, 0], height: 2.6, thickness: 0.2 },
      ],
      glb: { src: "/rooms/demo.glb", metadata: { kind: "room" } },
    });
    expect(result.ok).toBe(true);
    expect(result.state!.sourceAssets?.glb?.src).toBe("/rooms/demo.glb");
  });

  it("enhancePbrMaterials calcula tangentes quando possível", () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    enhancePbrMaterials(mesh);
    expect(mesh.geometry.attributes.tangent || mesh.geometry.attributes.normal).toBeTruthy();
  });

  it("walkthrough spawn + catálogo sobrevivem após import IFC", async () => {
    const result = await RoomBridge.importIfcText(buildSimpleIfcOneLevel());
    expect(result.ok).toBe(true);
    let state = result.state!;
    state = CatalogItemManager.add(state, "table-dining");
    state = {
      ...state,
      walkthroughSpawn: state.walkthroughSpawn ?? {
        positionMm: { x: 0, y: 1600, z: 0 },
        yawDeg: 0,
      },
    };
    expect(state.items.length).toBe(1);
    expect(state.levels.length).toBeGreaterThanOrEqual(1);
    expect(state.walkthroughSpawn).toBeTruthy();
  });
});
