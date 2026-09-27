import { footprintRectPolygon, computeFootprintFromWalls } from "./RoomGeometry";
import type { RoomState } from "./RoomState";
import { newId } from "./RoomState";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

export type EnsureSlabOptions = {
  /** Se true, footprint width/depth passam a seguir as paredes (após import). */
  syncFootprint?: boolean;
};

export const FloorEngine = {
  /**
   * Ajusta o slab (piso) à geometria das paredes do nível (RoomGeometry).
   * Com `syncFootprint`, actualiza também footprint.width/depth a partir das paredes.
   */
  ensureSlabFromWalls(state: RoomState, levelId: string, opts?: EnsureSlabOptions): RoomState {
    const next = cloneState(state);
    const walls = next.walls.filter((w) => w.levelId === levelId);
    const fp = computeFootprintFromWalls(walls);
    const poly = footprintRectPolygon(fp);
    const existing = next.slabs.find((s) => s.levelId === levelId);
    if (existing) {
      existing.polygonMm = poly;
      existing.elevationMm = 0;
      existing.autoFromWalls = true;
      if (existing.thicknessMm < 50) existing.thicknessMm = 200;
    } else {
      next.slabs.push({
        id: newId("slab"),
        levelId,
        polygonMm: poly,
        thicknessMm: 200,
        elevationMm: 0,
        autoFromWalls: true,
      });
    }

    const storeyHeight =
      next.levels.find((l) => l.id === levelId)?.storeyHeightMm ??
      next.footprint?.heightMm ??
      2600;
    const thicknessMm = walls[0]?.thicknessMm ?? next.footprint?.wallThicknessMm ?? 200;
    const syncFootprint = opts?.syncFootprint === true;

    if (fp.widthMm > 0 && fp.depthMm > 0) {
      if (!next.footprint) {
        next.footprint = {
          widthMm: fp.widthMm,
          depthMm: fp.depthMm,
          heightMm: storeyHeight,
          wallThicknessMm: thicknessMm,
        };
      } else if (syncFootprint) {
        next.footprint = {
          widthMm: fp.widthMm,
          depthMm: fp.depthMm,
          heightMm: next.footprint.heightMm || storeyHeight,
          wallThicknessMm: next.footprint.wallThicknessMm || thicknessMm,
        };
      } else {
        // Manter SSOT de design (width/depth); só preencher zeros.
        if (!next.footprint.widthMm) next.footprint.widthMm = fp.widthMm;
        if (!next.footprint.depthMm) next.footprint.depthMm = fp.depthMm;
        if (!next.footprint.heightMm) next.footprint.heightMm = storeyHeight;
        if (!next.footprint.wallThicknessMm) next.footprint.wallThicknessMm = thicknessMm;
      }
    } else if (!next.footprint) {
      next.footprint = {
        widthMm: 0,
        depthMm: 0,
        heightMm: storeyHeight,
        wallThicknessMm: thicknessMm,
      };
    }

    return next;
  },

  /** Reaplica piso em todos os níveis e sincroniza footprint (ex.: após import). */
  syncAllLevels(state: RoomState): RoomState {
    let next = state;
    for (const level of state.levels) {
      next = FloorEngine.ensureSlabFromWalls(next, level.id, { syncFootprint: true });
    }
    return next;
  },

  setPolygon(state: RoomState, slabId: string, polygonMm: { x: number; z: number }[]): RoomState {
    const next = cloneState(state);
    const slab = next.slabs.find((s) => s.id === slabId);
    if (!slab) return state;
    slab.polygonMm = polygonMm.map((p) => ({ ...p }));
    slab.autoFromWalls = false;
    return next;
  },
};
