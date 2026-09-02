/**
 * Tipos da sala (contrato ProjectRoomConfig) — pimo-room v4.
 * Fase visual / layout. Não alimenta cutlist, CNC ou produção.
 */

export type RoomWallLabel = "norte" | "sul" | "este" | "oeste" | "extra";
export type RoomOpeningKind = "normal" | "correr";
export type RoomFloorMode = "full" | "room" | "hybrid";
export type ProjectRoomUtilityType = "ElectricalOutlet" | "WaterPoint" | "DrainPoint";

export type ProjectRoomWallPosition = {
  x: number;
  y: number;
  z: number;
};

export type ProjectRoomWall = {
  id: string;
  label: RoomWallLabel;
  /** Largura/comprimento visual da parede em mm. */
  widthMm: number;
  /** Compatibilidade com snapshots antigos; espelha widthMm. */
  lengthMm: number;
  heightMm: number;
  thicknessMm: number;
  position: ProjectRoomWallPosition;
  rotationDeg: number;
};

export type ProjectRoomOpening = {
  id: string;
  type: "door" | "window";
  /** Subtipo visual: porta/janela normal ou de correr. */
  kind: RoomOpeningKind;
  wallId: string;
  /** Posição horizontal em mm a partir da borda da parede. */
  xPosMm: number;
  /** Alias semântico para Room 2.0; espelha xPosMm. */
  horizontalOffsetMm: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  floorOffsetMm: number;
  /** Alias semântico para Room 2.0; espelha floorOffsetMm. */
  verticalOffsetMm: number;
};

export type ProjectRoomUtility = {
  id: string;
  type: ProjectRoomUtilityType;
  wallId: string;
  /** Posição em mm ao longo da parede, a partir da borda inicial. */
  positionAlongWall: number;
  heightMm: number;
};

export type ProjectRoomConfig = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  wallThicknessMm: number;
  locked: boolean;
  visible: boolean;
  floorMode: RoomFloorMode;
  ceilingVisible: boolean;
  hiddenWalls: string[];
  walls: ProjectRoomWall[];
  openings: ProjectRoomOpening[];
  utilities: ProjectRoomUtility[];
};

export const ROOM_20_DEFAULTS = {
  widthMm: 4000,
  depthMm: 4000,
  heightMm: 2600,
  wallThicknessMm: 200,
  floorMode: "room" as RoomFloorMode,
  ceilingVisible: true,
} as const;

export const WALL_LABELS: RoomWallLabel[] = ["sul", "este", "norte", "oeste"];

export const WALL_LABEL_TITLES: Record<RoomWallLabel, string> = {
  sul: "Sul (frente)",
  este: "Este (direita)",
  norte: "Norte (fundo)",
  oeste: "Oeste (esquerda)",
  extra: "Parede extra",
};

/** Índice da parede no layout conectado (wallStore / viewer). */
export const WALL_LABEL_TO_INDEX: Record<RoomWallLabel, number> = {
  sul: 0,
  este: 1,
  norte: 2,
  oeste: 3,
  extra: 999,
};

export const WALL_INDEX_TO_LABEL: Record<number, RoomWallLabel> = {
  0: "sul",
  1: "este",
  2: "norte",
  3: "oeste",
};
