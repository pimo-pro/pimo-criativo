/**
 * Geometria por nível (mm) — descritores para render / walkthrough.
 */
import { buildRoomGeometry, computeFootprintFromWalls, footprintRectPolygon } from "../RoomGeometry";
import type { RoomGeometryDescriptor } from "../RoomGeometry";
import type { RoomState } from "../RoomState";
import { enrichLevelsWithElevations, type RoomLevelState } from "./RoomLevelState";

export type RoomLevelGeometryDesc = {
  level: RoomLevelState;
  geometry: RoomGeometryDescriptor;
  /** Offset Y em metros para empilhar no ViewerCore. */
  baseElevationM: number;
};

export const RoomLevelGeometry = {
  forLevel(state: RoomState, levelId: string): RoomLevelGeometryDesc | null {
    const levels = enrichLevelsWithElevations(state.levels);
    const level = levels.find((l) => l.id === levelId);
    if (!level) return null;
    const subset: RoomState = {
      ...state,
      activeLevelId: levelId,
      walls: state.walls.filter((w) => w.levelId === levelId),
      openings: state.openings.filter((o) =>
        state.walls.some((w) => w.id === o.wallId && w.levelId === levelId)
      ),
      slabs: state.slabs.filter((s) => s.levelId === levelId),
      ceilings: state.ceilings.filter((c) => c.levelId === levelId),
      zones: state.zones.filter((z) => z.levelId === levelId),
      footprint: {
        widthMm: state.footprint?.widthMm ?? 4000,
        depthMm: state.footprint?.depthMm ?? 4000,
        heightMm: level.storeyHeightMm,
        wallThicknessMm: state.footprint?.wallThicknessMm ?? 200,
      },
    };
    return {
      level,
      geometry: buildRoomGeometry(subset),
      baseElevationM: level.baseElevationMm / 1000,
    };
  },

  allStacked(state: RoomState): RoomLevelGeometryDesc[] {
    return enrichLevelsWithElevations(state.levels)
      .map((l) => RoomLevelGeometry.forLevel(state, l.id))
      .filter((d): d is RoomLevelGeometryDesc => d != null);
  },

  footprintPolygonForLevel(state: RoomState, levelId: string) {
    const walls = state.walls.filter((w) => w.levelId === levelId);
    const fp = computeFootprintFromWalls(walls);
    if (fp.widthMm <= 0) {
      return footprintRectPolygon({
        minX: -(state.footprint?.widthMm ?? 4000) / 2,
        maxX: (state.footprint?.widthMm ?? 4000) / 2,
        minZ: -(state.footprint?.depthMm ?? 4000) / 2,
        maxZ: (state.footprint?.depthMm ?? 4000) / 2,
      });
    }
    return footprintRectPolygon(fp);
  },
};
