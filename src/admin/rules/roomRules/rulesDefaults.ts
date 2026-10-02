export type RoomRules = {
  /** Único campo consumido em runtime (adminSnappingRules → SmartSnapping). */
  wallOffsetMm: number;
};

export const ROOM_RULES_DEFAULTS: RoomRules = {
  wallOffsetMm: 50,
};
