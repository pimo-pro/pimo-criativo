import type { RoomState, RoomWall, Vec2Mm, WallId } from "./RoomState";
import { newId, wallLengthMm } from "./RoomState";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

export const WallEngine = {
  addWall(state: RoomState, input: Omit<RoomWall, "id">): RoomState {
    const next = cloneState(state);
    next.walls.push({ ...input, id: newId("wall") });
    return next;
  },

  removeWall(state: RoomState, wallId: WallId): RoomState {
    const next = cloneState(state);
    next.walls = next.walls.filter((w) => w.id !== wallId);
    next.openings = next.openings.filter((o) => o.wallId !== wallId);
    return next;
  },

  moveEndpoint(
    state: RoomState,
    wallId: WallId,
    which: "start" | "end",
    to: Vec2Mm
  ): RoomState {
    const next = cloneState(state);
    const wall = next.walls.find((w) => w.id === wallId);
    if (!wall) return state;
    if (which === "start") wall.startMm = { ...to };
    else wall.endMm = { ...to };
    return next;
  },

  setThickness(state: RoomState, wallId: WallId, thicknessMm: number): RoomState {
    const next = cloneState(state);
    const wall = next.walls.find((w) => w.id === wallId);
    if (!wall) return state;
    wall.thicknessMm = Math.max(50, thicknessMm);
    return next;
  },

  setHeight(state: RoomState, wallId: WallId, heightMm: number): RoomState {
    const next = cloneState(state);
    const wall = next.walls.find((w) => w.id === wallId);
    if (!wall) return state;
    wall.heightMm = Math.max(500, heightMm);
    return next;
  },

  /** Fase A: no-op estrutural (miters reais na B). Mantém API. */
  computeMiters(state: RoomState, _levelId: string): RoomState {
    void _levelId;
    return state;
  },

  lengthMm(wall: RoomWall): number {
    return wallLengthMm(wall);
  },
};
