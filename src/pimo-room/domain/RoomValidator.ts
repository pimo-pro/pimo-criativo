import type { RoomOpening, RoomState } from "./RoomState";
import { wallLengthMm } from "./RoomState";
import { OpeningsEngine } from "./OpeningsEngine";

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  entityId?: string;
  message: string;
};

export const RoomValidator = {
  validate(state: RoomState): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!state.levels.length) {
      issues.push({
        code: "room.no-levels",
        severity: "error",
        message: "RoomState sem níveis",
      });
    }
    if (!state.levels.some((l) => l.id === state.activeLevelId)) {
      issues.push({
        code: "room.active-level-missing",
        severity: "error",
        message: "activeLevelId inválido",
      });
    }

    const wallIds = new Set(state.walls.map((w) => w.id));
    for (const wall of state.walls) {
      if (wallLengthMm(wall) < 100) {
        issues.push({
          code: "wall.too-short",
          severity: "warning",
          entityId: wall.id,
          message: "Parede com comprimento < 100 mm",
        });
      }
      if (wall.heightMm < 500) {
        issues.push({
          code: "wall.too-low",
          severity: "warning",
          entityId: wall.id,
          message: "Parede com altura < 500 mm",
        });
      }
    }

    for (const opening of state.openings) {
      issues.push(...OpeningsEngine.validateOnWall(state, opening));
      if (!wallIds.has(opening.wallId)) {
        issues.push({
          code: "opening.orphan",
          severity: "error",
          entityId: opening.id,
          message: "Abertura órfã",
        });
      }
    }

    const fp = state.footprint;
    if (fp && (fp.widthMm < 500 || fp.depthMm < 500)) {
      issues.push({
        code: "footprint.too-small",
        severity: "warning",
        message: "Footprint inferior a 500×500 mm",
      });
    }

    return issues;
  },

  hasErrors(state: RoomState): boolean {
    return RoomValidator.validate(state).some((i) => i.severity === "error");
  },
};

export type { RoomOpening };
