import { describe, expect, it } from "vitest";
import {
  createDefaultProjectRoom,
  normalizeProjectRoom,
} from "../../../src/3d/viewer-engine/room/RoomEngine";
import {
  ROOM_20_DEFAULTS,
  WALL_LABELS,
  type ProjectRoomConfig,
  type ProjectRoomOpening,
  type ProjectRoomWall,
} from "../../../src/3d/viewer-engine/room/roomEngineTypes";

/** Chaves obrigatórias congeladas em M0 — não alterar sem revisão do freeze. */
const PROJECT_ROOM_ROOT_KEYS = [
  "widthMm",
  "depthMm",
  "heightMm",
  "wallThicknessMm",
  "locked",
  "visible",
  "floorMode",
  "ceilingVisible",
  "hiddenWalls",
  "walls",
  "openings",
  "utilities",
] as const;

const PROJECT_ROOM_WALL_KEYS = [
  "id",
  "label",
  "widthMm",
  "lengthMm",
  "heightMm",
  "thicknessMm",
  "position",
  "rotationDeg",
] as const;

const PROJECT_ROOM_OPENING_KEYS = [
  "id",
  "type",
  "kind",
  "wallId",
  "xPosMm",
  "horizontalOffsetMm",
  "widthMm",
  "heightMm",
  "thicknessMm",
  "floorOffsetMm",
  "verticalOffsetMm",
] as const;

function sortedKeys(obj: object): string[] {
  return Object.keys(obj).sort();
}

describe("ProjectRoomConfig freeze (M0)", () => {
  it("mantém ROOM_20_DEFAULTS congelados", () => {
    expect(ROOM_20_DEFAULTS).toEqual({
      widthMm: 4000,
      depthMm: 4000,
      heightMm: 2600,
      wallThicknessMm: 200,
      floorMode: "room",
      ceilingVisible: true,
    });
  });

  it("createDefaultProjectRoom expõe exactamente as chaves raiz obrigatórias", () => {
    const room = createDefaultProjectRoom();
    expect(sortedKeys(room)).toEqual([...PROJECT_ROOM_ROOT_KEYS].sort());
    expect(room.walls).toHaveLength(4);
    expect(room.walls.map((w) => w.label)).toEqual([...WALL_LABELS]);
    expect(room.openings.length).toBeGreaterThanOrEqual(1);
    expect(room.utilities).toEqual([]);
    expect(room.zones).toBeUndefined();
    expect(room.catalogItems).toBeUndefined();
  });

  it("cada parede default expõe o shape congelado", () => {
    const room = createDefaultProjectRoom();
    for (const wall of room.walls) {
      expect(sortedKeys(wall)).toEqual([...PROJECT_ROOM_WALL_KEYS].sort());
      expect(sortedKeys(wall.position)).toEqual(["x", "y", "z"]);
    }
  });

  it("cada abertura default expõe o shape congelado", () => {
    const room = createDefaultProjectRoom();
    for (const opening of room.openings) {
      expect(sortedKeys(opening)).toEqual([...PROJECT_ROOM_OPENING_KEYS].sort());
    }
  });

  it("normalizeProjectRoom preserva chaves raiz obrigatórias e aliases de abertura", () => {
    const raw: Partial<ProjectRoomConfig> = {
      widthMm: 3500,
      depthMm: 2800,
      heightMm: 2500,
      wallThicknessMm: 180,
      openings: [
        {
          id: "o1",
          type: "door",
          kind: "normal",
          wallId: "wall-sul",
          xPosMm: 100,
          horizontalOffsetMm: 100,
          widthMm: 800,
          heightMm: 2100,
          thicknessMm: 40,
          floorOffsetMm: 0,
          verticalOffsetMm: 0,
        } satisfies ProjectRoomOpening,
      ],
    };
    const normalized = normalizeProjectRoom(raw);
    expect(normalized).not.toBeNull();
    expect(sortedKeys(normalized!)).toEqual([...PROJECT_ROOM_ROOT_KEYS].sort());
    expect(normalized!.widthMm).toBe(3500);
    expect(normalized!.walls.length).toBeGreaterThanOrEqual(4);
    const wall = normalized!.walls[0] as ProjectRoomWall;
    expect(sortedKeys(wall)).toEqual([...PROJECT_ROOM_WALL_KEYS].sort());
    const opening = normalized!.openings[0];
    expect(opening.horizontalOffsetMm).toBe(opening.xPosMm);
    expect(opening.verticalOffsetMm).toBe(opening.floorOffsetMm);
  });

  it("normalize de null/undefined devolve null (contrato de load)", () => {
    expect(normalizeProjectRoom(null)).toBeNull();
    expect(normalizeProjectRoom(undefined)).toBeNull();
  });
});
