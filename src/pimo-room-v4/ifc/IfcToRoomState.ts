/**
 * Converte modelo IFC extraído → RoomState (mm).
 */
import { CeilingEngine } from "../CeilingEngine";
import { FloorEngine } from "../FloorEngine";
import { computeFootprintFromWalls } from "../RoomGeometry";
import {
  createEmptyRoomState,
  newId,
  ROOM_ENGINE_DEFAULTS,
  type RoomOpening,
  type RoomState,
  type RoomWall,
  type Vec2Mm,
  wallLengthMm,
} from "../RoomState";
import { SlabEngine } from "../SlabEngine";
import type { IfcExtractedModel } from "./IfcTypes";

function mToMm(m: number): number {
  return Math.round(m * 1000);
}

function centerOffset(walls: Array<{ startM: { x: number; z: number }; endM: { x: number; z: number } }>): {
  cx: number;
  cz: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.startM.x, w.endM.x);
    maxX = Math.max(maxX, w.startM.x, w.endM.x);
    minZ = Math.min(minZ, w.startM.z, w.endM.z);
    maxZ = Math.max(maxZ, w.startM.z, w.endM.z);
  }
  if (!Number.isFinite(minX)) return { cx: 0, cz: 0 };
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

function classifyLabel(start: Vec2Mm, end: Vec2Mm): RoomWall["label"] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
  if (Math.abs(dx) >= Math.abs(dz)) return mid.z < 0 ? "sul" : "norte";
  return mid.x > 0 ? "este" : "oeste";
}

export function ifcModelToRoomState(model: IfcExtractedModel): RoomState {
  const { cx, cz } = centerOffset(model.walls);

  const storeyIdByEntity = new Map<number, string>();
  const levels = model.storeys.map((s, i) => {
    const id = s.id || `level-${i}`;
    storeyIdByEntity.set(s.entityId, id);
    const nextElev = model.storeys[i + 1]?.elevationM;
    const heightM =
      nextElev != null ? Math.max(2.2, nextElev - s.elevationM) : 2.6;
    return {
      id,
      ordinal: i,
      name: s.name,
      storeyHeightMm: mToMm(heightM),
    };
  });

  const defaultLevelId = levels[0]?.id ?? ROOM_ENGINE_DEFAULTS.levelId;

  const wallEntityToRoomId = new Map<string, string>();
  const walls: RoomWall[] = model.walls.map((w) => {
    const levelId =
      (w.storeyEntityId != null ? storeyIdByEntity.get(w.storeyEntityId) : null) ??
      defaultLevelId;
    const startMm: Vec2Mm = {
      x: mToMm(w.startM.x - cx),
      z: mToMm(w.startM.z - cz),
    };
    const endMm: Vec2Mm = {
      x: mToMm(w.endM.x - cx),
      z: mToMm(w.endM.z - cz),
    };
    const id = w.id || newId("wall");
    // entity id numérico embutido em wall-123
    const entMatch = id.match(/wall-(\d+)/);
    if (entMatch) wallEntityToRoomId.set(entMatch[1]!, id);
    return {
      id,
      levelId,
      startMm,
      endMm,
      heightMm: mToMm(w.heightM),
      thicknessMm: mToMm(w.thicknessM),
      label: classifyLabel(startMm, endMm),
      materialSlots: {
        interior: { kind: "preset", presetId: "white" },
        exterior: { kind: "preset", presetId: "plaster" },
      },
    };
  });

  const openings: RoomOpening[] = [];
  for (const o of model.openings) {
    let wallId: string | null = null;
    if (o.wallEntityId != null) {
      wallId = wallEntityToRoomId.get(String(o.wallEntityId)) ?? null;
      if (!wallId) {
        wallId = walls.find((w) => w.id === `wall-${o.wallEntityId}`)?.id ?? null;
      }
    }
    if (!wallId) wallId = walls[0]?.id ?? null;
    if (!wallId) continue;
    const wall = walls.find((w) => w.id === wallId)!;
    const widthMm = mToMm(o.widthM);
    const along = wallLengthMm(wall);
    openings.push({
      id: o.id || newId(o.type),
      type: o.type,
      wallId,
      kind: "normal",
      offsetAlongWallMm: Math.max(0, along / 2 - widthMm / 2),
      widthMm,
      heightMm: mToMm(o.heightM),
      sillMm: mToMm(o.sillM),
      thicknessMm: 40,
    });
  }

  const fp = computeFootprintFromWalls(walls);
  let state = createEmptyRoomState({
    version: 4,
    walls,
    openings,
    levels,
    activeLevelId: defaultLevelId,
    footprint: {
      widthMm: fp.widthMm || ROOM_ENGINE_DEFAULTS.widthMm,
      depthMm: fp.depthMm || ROOM_ENGINE_DEFAULTS.depthMm,
      heightMm: levels[0]?.storeyHeightMm ?? ROOM_ENGINE_DEFAULTS.heightMm,
      wallThicknessMm: walls[0]?.thicknessMm ?? ROOM_ENGINE_DEFAULTS.wallThicknessMm,
    },
    walkthroughSpawn: model.camera
      ? {
          positionMm: {
            x: mToMm(model.camera.positionM.x - cx),
            y: mToMm(model.camera.positionM.y),
            z: mToMm(model.camera.positionM.z - cz),
          },
          yawDeg: model.camera.yawDeg,
          levelId: defaultLevelId,
        }
      : undefined,
    sourceAssets: {
      ifc: {
        metadata: {
          schema: model.schema,
          storeys: model.storeys.length,
          walls: model.walls.length,
          openings: model.openings.length,
          slabs: model.slabs.length,
        },
      },
    },
  });

  for (const level of state.levels) {
    state = FloorEngine.ensureSlabFromWalls(state, level.id);
    state = CeilingEngine.ensureCeilingFromWalls(state, level.id);
  }

  for (const slab of model.slabs) {
    const levelId =
      (slab.storeyEntityId != null ? storeyIdByEntity.get(slab.storeyEntityId) : null) ??
      defaultLevelId;
    state = SlabEngine.ensureAdvancedSlab(state, levelId, {
      thicknessMm: mToMm(slab.thicknessM),
      elevationMm: mToMm(slab.elevationM),
      polygonMm: slab.polygonM?.map((p) => ({
        x: mToMm(p.x - cx),
        z: mToMm(p.z - cz),
      })),
      material: { kind: "preset", presetId: "concrete" },
    });
  }

  return state;
}

export const IfcToRoomState = { convert: ifcModelToRoomState };
