/**
 * RoomEngine — tipos SSOT (mm). Fase A+B: multi-level, slabs avançados.
 * Não importa THREE. Não alimenta cutlist/CNC.
 */

export type RoomId = string;
export type LevelId = string;
export type WallId = string;
export type OpeningId = string;

export type Vec2Mm = { x: number; z: number };
export type Vec3Mm = { x: number; y: number; z: number };

export type RoomWallLabel = "norte" | "sul" | "este" | "oeste" | "extra" | "custom";

export type RoomMaterialRef =
  | { kind: "preset"; presetId: string }
  | { kind: "color"; hex: string; roughness?: number; metalness?: number }
  | { kind: "pimo"; materialId: string };

export type RoomWall = {
  id: WallId;
  levelId: LevelId;
  startMm: Vec2Mm;
  endMm: Vec2Mm;
  heightMm: number;
  thicknessMm: number;
  label?: RoomWallLabel;
  materialSlots?: {
    interior?: RoomMaterialRef;
    exterior?: RoomMaterialRef;
  };
};

export type RoomOpeningKind = "normal" | "correr";

export type RoomOpening = {
  id: OpeningId;
  type: "door" | "window";
  wallId: WallId;
  kind: RoomOpeningKind;
  offsetAlongWallMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  thicknessMm: number;
};

export type RoomZone = {
  id: string;
  levelId: LevelId;
  name: string;
  polygonMm: Vec2Mm[];
  spaceRole?: "generic" | "room" | "kitchen" | "living";
};

export type RoomSlab = {
  id: string;
  levelId: LevelId;
  polygonMm: Vec2Mm[];
  thicknessMm: number;
  elevationMm: number;
  offsetMm?: Vec2Mm;
  material?: RoomMaterialRef;
  holesMm?: Vec2Mm[][];
  autoFromWalls?: boolean;
};

export type RoomCeiling = {
  id: string;
  levelId: LevelId;
  polygonMm: Vec2Mm[];
  heightMm: number;
};

export type RoomLevel = {
  id: LevelId;
  ordinal: number;
  name: string;
  storeyHeightMm: number;
};

export type RoomItem = {
  id: string;
  levelId: LevelId;
  catalogId: string;
  positionMm: Vec3Mm;
  rotationDeg: number;
  wallId?: string;
  /** Fase C */
  type?: import("./catalog/CatalogItem").CatalogItemType;
  name?: string;
  scale?: { x: number; y: number; z: number };
  src?: string;
};

export type RoomWalkthroughSpawn = {
  positionMm: Vec3Mm;
  yawDeg: number;
  levelId?: LevelId;
};

export type RoomState = {
  version: 1 | 2 | 3 | 4 | 5;
  id: RoomId;
  levels: RoomLevel[];
  activeLevelId: LevelId;
  walls: RoomWall[];
  openings: RoomOpening[];
  zones: RoomZone[];
  slabs: RoomSlab[];
  ceilings: RoomCeiling[];
  items: RoomItem[];
  materials: Record<string, RoomMaterialRef>;
  locked: boolean;
  footprint?: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
    wallThicknessMm: number;
  };
  verticalConnections?: import("./levels/RoomLevelState").VerticalConnection[];
  walkthroughSpawn?: RoomWalkthroughSpawn;
  /** Fase D — referências a assets IFC/GLB importados. */
  sourceAssets?: {
    ifc?: { src?: string; metadata?: Record<string, unknown> };
    glb?: { src?: string; metadata?: Record<string, unknown> };
  };
  /** Fase E — último preset AI aplicado. */
  aiPreset?: import("./ai/AiPresets").AiPresetId;
};

export const ROOM_ENGINE_DEFAULTS = {
  widthMm: 4000,
  depthMm: 4000,
  heightMm: 2600,
  wallThicknessMm: 200,
  levelId: "level-0",
} as const;

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function wallLengthMm(wall: Pick<RoomWall, "startMm" | "endMm">): number {
  const dx = wall.endMm.x - wall.startMm.x;
  const dz = wall.endMm.z - wall.startMm.z;
  return Math.hypot(dx, dz);
}

export function createEmptyRoomState(partial?: Partial<RoomState>): RoomState {
  const levelId = ROOM_ENGINE_DEFAULTS.levelId;
  return {
    version: 3,
    id: newId("room"),
    levels: [
      {
        id: levelId,
        ordinal: 0,
        name: "Piso 0",
        storeyHeightMm: ROOM_ENGINE_DEFAULTS.heightMm,
      },
    ],
    activeLevelId: levelId,
    walls: [],
    openings: [],
    zones: [],
    slabs: [],
    ceilings: [],
    items: [],
    materials: {},
    locked: false,
    footprint: {
      widthMm: ROOM_ENGINE_DEFAULTS.widthMm,
      depthMm: ROOM_ENGINE_DEFAULTS.depthMm,
      heightMm: ROOM_ENGINE_DEFAULTS.heightMm,
      wallThicknessMm: ROOM_ENGINE_DEFAULTS.wallThicknessMm,
    },
    verticalConnections: [],
    ...partial,
  };
}
