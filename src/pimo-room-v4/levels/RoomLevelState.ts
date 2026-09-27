/**
 * Extensões multi-level do RoomState (Fase B).
 * RoomLevel base continua em RoomState.ts — aqui helpers e ligações verticais.
 */
import type { LevelId, RoomLevel, RoomState, Vec2Mm } from "../RoomState";
import { newId, ROOM_ENGINE_DEFAULTS } from "../RoomState";

export type RoomLevelState = RoomLevel & {
  /** Altura livre do piso ao tecto (mm). Default = storeyHeightMm. */
  floorHeightMm: number;
  /** Altura do tecto relativamente ao piso do nível (mm). */
  ceilingHeightMm: number;
  /** Elevação da base do nível no edifício (mm), calculada ou explícita. */
  baseElevationMm: number;
};

export type VerticalConnection = {
  id: string;
  fromLevelId: LevelId;
  toLevelId: LevelId;
  /** Abertura no plano da laje (mm, centrado). */
  polygonMm: Vec2Mm[];
  kind: "stairwell" | "void" | "shaft";
};

export function toRoomLevelState(level: RoomLevel, baseElevationMm = 0): RoomLevelState {
  const floorHeightMm = level.storeyHeightMm || ROOM_ENGINE_DEFAULTS.heightMm;
  return {
    ...level,
    floorHeightMm,
    ceilingHeightMm: floorHeightMm,
    baseElevationMm,
  };
}

export function enrichLevelsWithElevations(levels: RoomLevel[]): RoomLevelState[] {
  const sorted = [...levels].sort((a, b) => a.ordinal - b.ordinal);
  let elev = 0;
  return sorted.map((level) => {
    const enriched = toRoomLevelState(level, elev);
    elev += enriched.storeyHeightMm;
    return enriched;
  });
}

export function getActiveLevelState(state: RoomState): RoomLevelState | null {
  const enriched = enrichLevelsWithElevations(state.levels);
  return enriched.find((l) => l.id === state.activeLevelId) ?? enriched[0] ?? null;
}

export function createLevel(opts?: {
  ordinal?: number;
  name?: string;
  storeyHeightMm?: number;
}): RoomLevel {
  const ordinal = opts?.ordinal ?? 0;
  return {
    id: newId(`level-${ordinal}`),
    ordinal,
    name: opts?.name ?? `Piso ${ordinal}`,
    storeyHeightMm: opts?.storeyHeightMm ?? ROOM_ENGINE_DEFAULTS.heightMm,
  };
}

export function createVerticalConnection(
  fromLevelId: LevelId,
  toLevelId: LevelId,
  polygonMm: Vec2Mm[],
  kind: VerticalConnection["kind"] = "void"
): VerticalConnection {
  return {
    id: newId("vconn"),
    fromLevelId,
    toLevelId,
    polygonMm,
    kind,
  };
}
