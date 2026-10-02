import type { RulesFieldDef } from "../shared/types";
import type { RoomRules } from "./rulesDefaults";

/** Apenas campos com consumidor runtime — M9-A. */
export const ROOMRULES_FIELDS: RulesFieldDef[] = [
  { key: "wallOffsetMm", label: "Wall Offset (mm)", type: "number", section: "Room Snap", min: 0, step: 1 },
];

export type { RoomRules };
