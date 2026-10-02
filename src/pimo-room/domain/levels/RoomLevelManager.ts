/**
 * Gestão de níveis — adicionar, activar, clonar paredes, ligações verticais.
 */
import type { LevelId, RoomState, RoomWall, RoomOpening } from "../RoomState";
import { newId } from "../RoomState";
import { FloorEngine } from "../FloorEngine";
import { CeilingEngine } from "../CeilingEngine";
import { SlabEngine } from "../SlabEngine";
import {
  createLevel,
  createVerticalConnection,
  enrichLevelsWithElevations,
  type VerticalConnection,
} from "./RoomLevelState";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

function cloneWallsToLevel(
  walls: RoomWall[],
  fromLevelId: LevelId,
  toLevelId: LevelId,
  heightMm: number
): { walls: RoomWall[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const nextWalls: RoomWall[] = [];
  for (const w of walls.filter((x) => x.levelId === fromLevelId)) {
    const nid = newId("wall");
    idMap.set(w.id, nid);
    nextWalls.push({
      ...structuredClone(w),
      id: nid,
      levelId: toLevelId,
      heightMm,
    });
  }
  return { walls: nextWalls, idMap };
}

function cloneOpenings(
  openings: RoomOpening[],
  idMap: Map<string, string>
): RoomOpening[] {
  const out: RoomOpening[] = [];
  for (const o of openings) {
    const newWallId = idMap.get(o.wallId);
    if (!newWallId) continue;
    out.push({
      ...structuredClone(o),
      id: newId("opening"),
      wallId: newWallId,
    });
  }
  return out;
}

export type RoomLevelManagerResult = {
  state: RoomState;
  verticalConnections: VerticalConnection[];
};

export const RoomLevelManager = {
  list(state: RoomState) {
    return enrichLevelsWithElevations(state.levels);
  },

  setActiveLevel(state: RoomState, levelId: LevelId): RoomState {
    if (!state.levels.some((l) => l.id === levelId)) return state;
    const next = cloneState(state);
    next.activeLevelId = levelId;
    const level = next.levels.find((l) => l.id === levelId);
    if (level && next.footprint) {
      next.footprint.heightMm = level.storeyHeightMm;
    }
    return next;
  },

  /**
   * Adiciona um nível acima do activo, clonando paredes/aberturas do nível fonte.
   */
  addLevelAbove(
    state: RoomState,
    opts?: { name?: string; storeyHeightMm?: number; copyFromActive?: boolean }
  ): RoomState {
    const next = cloneState(state);
    const sourceId = next.activeLevelId;
    const maxOrdinal = next.levels.reduce((m, l) => Math.max(m, l.ordinal), -1);
    const heightMm = opts?.storeyHeightMm ?? next.footprint?.heightMm ?? 2600;
    const level = createLevel({
      ordinal: maxOrdinal + 1,
      name: opts?.name,
      storeyHeightMm: heightMm,
    });
    next.levels.push(level);

    if (opts?.copyFromActive !== false) {
      const { walls, idMap } = cloneWallsToLevel(next.walls, sourceId, level.id, heightMm);
      next.walls.push(...walls);
      next.openings.push(...cloneOpenings(next.openings, idMap));
    }

    let withSlab = FloorEngine.ensureSlabFromWalls(next, level.id);
    withSlab = CeilingEngine.ensureCeilingFromWalls(withSlab, level.id);
    withSlab = SlabEngine.ensureAdvancedSlab(withSlab, level.id, {
      thicknessMm: 200,
      elevationMm: 0,
    });
    withSlab.activeLevelId = level.id;
    if (withSlab.footprint) withSlab.footprint.heightMm = heightMm;
    return withSlab;
  },

  removeLevel(state: RoomState, levelId: LevelId): RoomState {
    if (state.levels.length <= 1) return state;
    const next = cloneState(state);
    next.levels = next.levels.filter((l) => l.id !== levelId);
    next.walls = next.walls.filter((w) => w.levelId !== levelId);
    const wallIds = new Set(next.walls.map((w) => w.id));
    next.openings = next.openings.filter((o) => wallIds.has(o.wallId));
    next.slabs = next.slabs.filter((s) => s.levelId !== levelId);
    next.ceilings = next.ceilings.filter((c) => c.levelId !== levelId);
    next.zones = next.zones.filter((z) => z.levelId !== levelId);
    if (next.activeLevelId === levelId) {
      next.activeLevelId = next.levels[0]!.id;
    }
    // Reindex ordinal
    next.levels = [...next.levels]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((l, i) => ({ ...l, ordinal: i, name: l.name.startsWith("Piso ") ? `Piso ${i}` : l.name }));
    return next;
  },

  addSimpleVerticalVoid(
    connections: VerticalConnection[],
    fromLevelId: LevelId,
    toLevelId: LevelId,
    sizeMm = 1200
  ): VerticalConnection[] {
    const half = sizeMm / 2;
    const poly = [
      { x: -half, z: -half },
      { x: half, z: -half },
      { x: half, z: half },
      { x: -half, z: half },
    ];
    return [...connections, createVerticalConnection(fromLevelId, toLevelId, poly, "void")];
  },
};
