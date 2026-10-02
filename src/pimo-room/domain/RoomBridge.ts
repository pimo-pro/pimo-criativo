/**
 * Bridge floorplan JSON / RoomState / ProjectRoomConfig.
 * Unidades do grafo de nós legado: metros → mm no RoomState.
 */
import type { ProjectRoomConfig } from "../../3d/viewer-engine/room/roomEngineTypes";
import { CeilingEngine } from "./CeilingEngine";
import { FloorEngine } from "./FloorEngine";
import { RoomConverter } from "./RoomConverter";
import { computeFootprintFromWalls } from "./RoomGeometry";
import { SlabEngine } from "./SlabEngine";
import {
  createEmptyRoomState,
  newId,
  ROOM_ENGINE_DEFAULTS,
  type RoomItem,
  type RoomOpening,
  type RoomState,
  type RoomWall,
  type Vec2Mm,
  wallLengthMm,
} from "./RoomState";
import { RoomValidator } from "./RoomValidator";
import { DEFAULT_ITEM_SCALE } from "./catalog/CatalogItemState";
import type { CatalogItemType } from "./catalog/CatalogItem";
import { getCatalogPreset } from "./catalog/CatalogPresets";
import { toCatalogItemState } from "./catalog/CatalogItemManager";
import { IfcLoader } from "./ifc/IfcLoader";
import { GlbExporter } from "./glb/GlbExporter";
import { RoomGlbLoader, type GlbImportKind } from "./glb/GlbLoader";
import { AiEngine } from "./ai/AiEngine";
import { isAiPresetId, type AiPresetId } from "./ai/AiPresets";
import { AiAutoDesign } from "./ai/AiAutoDesign";

export type RoomBridgeImportResult = {
  ok: boolean;
  state: RoomState | null;
  projectRoom: ProjectRoomConfig | null;
  errors: string[];
  warnings: string[];
};

type LooseNode = Record<string, unknown>;

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function tuple2(v: unknown): [number, number] | null {
  if (Array.isArray(v) && v.length >= 2) {
    return [asNumber(v[0]), asNumber(v[1])];
  }
  if (v && typeof v === "object") {
    const o = v as { x?: number; z?: number; y?: number };
    if (typeof o.x === "number" && typeof o.z === "number") return [o.x, o.z];
    if (typeof o.x === "number" && typeof o.y === "number") return [o.x, o.y];
  }
  return null;
}

function mToMm(m: number): number {
  return Math.round(m * 1000);
}

function isRoomState(raw: unknown): raw is RoomState {
  return (
    !!raw &&
    typeof raw === "object" &&
    ((raw as RoomState).version === 1 ||
      (raw as RoomState).version === 2 ||
      (raw as RoomState).version === 3 ||
      (raw as RoomState).version === 4 ||
      (raw as RoomState).version === 5) &&
    Array.isArray((raw as RoomState).walls) &&
    Array.isArray((raw as RoomState).levels)
  );
}

function isProjectRoomConfig(raw: unknown): raw is ProjectRoomConfig {
  return (
    !!raw &&
    typeof raw === "object" &&
    typeof (raw as ProjectRoomConfig).widthMm === "number" &&
    Array.isArray((raw as ProjectRoomConfig).walls) &&
    Array.isArray((raw as ProjectRoomConfig).openings)
  );
}

/** Extrai mapa de nós de vários envelopes floorplan / snapshots. */
function extractNodes(raw: unknown): Record<string, LooseNode> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.nodes && typeof obj.nodes === "object" && !Array.isArray(obj.nodes)) {
    return obj.nodes as Record<string, LooseNode>;
  }
  if (obj.scene && typeof obj.scene === "object") {
    const scene = obj.scene as Record<string, unknown>;
    if (scene.nodes && typeof scene.nodes === "object") {
      return scene.nodes as Record<string, LooseNode>;
    }
  }
  // Objecto plano id→node com type
  const values = Object.values(obj);
  if (
    values.length > 0 &&
    values.every((v) => v && typeof v === "object" && "type" in (v as object))
  ) {
    return obj as Record<string, LooseNode>;
  }
  return null;
}

function centerOffset(wallsM: Array<{ start: [number, number]; end: [number, number] }>): {
  cx: number;
  cz: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const w of wallsM) {
    minX = Math.min(minX, w.start[0], w.end[0]);
    maxX = Math.max(maxX, w.start[0], w.end[0]);
    minZ = Math.min(minZ, w.start[1], w.end[1]);
    maxZ = Math.max(maxZ, w.start[1], w.end[1]);
  }
  if (!Number.isFinite(minX)) return { cx: 0, cz: 0 };
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

function classifyLabel(start: Vec2Mm, end: Vec2Mm): RoomWall["label"] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
  if (Math.abs(dx) >= Math.abs(dz)) {
    // horizontal (along X) → sul/norte
    return mid.z < 0 ? "sul" : "norte";
  }
  return mid.x > 0 ? "este" : "oeste";
}

function fromFloorplanNodes(nodes: Record<string, LooseNode>): RoomState {
  // Níveis (type: level)
  const levelNodes = Object.entries(nodes).filter(([, n]) => n.type === "level");
  const levelsMeta: Array<{ id: string; ordinal: number; height: number; name: string }> = [];
  if (levelNodes.length > 0) {
    levelNodes.forEach(([id, n], i) => {
      levelsMeta.push({
        id,
        ordinal: asNumber(n.level, i),
        height: asNumber(n.height, 2.6),
        name: typeof n.name === "string" ? n.name : `Piso ${i}`,
      });
    });
    levelsMeta.sort((a, b) => a.ordinal - b.ordinal);
  } else {
    levelsMeta.push({
      id: ROOM_ENGINE_DEFAULTS.levelId,
      ordinal: 0,
      height: 2.6,
      name: "Piso 0",
    });
  }

  const defaultLevelId = levelsMeta[0]!.id;

  // parentId de wall → level
  const wallLevelId = (node: LooseNode): string => {
    const parentId = typeof node.parentId === "string" ? node.parentId : null;
    if (parentId && levelsMeta.some((l) => l.id === parentId)) return parentId;
    if (typeof node.levelId === "string") return node.levelId;
    return defaultLevelId;
  };

  type WallEntry = {
    id: string;
    levelId: string;
    start: [number, number];
    end: [number, number];
    height: number;
    thickness: number;
  };
  const wallEntries: WallEntry[] = [];

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "wall") continue;
    const start = tuple2(node.start);
    const end = tuple2(node.end);
    if (!start || !end) continue;
    wallEntries.push({
      id,
      levelId: wallLevelId(node),
      start,
      end,
      height: asNumber(node.height, 2.6),
      thickness: asNumber(node.thickness, 0.2),
    });
  }

  const { cx, cz } = centerOffset(wallEntries);
  const walls: RoomWall[] = wallEntries.map((w) => {
    const startMm: Vec2Mm = { x: mToMm(w.start[0] - cx), z: mToMm(w.start[1] - cz) };
    const endMm: Vec2Mm = { x: mToMm(w.end[0] - cx), z: mToMm(w.end[1] - cz) };
    return {
      id: w.id || newId("wall"),
      levelId: w.levelId,
      startMm,
      endMm,
      heightMm: mToMm(w.height),
      thicknessMm: mToMm(w.thickness),
      label: classifyLabel(startMm, endMm),
      materialSlots: {
        interior: { kind: "preset", presetId: "white" },
        exterior: { kind: "preset", presetId: "plaster" },
      },
    };
  });

  const wallById = new Map(walls.map((w) => [w.id, w]));
  const openings: RoomOpening[] = [];

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "door" && node.type !== "window") continue;
    const wallId = typeof node.wallId === "string" ? node.wallId : null;
    const wall = wallId ? wallById.get(wallId) : null;
    if (!wall) continue;

    const widthM = asNumber(node.width, node.type === "door" ? 0.9 : 1.2);
    const heightM = asNumber(node.height, node.type === "door" ? 2.1 : 1.2);
    let alongMm = wallLengthMm(wall) / 2 - mToMm(widthM) / 2;
    const pos = node.position;
    if (Array.isArray(pos) && typeof pos[0] === "number") {
      alongMm = wallLengthMm(wall) / 2 + mToMm(pos[0]) - mToMm(widthM) / 2;
    }

    const doorType = typeof node.doorType === "string" ? node.doorType : "";
    const kind =
      doorType.includes("sliding") || doorType.includes("pocket") || doorType.includes("barn")
        ? "correr"
        : "normal";

    openings.push({
      id: id || newId("opening"),
      type: node.type === "window" ? "window" : "door",
      wallId: wall.id,
      kind,
      offsetAlongWallMm: Math.max(0, alongMm),
      widthMm: mToMm(widthM),
      heightMm: mToMm(heightM),
      sillMm: node.type === "window" ? mToMm(asNumber((node as { sill?: number }).sill, 0.9)) : 0,
      thicknessMm: 40,
    });
  }

  // Slabs
  type SlabDraft = {
    id: string;
    levelId: string;
    thickness: number;
    elevation: number;
    polygon?: Vec2Mm[];
  };
  const slabDrafts: SlabDraft[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "slab") continue;
    const parentId = typeof node.parentId === "string" ? node.parentId : defaultLevelId;
    const levelId = levelsMeta.some((l) => l.id === parentId) ? parentId : defaultLevelId;
    let polygon: Vec2Mm[] | undefined;
    if (Array.isArray(node.polygon)) {
      polygon = (node.polygon as unknown[])
        .map((p) => tuple2(p))
        .filter((t): t is [number, number] => t != null)
        .map(([x, z]) => ({ x: mToMm(x - cx), z: mToMm(z - cz) }));
    }
    slabDrafts.push({
      id,
      levelId,
      thickness: asNumber(node.thickness, 0.2),
      elevation: asNumber(node.elevation, 0),
      polygon,
    });
  }

  const level0Walls = walls.filter((w) => w.levelId === defaultLevelId);
  const fp = computeFootprintFromWalls(level0Walls.length ? level0Walls : walls);
  const heightMm = mToMm(levelsMeta[0]?.height ?? 2.6);
  const thicknessMm = walls[0]?.thicknessMm ?? ROOM_ENGINE_DEFAULTS.wallThicknessMm;

  let state = createEmptyRoomState({
    version: 2,
    walls,
    openings,
    footprint: {
      widthMm: fp.widthMm || ROOM_ENGINE_DEFAULTS.widthMm,
      depthMm: fp.depthMm || ROOM_ENGINE_DEFAULTS.depthMm,
      heightMm,
      wallThicknessMm: thicknessMm,
    },
    levels: levelsMeta.map((l) => ({
      id: l.id,
      ordinal: l.ordinal,
      name: l.name,
      storeyHeightMm: mToMm(l.height),
    })),
    activeLevelId: defaultLevelId,
  });

  for (const level of state.levels) {
    state = FloorEngine.ensureSlabFromWalls(state, level.id);
    state = CeilingEngine.ensureCeilingFromWalls(state, level.id);
    const draft = slabDrafts.find((s) => s.levelId === level.id);
    state = SlabEngine.ensureAdvancedSlab(state, level.id, {
      thicknessMm: draft ? mToMm(draft.thickness) : 200,
      elevationMm: draft ? mToMm(draft.elevation) : 0,
      polygonMm: draft?.polygon,
      material: { kind: "preset", presetId: "concrete" },
    });
  }

  state = applyItemsFromNodes(state, nodes, defaultLevelId, cx, cz);
  return state;
}

const ITEM_NODE_TYPES = new Set([
  "item",
  "furniture",
  "asset",
  "catalog",
  "chair",
  "table",
  "sofa",
  "lamp",
]);

function parseCatalogType(v: unknown): CatalogItemType {
  if (v === "chair" || v === "table" || v === "sofa" || v === "lamp" || v === "custom") return v;
  return "custom";
}

function positionMmFromLoose(
  node: LooseNode,
  cx: number,
  cz: number
): { x: number; y: number; z: number } {
  const pos = node.position ?? node.positionMm;
  if (Array.isArray(pos) && pos.length >= 2) {
    const x = asNumber(pos[0]);
    const y = asNumber(pos[1], 0);
    const z = asNumber(pos[2] ?? pos[1], 0);
    // 2-tuple [x,z] em metros vs 3-tuple
    if (pos.length === 2) {
      return { x: mToMm(x - cx), y: 0, z: mToMm(y - cz) };
    }
    if (Math.abs(x) < 50 && Math.abs(z) < 50) {
      return { x: mToMm(x - cx), y: mToMm(y), z: mToMm(z - cz) };
    }
    return { x, y, z };
  }
  if (pos && typeof pos === "object") {
    const p = pos as { x?: number; y?: number; z?: number };
    const x = asNumber(p.x);
    const y = asNumber(p.y, 0);
    const z = asNumber(p.z);
    if (Math.abs(x) < 50 && Math.abs(z) < 50) {
      return { x: mToMm(x - cx), y: mToMm(y), z: mToMm(z - cz) };
    }
    return { x, y, z };
  }
  return { x: 0, y: 0, z: 0 };
}

function itemFromLoose(
  id: string,
  node: LooseNode,
  defaultLevelId: string,
  cx: number,
  cz: number
): RoomItem {
  const catalogId =
    (typeof node.catalogId === "string" && node.catalogId) ||
    (typeof node.presetId === "string" && node.presetId) ||
    (typeof node.type === "string" && getCatalogPreset(`${node.type}-basic`)
      ? `${node.type}-basic`
      : null) ||
    (typeof node.type === "string" && node.type !== "item" && node.type !== "furniture"
      ? String(node.type)
      : "custom-box");
  const preset = getCatalogPreset(catalogId);
  const type = parseCatalogType(node.itemType ?? node.furnitureType ?? preset?.type ?? node.type);
  const levelId =
    (typeof node.levelId === "string" && node.levelId) ||
    (typeof node.parentId === "string" && node.parentId) ||
    defaultLevelId;
  const scaleRaw = node.scale;
  let scale = { ...DEFAULT_ITEM_SCALE };
  if (scaleRaw && typeof scaleRaw === "object") {
    const s = scaleRaw as { x?: number; y?: number; z?: number };
    scale = {
      x: Math.max(0.1, asNumber(s.x, 1)),
      y: Math.max(0.1, asNumber(s.y, 1)),
      z: Math.max(0.1, asNumber(s.z, 1)),
    };
  } else if (typeof scaleRaw === "number") {
    scale = { x: scaleRaw, y: scaleRaw, z: scaleRaw };
  }
  return {
    id: id || newId("item"),
    catalogId: preset?.id ?? catalogId,
    levelId,
    positionMm: positionMmFromLoose(node, cx, cz),
    rotationDeg: asNumber(node.rotationDeg ?? node.rotationY ?? node.yaw, 0),
    type,
    name: typeof node.name === "string" ? node.name : preset?.name ?? catalogId,
    scale,
    src: typeof node.src === "string" ? node.src : preset?.src,
    wallId: typeof node.wallId === "string" ? node.wallId : undefined,
  };
}

function applyItemsFromNodes(
  state: RoomState,
  nodes: Record<string, LooseNode>,
  defaultLevelId: string,
  cx: number,
  cz: number
): RoomState {
  const items: RoomItem[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const t = typeof node.type === "string" ? node.type : "";
    if (!ITEM_NODE_TYPES.has(t) && t !== "prop") continue;
    items.push(itemFromLoose(id, node, defaultLevelId, cx, cz));
  }
  if (items.length === 0) return state;
  return { ...state, version: 3, items: [...state.items, ...items] };
}

function applyItemsArray(
  state: RoomState,
  rawItems: unknown,
  cx = 0,
  cz = 0
): RoomState {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return state;
  const items: RoomItem[] = rawItems.map((entry, i) => {
    const node = (entry && typeof entry === "object" ? entry : {}) as LooseNode;
    const id = typeof node.id === "string" ? node.id : `item-${i}`;
    return itemFromLoose(id, { ...node, type: (node.type as string) || "item" }, state.activeLevelId, cx, cz);
  });
  return { ...state, version: 3, items: [...state.items, ...items] };
}

/** Formato simplificado + multi-level: { levels?: [...], walls, doors?, windows?, slabs?, camera? } */
function fromSimplifiedFloorplan(raw: Record<string, unknown>): RoomState | null {
  if (Array.isArray(raw.levels) && raw.levels.length > 0) {
    const nodes: Record<string, LooseNode> = {};
    (raw.levels as LooseNode[]).forEach((l, i) => {
      const id = typeof l.id === "string" ? l.id : `level-${i}`;
      nodes[id] = {
        type: "level",
        id,
        level: asNumber(l.ordinal ?? l.level, i),
        height: asNumber(l.height, 2.6),
        name: typeof l.name === "string" ? l.name : `Piso ${i}`,
      };
    });
    if (Array.isArray(raw.walls)) {
      (raw.walls as LooseNode[]).forEach((w, i) => {
        const id = typeof w.id === "string" ? w.id : `wall-${i}`;
        nodes[id] = { ...w, type: "wall", id };
      });
    }
    if (Array.isArray(raw.doors)) {
      (raw.doors as LooseNode[]).forEach((d, i) => {
        const id = typeof d.id === "string" ? d.id : `door-${i}`;
        nodes[id] = { ...d, type: "door", id };
      });
    }
    if (Array.isArray(raw.windows)) {
      (raw.windows as LooseNode[]).forEach((w, i) => {
        const id = typeof w.id === "string" ? w.id : `window-${i}`;
        nodes[id] = { ...w, type: "window", id };
      });
    }
    if (Array.isArray(raw.slabs)) {
      (raw.slabs as LooseNode[]).forEach((s, i) => {
        const id = typeof s.id === "string" ? s.id : `slab-${i}`;
        nodes[id] = { ...s, type: "slab", id };
      });
    }
    if (Object.keys(nodes).length === 0) return null;
    let state = fromFloorplanNodes(nodes);
    state = applyCameraSpawn(state, raw.camera ?? raw.walkthroughSpawn);
    state = applyItemsArray(state, raw.items ?? raw.catalogItems ?? raw.furniture);
    state = applyAiPresetFromRaw(state, raw);
    return state;
  }

  if (!Array.isArray(raw.walls) || raw.walls.length === 0) return null;
  const nodes: Record<string, LooseNode> = {};
  (raw.walls as LooseNode[]).forEach((w, i) => {
    const id = typeof w.id === "string" ? w.id : `wall-${i}`;
    nodes[id] = { ...w, type: "wall", id };
  });
  const doors = Array.isArray(raw.doors) ? (raw.doors as LooseNode[]) : [];
  const windows = Array.isArray(raw.windows) ? (raw.windows as LooseNode[]) : [];
  doors.forEach((d, i) => {
    const id = typeof d.id === "string" ? d.id : `door-${i}`;
    nodes[id] = { ...d, type: "door", id };
  });
  windows.forEach((w, i) => {
    const id = typeof w.id === "string" ? w.id : `window-${i}`;
    nodes[id] = { ...w, type: "window", id };
  });
  if (Array.isArray(raw.slabs)) {
    (raw.slabs as LooseNode[]).forEach((s, i) => {
      const id = typeof s.id === "string" ? s.id : `slab-${i}`;
      nodes[id] = { ...s, type: "slab", id };
    });
  }
  let state = fromFloorplanNodes(nodes);
  state = applyCameraSpawn(state, raw.camera ?? raw.walkthroughSpawn);
  state = applyItemsArray(state, raw.items ?? raw.catalogItems ?? raw.furniture);
  state = applyAiPresetFromRaw(state, raw);
  return state;
}

function applyAiPresetFromRaw(state: RoomState, raw: Record<string, unknown>): RoomState {
  const presetRaw = raw.aiPreset ?? raw.aiStyle;
  let presetId: AiPresetId | null = null;
  if (typeof presetRaw === "string" && isAiPresetId(presetRaw)) {
    presetId = presetRaw;
  } else if (presetRaw && typeof presetRaw === "object") {
    const id = (presetRaw as { id?: string }).id;
    if (typeof id === "string" && isAiPresetId(id)) presetId = id;
  }
  if (!presetId) return state;
  const applyNow = raw.applyAi === true || (presetRaw && typeof presetRaw === "object" && (presetRaw as { apply?: boolean }).apply === true);
  if (applyNow) {
    const designed = AiAutoDesign.design(state, { presetId, replaceItems: state.items.length === 0 });
    return designed.state;
  }
  return { ...state, version: 5, aiPreset: presetId };
}

function applyCameraSpawn(state: RoomState, camera: unknown): RoomState {
  if (!camera || typeof camera !== "object") return state;
  const c = camera as Record<string, unknown>;
  const pos = c.position ?? c.positionMm;
  let positionMm = { x: 0, y: 1600, z: 0 };
  if (Array.isArray(pos) && pos.length >= 3) {
    // metros se valores pequenos
    const x = asNumber(pos[0]);
    const y = asNumber(pos[1]);
    const z = asNumber(pos[2]);
    if (Math.abs(x) < 50 && Math.abs(z) < 50) {
      positionMm = { x: mToMm(x), y: mToMm(y || 1.6), z: mToMm(z) };
    } else {
      positionMm = { x, y: y || 1600, z };
    }
  } else if (pos && typeof pos === "object") {
    const p = pos as { x?: number; y?: number; z?: number };
    positionMm = {
      x: asNumber(p.x),
      y: asNumber(p.y, 1600),
      z: asNumber(p.z),
    };
  }
  return {
    ...state,
    walkthroughSpawn: {
      positionMm,
      yawDeg: asNumber(c.yawDeg ?? c.yaw ?? c.rotationY, 0),
      levelId: typeof c.levelId === "string" ? c.levelId : state.activeLevelId,
    },
  };
}

export const RoomBridge = {
  /** Converte JSON (RoomState / ProjectRoomConfig / floorplan nodes) → RoomState. */
  jsonToRoomState(raw: unknown): RoomState {
    const finish = (state: RoomState): RoomState =>
      FloorEngine.syncAllLevels({
        ...state,
        items: Array.isArray(state.items) ? state.items : [],
      });

    if (isRoomState(raw)) {
      return finish(raw as RoomState);
    }
    if (isProjectRoomConfig(raw)) {
      return finish(RoomConverter.fromProjectRoomConfig(raw));
    }

    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (obj.room && isProjectRoomConfig(obj.room)) {
        return finish(RoomConverter.fromProjectRoomConfig(obj.room));
      }
      if (obj.roomState && isRoomState(obj.roomState)) {
        return finish(obj.roomState as RoomState);
      }
      // Fase D — envelope com ifc/glb metadata (texto IFC embutido)
      if (obj.ifc && typeof obj.ifc === "object") {
        const ifc = obj.ifc as { src?: string; text?: string; metadata?: Record<string, unknown> };
        if (typeof ifc.text === "string" && ifc.text.length > 0) {
          throw new Error("IFC_TEXT_EMBEDDED"); // handled async via importIfcText
        }
        // JSON só com referência: devolve sala vazia anotada (src para fetch posterior)
        if (typeof ifc.src === "string") {
          const base = createEmptyRoomState({
            version: 4,
            sourceAssets: { ifc: { src: ifc.src, metadata: ifc.metadata } },
          });
          const simplified = fromSimplifiedFloorplan(obj);
          if (simplified) {
            return finish({
              ...simplified,
              version: 4,
              sourceAssets: {
                ...simplified.sourceAssets,
                ifc: { src: ifc.src, metadata: ifc.metadata },
              },
            });
          }
          return finish(base);
        }
      }
      if (obj.glb && typeof obj.glb === "object") {
        const glb = obj.glb as { src?: string; metadata?: Record<string, unknown> };
        const simplified = fromSimplifiedFloorplan(obj);
        if (simplified) {
          return finish({
            ...simplified,
            version: 4,
            sourceAssets: {
              ...simplified.sourceAssets,
              glb: { src: glb.src, metadata: glb.metadata },
            },
          });
        }
      }
      const simplified = fromSimplifiedFloorplan(obj);
      if (simplified) return finish(simplified);
    }

    const nodes = extractNodes(raw);
    if (nodes) return finish(fromFloorplanNodes(nodes));

    throw new Error("JSON não reconhecido como floorplan / RoomState / ProjectRoomConfig");
  },

  roomStateToProjectRoom(state: RoomState): ProjectRoomConfig {
    return RoomConverter.toProjectRoomConfig(state);
  },

  /** Metadados de itens para ProjectRoomConfig (sem geometria industrial). */
  catalogItemsToProjectMeta(state: RoomState): NonNullable<ProjectRoomConfig["catalogItems"]> {
    return state.items.map((item) => {
      const c = toCatalogItemState(item);
      return {
        id: c.id,
        catalogId: c.catalogId,
        levelId: c.levelId,
        type: c.type,
        name: c.name,
        positionMm: { ...c.positionMm },
        rotationDeg: c.rotationDeg,
        scale: { ...c.scale },
        src: c.src,
      };
    });
  },

  projectRoomToRoomState(room: ProjectRoomConfig): RoomState {
    return RoomConverter.fromProjectRoomConfig(room);
  },

  /** IFC texto/ficheiro → RoomState. */
  async importIfcText(text: string, src?: string): Promise<RoomBridgeImportResult> {
    const loaded = await IfcLoader.fromText(text, src);
    const errors = [...loaded.errors];
    const warnings = [...loaded.warnings];
    if (!loaded.ok || !loaded.state) {
      return { ok: false, state: null, projectRoom: null, errors, warnings };
    }
    for (const issue of RoomValidator.validate(loaded.state)) {
      if (issue.severity === "error") errors.push(issue.message);
      else warnings.push(issue.message);
    }
    return {
      ok: errors.length === 0,
      state: loaded.state,
      projectRoom: RoomBridge.roomStateToProjectRoom(loaded.state),
      errors,
      warnings,
    };
  },

  async importIfcFile(file: File): Promise<RoomBridgeImportResult> {
    const text = await file.text();
    return RoomBridge.importIfcText(text, file.name);
  },

  /** GLB → RoomState (sala ou item). */
  async importGlbFile(
    file: File,
    kind: GlbImportKind = "room",
    baseState?: RoomState | null
  ): Promise<RoomBridgeImportResult> {
    const loaded = await RoomGlbLoader.fromFile(file, kind, baseState ?? undefined);
    const errors = [...loaded.errors];
    const warnings = [...loaded.warnings];
    if (!loaded.ok || !loaded.state) {
      return { ok: false, state: null, projectRoom: null, errors, warnings };
    }
    if (loaded.root) RoomGlbLoader.attachToViewer(loaded.root);
    for (const issue of RoomValidator.validate(loaded.state)) {
      if (issue.severity === "error") errors.push(issue.message);
      else warnings.push(issue.message);
    }
    return {
      ok: errors.length === 0,
      state: loaded.state,
      projectRoom: RoomBridge.roomStateToProjectRoom(loaded.state),
      errors,
      warnings,
    };
  },

  async importGlbBuffer(
    buffer: ArrayBuffer,
    kind: GlbImportKind = "room",
    srcLabel?: string,
    baseState?: RoomState | null
  ): Promise<RoomBridgeImportResult> {
    const loaded =
      kind === "item"
        ? await RoomGlbLoader.loadItem(buffer, baseState ?? createEmptyRoomState(), {
            srcLabel,
          })
        : await RoomGlbLoader.loadRoom(buffer, srcLabel);
    const errors = [...loaded.errors];
    const warnings = [...loaded.warnings];
    if (!loaded.ok || !loaded.state) {
      return { ok: false, state: null, projectRoom: null, errors, warnings };
    }
    return {
      ok: true,
      state: loaded.state,
      projectRoom: RoomBridge.roomStateToProjectRoom(loaded.state),
      errors,
      warnings,
    };
  },

  async exportGlb(state: RoomState): Promise<{
    ok: boolean;
    buffer: ArrayBuffer | null;
    errors: string[];
    warnings: string[];
  }> {
    return GlbExporter.exportRoomState(state);
  },

  async exportGlbDownload(state: RoomState, fileName?: string) {
    return GlbExporter.exportAndDownload(state, fileName);
  },

  /** Aplica preset AI e devolve estado. */
  applyAiPreset(
    state: RoomState,
    presetId: AiPresetId,
    opts?: { replaceItems?: boolean; levelId?: string }
  ): RoomBridgeImportResult {
    const designed = AiEngine.designNow(state, {
      presetId,
      replaceItems: opts?.replaceItems,
      levelId: opts?.levelId,
    });
    return {
      ok: true,
      state: designed.state,
      projectRoom: RoomBridge.roomStateToProjectRoom(designed.state),
      errors: [],
      warnings: designed.warnings,
    };
  },

  /** Exporta GLB do layout AI (estado actual ou após design). */
  async exportAiLayoutGlb(
    state: RoomState,
    opts?: { presetId?: AiPresetId; applyDesign?: boolean }
  ): Promise<{
    ok: boolean;
    buffer: ArrayBuffer | null;
    state: RoomState;
    errors: string[];
    warnings: string[];
  }> {
    let next = state;
    const warnings: string[] = [];
    if (opts?.applyDesign && opts.presetId) {
      const d = AiEngine.designNow(state, { presetId: opts.presetId });
      next = d.state;
      warnings.push(...d.warnings);
    }
    const exported = await GlbExporter.exportRoomState(next);
    return {
      ok: exported.ok,
      buffer: exported.buffer,
      state: next,
      errors: exported.errors,
      warnings: [...warnings, ...exported.warnings],
    };
  },

  /** Pipeline completo: JSON → RoomState → ProjectRoomConfig + validação. */
  importJson(raw: unknown): RoomBridgeImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      // IFC embutido no JSON
      if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        const ifc = obj.ifc;
        if (ifc && typeof ifc === "object" && typeof (ifc as { text?: string }).text === "string") {
          // sync path não pode await — marcar para o caller usar importIfcText
          errors.push("Use RoomBridge.importIfcText para JSON com ifc.text embutido");
          return { ok: false, state: null, projectRoom: null, errors, warnings };
        }
      }
      const state = RoomBridge.jsonToRoomState(raw);
      for (const issue of RoomValidator.validate(state)) {
        if (issue.severity === "error") errors.push(issue.message);
        else warnings.push(issue.message);
      }
      if (state.walls.length === 0 && !state.sourceAssets?.ifc?.src && !state.sourceAssets?.glb?.src) {
        errors.push("Nenhuma parede encontrada no JSON");
        return { ok: false, state: null, projectRoom: null, errors, warnings };
      }
      if (state.walls.length === 0) {
        warnings.push("JSON referencia IFC/GLB externo sem paredes locais");
        return {
          ok: true,
          state,
          projectRoom: RoomBridge.roomStateToProjectRoom(
            createEmptyRoomState({
              ...state,
              walls: [],
            })
          ),
          errors,
          warnings,
        };
      }
      const projectRoom = RoomBridge.roomStateToProjectRoom(state);
      return {
        ok: errors.length === 0,
        state,
        projectRoom,
        errors,
        warnings,
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return { ok: false, state: null, projectRoom: null, errors, warnings };
    }
  },

  async importJsonAsync(raw: unknown): Promise<RoomBridgeImportResult> {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const ifc = obj.ifc as { text?: string; src?: string; metadata?: Record<string, unknown> } | undefined;
      if (ifc && typeof ifc.text === "string") {
        const result = await RoomBridge.importIfcText(ifc.text, ifc.src);
        if (result.state && ifc.metadata) {
          result.state = {
            ...result.state,
            sourceAssets: {
              ...result.state.sourceAssets,
              ifc: {
                ...result.state.sourceAssets?.ifc,
                metadata: { ...result.state.sourceAssets?.ifc?.metadata, ...ifc.metadata },
              },
            },
          };
        }
        return result;
      }
    }
    return RoomBridge.importJson(raw);
  },

  async importFile(file: File): Promise<RoomBridgeImportResult> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".ifc")) return RoomBridge.importIfcFile(file);
    if (name.endsWith(".glb") || name.endsWith(".gltf")) {
      return RoomBridge.importGlbFile(file, "room");
    }
    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return {
        ok: false,
        state: null,
        projectRoom: null,
        errors: ["Ficheiro JSON inválido"],
        warnings: [],
      };
    }
    return RoomBridge.importJsonAsync(raw);
  },
};
