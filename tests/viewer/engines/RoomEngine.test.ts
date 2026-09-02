import { describe, expect, it, vi } from "vitest";
import { PROJECT_ROOM_WALL_THICKNESS_MM } from "../../../src/3d/viewer-engine/room/RoomEngine";
import {
  roomConfigToDimensions,
  ViewerRoomEngine,
} from "../../../src/3d/viewer-engine/room/ViewerRoomEngine";

describe("RoomEngine (pimo-room v4)", () => {
  it("expõe espessura em mm; a API 3D converte paredes para metros", () => {
    expect(PROJECT_ROOM_WALL_THICKNESS_MM).toBe(200);
    const dims = roomConfigToDimensions({
      walls: [
        { lengthMm: 4000, heightMm: 2800 },
        { lengthMm: 3000, heightMm: 2800 },
        { lengthMm: 4000, heightMm: 2800 },
        { lengthMm: 3000, heightMm: 2800 },
      ],
      numWalls: 4,
    } as never);
    expect(dims).toEqual({ widthM: 4, depthM: 3, heightM: 2.8, numWalls: 4 });
    expect(dims!.widthM * 1000).toBe(4000);
  });

  it("ViewerRoomEngine delega createRoom sem alterar o RoomManager interno", () => {
    const createRoom = vi.fn();
    const engine = new ViewerRoomEngine(() => ({
      createRoom,
      room: { width: 4, depth: 3, height: 2.8 },
    }));
    engine.createRoomWithDimensions(4, 3, 2.8, 4);
    expect(createRoom).toHaveBeenCalledWith(4, 3, 2.8, 4, undefined);
    expect(engine.getRoomDimensions()).toEqual({ width: 4, depth: 3, height: 2.8 });
  });
});
