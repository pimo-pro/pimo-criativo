/**
 * Lajes avançadas (Fase B) — espessura, materiais, offsets, furos.
 */
import { footprintRectPolygon, computeFootprintFromWalls } from "./RoomGeometry";
import type { RoomMaterialRef, RoomSlab, RoomState, Vec2Mm } from "./RoomState";
import { newId } from "./RoomState";

export type AdvancedSlabInput = {
  thicknessMm?: number;
  elevationMm?: number;
  offsetMm?: Vec2Mm;
  material?: RoomMaterialRef;
  holesMm?: Vec2Mm[][];
  autoFromWalls?: boolean;
  polygonMm?: Vec2Mm[];
};

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

function applyOffset(poly: Vec2Mm[], offset?: Vec2Mm): Vec2Mm[] {
  if (!offset) return poly.map((p) => ({ ...p }));
  return poly.map((p) => ({ x: p.x + offset.x, z: p.z + offset.z }));
}

export const SlabEngine = {
  ensureAdvancedSlab(
    state: RoomState,
    levelId: string,
    input: AdvancedSlabInput = {}
  ): RoomState {
    const next = cloneState(state);
    const walls = next.walls.filter((w) => w.levelId === levelId);
    const fp = computeFootprintFromWalls(walls);
    const basePoly =
      input.polygonMm ??
      (fp.widthMm > 0
        ? footprintRectPolygon(fp)
        : footprintRectPolygon({
            minX: -(next.footprint?.widthMm ?? 4000) / 2,
            maxX: (next.footprint?.widthMm ?? 4000) / 2,
            minZ: -(next.footprint?.depthMm ?? 4000) / 2,
            maxZ: (next.footprint?.depthMm ?? 4000) / 2,
          }));
    const polygonMm = applyOffset(basePoly, input.offsetMm);
    const existing = next.slabs.find((s) => s.levelId === levelId);
    const patch: RoomSlab = {
      id: existing?.id ?? newId("slab"),
      levelId,
      polygonMm,
      thicknessMm: Math.max(50, input.thicknessMm ?? existing?.thicknessMm ?? 200),
      elevationMm: input.elevationMm ?? existing?.elevationMm ?? 0,
      offsetMm: input.offsetMm ?? existing?.offsetMm,
      material: input.material ?? existing?.material ?? { kind: "preset", presetId: "concrete" },
      holesMm: input.holesMm ?? existing?.holesMm,
      autoFromWalls: input.autoFromWalls ?? existing?.autoFromWalls ?? true,
    };
    if (existing) {
      Object.assign(existing, patch);
    } else {
      next.slabs.push(patch);
    }
    return next;
  },

  setThickness(state: RoomState, slabId: string, thicknessMm: number): RoomState {
    const next = cloneState(state);
    const slab = next.slabs.find((s) => s.id === slabId);
    if (!slab) return state;
    slab.thicknessMm = Math.max(50, thicknessMm);
    return next;
  },

  setMaterial(state: RoomState, slabId: string, material: RoomMaterialRef): RoomState {
    const next = cloneState(state);
    const slab = next.slabs.find((s) => s.id === slabId);
    if (!slab) return state;
    slab.material = material;
    return next;
  },

  setOffset(state: RoomState, slabId: string, offsetMm: Vec2Mm): RoomState {
    const next = cloneState(state);
    const slab = next.slabs.find((s) => s.id === slabId);
    if (!slab) return state;
    const prev = slab.offsetMm ?? { x: 0, z: 0 };
    const dx = offsetMm.x - prev.x;
    const dz = offsetMm.z - prev.z;
    slab.offsetMm = { ...offsetMm };
    slab.polygonMm = slab.polygonMm.map((p) => ({ x: p.x + dx, z: p.z + dz }));
    return next;
  },

  addHole(state: RoomState, slabId: string, hole: Vec2Mm[]): RoomState {
    const next = cloneState(state);
    const slab = next.slabs.find((s) => s.id === slabId);
    if (!slab) return state;
    slab.holesMm = [...(slab.holesMm ?? []), hole.map((p) => ({ ...p }))];
    return next;
  },

  getActiveSlab(state: RoomState): RoomSlab | null {
    return state.slabs.find((s) => s.levelId === state.activeLevelId) ?? null;
  },
};
