import type { OpeningId, RoomOpening, RoomOpeningKind, RoomState } from "./RoomState";
import { newId, wallLengthMm } from "./RoomState";
import type { ValidationIssue } from "./RoomValidator";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

const NUDGE_MM = 50;
const NUDGE_FAST_MM = 200;
const ROTATE_STEP_DEG = 15;

export const OpeningsEngine = {
  addOpening(state: RoomState, opening: Omit<RoomOpening, "id">): RoomState {
    const next = cloneState(state);
    next.openings.push({ ...opening, id: newId("opening") });
    return next;
  },

  removeOpening(state: RoomState, openingId: OpeningId): RoomState {
    const next = cloneState(state);
    next.openings = next.openings.filter((o) => o.id !== openingId);
    return next;
  },

  updateOpening(
    state: RoomState,
    openingId: OpeningId,
    patch: Partial<Omit<RoomOpening, "id">>
  ): RoomState {
    const next = cloneState(state);
    const opening = next.openings.find((o) => o.id === openingId);
    if (!opening) return state;
    Object.assign(opening, patch);
    // position SSOT: offsetAlongWallMm é a posição ao longo da parede.
    if (typeof patch.offsetAlongWallMm === "number") {
      opening.offsetAlongWallMm = Math.max(0, patch.offsetAlongWallMm);
    }
    if (typeof patch.sillMm === "number") {
      opening.sillMm = Math.max(0, patch.sillMm);
    }
    return next;
  },

  /** Vincula posição da abertura à posição “porta/janela” (mesmos offsets). */
  syncPositionFromDoorWindow(
    state: RoomState,
    openingId: OpeningId,
    position: { offsetAlongWallMm: number; sillMm?: number }
  ): RoomState {
    return OpeningsEngine.updateOpening(state, openingId, {
      offsetAlongWallMm: position.offsetAlongWallMm,
      ...(position.sillMm !== undefined ? { sillMm: position.sillMm } : {}),
    });
  },

  moveAlongWall(state: RoomState, openingId: OpeningId, offsetMm: number): RoomState {
    return OpeningsEngine.updateOpening(state, openingId, { offsetAlongWallMm: offsetMm });
  },

  nudge(
    state: RoomState,
    openingId: OpeningId,
    delta: { alongWallMm?: number; sillMm?: number }
  ): RoomState {
    const opening = state.openings.find((o) => o.id === openingId);
    if (!opening) return state;
    const wall = state.walls.find((w) => w.id === opening.wallId);
    const len = wall ? wallLengthMm(wall) : Infinity;
    const nextAlong = Math.max(
      0,
      Math.min(len - opening.widthMm, opening.offsetAlongWallMm + (delta.alongWallMm ?? 0))
    );
    const nextSill = Math.max(0, opening.sillMm + (delta.sillMm ?? 0));
    return OpeningsEngine.updateOpening(state, openingId, {
      offsetAlongWallMm: nextAlong,
      sillMm: nextSill,
    });
  },

  nudgeStepMm(fast: boolean): number {
    return fast ? NUDGE_FAST_MM : NUDGE_MM;
  },

  /** Q/E — alterna kind ou aplica rotação lógica (passo). */
  rotate(state: RoomState, openingId: OpeningId, direction: 1 | -1): RoomState {
    const opening = state.openings.find((o) => o.id === openingId);
    if (!opening) return state;
    const kinds: RoomOpeningKind[] = ["normal", "correr"];
    const idx = kinds.indexOf(opening.kind);
    const nextKind = kinds[(idx + direction + kinds.length) % kinds.length]!;
    void ROTATE_STEP_DEG;
    return OpeningsEngine.updateOpening(state, openingId, { kind: nextKind });
  },

  duplicate(state: RoomState, openingId: OpeningId): RoomState {
    const found = state.openings.find((o) => o.id === openingId);
    if (!found) return state;
    const wall = state.walls.find((w) => w.id === found.wallId);
    const len = wall ? wallLengthMm(wall) : found.offsetAlongWallMm + found.widthMm + 200;
    const next = cloneState(state);
    const copy: RoomOpening = {
      ...structuredClone(found),
      id: newId(found.type),
      offsetAlongWallMm: Math.min(
        Math.max(0, found.offsetAlongWallMm + 200),
        Math.max(0, len - found.widthMm)
      ),
    };
    next.openings.push(copy);
    return next;
  },

  validateOnWall(state: RoomState, opening: RoomOpening): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const wall = state.walls.find((w) => w.id === opening.wallId);
    if (!wall) {
      issues.push({
        code: "opening.missing-wall",
        severity: "error",
        entityId: opening.id,
        message: "Abertura sem parede hospedeira",
      });
      return issues;
    }
    const len = wallLengthMm(wall);
    if (opening.offsetAlongWallMm < 0 || opening.offsetAlongWallMm + opening.widthMm > len + 1) {
      issues.push({
        code: "opening.out-of-wall",
        severity: "warning",
        entityId: opening.id,
        message: "Abertura ultrapassa o comprimento da parede",
      });
    }
    if (opening.sillMm + opening.heightMm > wall.heightMm + 1) {
      issues.push({
        code: "opening.too-tall",
        severity: "warning",
        entityId: opening.id,
        message: "Abertura ultrapassa a altura da parede",
      });
    }
    return issues;
  },
};
