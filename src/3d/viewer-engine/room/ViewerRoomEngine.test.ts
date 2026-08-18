import { describe, expect, it, vi } from "vitest";
import { roomConfigToDimensions, ViewerRoomEngine } from "./ViewerRoomEngine";

describe("ViewerRoomEngine (Z-01.2.7)", () => {
  it("converte RoomConfig para metros sem tocar no RoomManager interno", () => {
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
  });

  it("delega create/remove ao RoomManager", () => {
    const createRoom = vi.fn();
    const removeRoom = vi.fn();
    const engine = new ViewerRoomEngine(() => ({
      createRoom,
      removeRoom,
      room: { width: 4, depth: 3, height: 2.8 },
    }));
    engine.createRoomWithDimensions(4, 3, 2.8, 4);
    expect(createRoom).toHaveBeenCalledWith(4, 3, 2.8, 4, undefined);
    expect(engine.removeRoom()).toBe(true);
    expect(removeRoom).toHaveBeenCalled();
  });
});
