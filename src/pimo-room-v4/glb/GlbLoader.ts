/**
 * Importação GLB → RoomState (sala com nodes) ou item de catálogo.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CeilingEngine } from "../CeilingEngine";
import { FloorEngine } from "../FloorEngine";
import { CatalogItemManager } from "../catalog/CatalogItemManager";
import {
  createEmptyRoomState,
  newId,
  ROOM_ENGINE_DEFAULTS,
  type RoomState,
  type RoomWall,
  type Vec2Mm,
} from "../RoomState";
import { computeFootprintFromWalls } from "../RoomGeometry";
import { enhancePbrMaterials, ensureAssetLights } from "./glbMaterials";
import { getRoomEngineViewerHost } from "../roomEngineStore";

const loader = new GLTFLoader();

export type GlbImportKind = "room" | "item";

export type GlbLoadResult = {
  ok: boolean;
  kind: GlbImportKind;
  state: RoomState | null;
  root: THREE.Object3D | null;
  errors: string[];
  warnings: string[];
};

function classifyLabel(start: Vec2Mm, end: Vec2Mm): RoomWall["label"] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
  if (Math.abs(dx) >= Math.abs(dz)) return mid.z < 0 ? "sul" : "norte";
  return mid.x > 0 ? "este" : "oeste";
}

/** Extrai paredes a partir de nodes com nome wall* / userData.roomRole=wall. */
function wallsFromScene(root: THREE.Object3D, levelId: string): RoomWall[] {
  const walls: RoomWall[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const role = String(obj.userData?.roomRole ?? obj.userData?.type ?? "");
    const name = (obj.name || "").toLowerCase();
    const isWall =
      role === "wall" || name.startsWith("wall") || name.includes("parede");
    if (!isWall || !(obj instanceof THREE.Mesh || obj instanceof THREE.Group)) return;

    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Parede along X ou Z conforme dimensão dominante horizontal
    const alongX = size.x >= size.z;
    const length = alongX ? size.x : size.z;
    const thickness = alongX ? size.z : size.x;
    const half = length / 2;
    const startMm: Vec2Mm = alongX
      ? { x: Math.round((center.x - half) * 1000), z: Math.round(center.z * 1000) }
      : { x: Math.round(center.x * 1000), z: Math.round((center.z - half) * 1000) };
    const endMm: Vec2Mm = alongX
      ? { x: Math.round((center.x + half) * 1000), z: Math.round(center.z * 1000) }
      : { x: Math.round(center.x * 1000), z: Math.round((center.z + half) * 1000) };

    walls.push({
      id: obj.name || newId("wall"),
      levelId,
      startMm,
      endMm,
      heightMm: Math.max(500, Math.round(size.y * 1000)),
      thicknessMm: Math.max(50, Math.round(thickness * 1000)),
      label: classifyLabel(startMm, endMm),
      materialSlots: {
        interior: { kind: "preset", presetId: "white" },
        exterior: { kind: "preset", presetId: "plaster" },
      },
    });
  });
  return walls;
}

function levelsFromScene(root: THREE.Object3D): RoomState["levels"] {
  const found: RoomState["levels"] = [];
  root.traverse((obj) => {
    const role = String(obj.userData?.roomRole ?? "");
    const name = (obj.name || "").toLowerCase();
    if (role === "level" || name.startsWith("level") || name.startsWith("piso")) {
      const elev = typeof obj.userData?.elevationMm === "number" ? obj.userData.elevationMm : 0;
      found.push({
        id: obj.name || newId("level"),
        ordinal: found.length,
        name: obj.name || `Piso ${found.length}`,
        storeyHeightMm:
          typeof obj.userData?.storeyHeightMm === "number"
            ? obj.userData.storeyHeightMm
            : ROOM_ENGINE_DEFAULTS.heightMm,
      });
      void elev;
    }
  });
  if (found.length === 0) {
    return [
      {
        id: ROOM_ENGINE_DEFAULTS.levelId,
        ordinal: 0,
        name: "Piso 0",
        storeyHeightMm: ROOM_ENGINE_DEFAULTS.heightMm,
      },
    ];
  }
  return found;
}

function cameraFromScene(root: THREE.Object3D): RoomState["walkthroughSpawn"] | undefined {
  let spawn: RoomState["walkthroughSpawn"];
  root.traverse((obj) => {
    const role = String(obj.userData?.roomRole ?? "");
    const name = (obj.name || "").toLowerCase();
    if (role === "camera" || name.includes("camera") || name.includes("spawn")) {
      obj.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      spawn = {
        positionMm: {
          x: Math.round(p.x * 1000),
          y: Math.round(p.y * 1000) || 1600,
          z: Math.round(p.z * 1000),
        },
        yawDeg: THREE.MathUtils.radToDeg(obj.rotation.y),
      };
    }
  });
  return spawn;
}

function roomStateFromGltfRoot(root: THREE.Object3D, src?: string): RoomState {
  const levels = levelsFromScene(root);
  const levelId = levels[0]!.id;
  let walls = wallsFromScene(root, levelId);

  // Fallback: bounding box da cena → rectângulo de paredes
  if (walls.length === 0) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const w = Math.max(2, size.x) * 1000;
    const d = Math.max(2, size.z) * 1000;
    const h = Math.max(2.2, size.y) * 1000;
    const hw = w / 2;
    const hd = d / 2;
    const t = 200;
    walls = [
      {
        id: newId("wall"),
        levelId,
        startMm: { x: -hw, z: -hd },
        endMm: { x: hw, z: -hd },
        heightMm: h,
        thicknessMm: t,
        label: "sul",
      },
      {
        id: newId("wall"),
        levelId,
        startMm: { x: hw, z: -hd },
        endMm: { x: hw, z: hd },
        heightMm: h,
        thicknessMm: t,
        label: "este",
      },
      {
        id: newId("wall"),
        levelId,
        startMm: { x: hw, z: hd },
        endMm: { x: -hw, z: hd },
        heightMm: h,
        thicknessMm: t,
        label: "norte",
      },
      {
        id: newId("wall"),
        levelId,
        startMm: { x: -hw, z: hd },
        endMm: { x: -hw, z: -hd },
        heightMm: h,
        thicknessMm: t,
        label: "oeste",
      },
    ];
  }

  const fp = computeFootprintFromWalls(walls);
  let state = createEmptyRoomState({
    version: 4,
    walls,
    levels,
    activeLevelId: levelId,
    footprint: {
      widthMm: fp.widthMm || ROOM_ENGINE_DEFAULTS.widthMm,
      depthMm: fp.depthMm || ROOM_ENGINE_DEFAULTS.depthMm,
      heightMm: levels[0]?.storeyHeightMm ?? ROOM_ENGINE_DEFAULTS.heightMm,
      wallThicknessMm: walls[0]?.thicknessMm ?? ROOM_ENGINE_DEFAULTS.wallThicknessMm,
    },
    walkthroughSpawn: cameraFromScene(root),
    sourceAssets: {
      glb: {
        src,
        metadata: { kind: "room", nodes: root.children.length },
      },
    },
  });
  state = FloorEngine.ensureSlabFromWalls(state, levelId);
  state = CeilingEngine.ensureCeilingFromWalls(state, levelId);
  return state;
}

async function loadRoot(source: ArrayBuffer | string): Promise<THREE.Group> {
  if (typeof source === "string") {
    const gltf = await loader.loadAsync(source);
    return gltf.scene;
  }
  const gltf = await loader.parseAsync(source, "");
  return gltf.scene;
}

export const RoomGlbLoader = {
  async loadRoom(source: ArrayBuffer | string, srcLabel?: string): Promise<GlbLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const root = await loadRoot(source);
      enhancePbrMaterials(root);
      const state = roomStateFromGltfRoot(root, srcLabel);
      if (state.walls.length === 0) {
        errors.push("GLB sem geometria de sala reconhecível");
        return { ok: false, kind: "room", state: null, root, errors, warnings };
      }
      return { ok: true, kind: "room", state, root, errors, warnings };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return { ok: false, kind: "room", state: null, root: null, errors, warnings };
    }
  },

  async loadItem(
    source: ArrayBuffer | string,
    baseState: RoomState,
    opts?: { catalogId?: string; name?: string; srcLabel?: string }
  ): Promise<GlbLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const root = await loadRoot(source);
      enhancePbrMaterials(root);
      const catalogId = opts?.catalogId ?? "custom-box";
      let state = CatalogItemManager.add(baseState, catalogId, {
        positionMm: { x: 0, y: 0, z: 0 },
        levelId: baseState.activeLevelId,
      });
      const last = state.items[state.items.length - 1];
      if (last) {
        last.name = opts?.name ?? opts?.srcLabel ?? last.name ?? "Item GLB";
        last.type = "custom";
        last.src = opts?.srcLabel;
        last.scale = { x: 1, y: 1, z: 1 };
      }
      state = {
        ...state,
        version: 4,
        sourceAssets: {
          ...state.sourceAssets,
          glb: {
            src: opts?.srcLabel,
            metadata: { kind: "item", ...(state.sourceAssets?.glb?.metadata ?? {}) },
          },
        },
      };
      return { ok: true, kind: "item", state, root, errors, warnings };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return { ok: false, kind: "item", state: null, root: null, errors, warnings };
    }
  },

  async fromFile(file: File, kind: GlbImportKind, baseState?: RoomState): Promise<GlbLoadResult> {
    const buf = await file.arrayBuffer();
    if (kind === "item") {
      if (!baseState) {
        return {
          ok: false,
          kind: "item",
          state: null,
          root: null,
          errors: ["Estado de sala necessário para importar item GLB"],
          warnings: [],
        };
      }
      return RoomGlbLoader.loadItem(buf, baseState, { srcLabel: file.name, name: file.name });
    }
    return RoomGlbLoader.loadRoom(buf, file.name);
  },

  /** Coloca o root GLB na cena ViewerCore (materiais PBR). */
  attachToViewer(root: THREE.Object3D): void {
    const core = getRoomEngineViewerHost() as unknown as {
      sceneManager?: { scene: THREE.Scene };
    } | null;
    if (!core?.sceneManager?.scene) return;
    ensureAssetLights(core.sceneManager.scene);
    enhancePbrMaterials(root);
    let group = core.sceneManager.scene.getObjectByName("roomGlbImport") as THREE.Group | undefined;
    if (!group) {
      group = new THREE.Group();
      group.name = "roomGlbImport";
      core.sceneManager.scene.add(group);
    }
    while (group.children.length) {
      const ch = group.children[0]!;
      group.remove(ch);
    }
    group.add(root);
  },
};

/** Alias pedido na Fase D. */
export const GlbLoader = RoomGlbLoader;
