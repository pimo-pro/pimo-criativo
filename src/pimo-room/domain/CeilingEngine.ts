import { footprintRectPolygon, computeFootprintFromWalls } from "./RoomGeometry";
import type { RoomState } from "./RoomState";
import { newId } from "./RoomState";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

export const CeilingEngine = {
  ensureCeilingFromWalls(state: RoomState, levelId: string): RoomState {
    const next = cloneState(state);
    const walls = next.walls.filter((w) => w.levelId === levelId);
    const fp = computeFootprintFromWalls(walls);
    const poly = footprintRectPolygon(fp);
    const heightMm =
      next.footprint?.heightMm ??
      next.levels.find((l) => l.id === levelId)?.storeyHeightMm ??
      2600;
    const existing = next.ceilings.find((c) => c.levelId === levelId);
    if (existing) {
      existing.polygonMm = poly;
      existing.heightMm = heightMm;
    } else {
      next.ceilings.push({
        id: newId("ceiling"),
        levelId,
        polygonMm: poly,
        heightMm,
      });
    }
    return next;
  },

  setHeight(state: RoomState, ceilingId: string, heightMm: number): RoomState {
    const next = cloneState(state);
    const ceiling = next.ceilings.find((c) => c.id === ceilingId);
    if (!ceiling) return state;
    ceiling.heightMm = Math.max(500, heightMm);
    return next;
  },
};
