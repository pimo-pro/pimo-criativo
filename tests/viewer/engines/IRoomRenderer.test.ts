import { describe, expect, it, vi } from "vitest";
import type { IRoomRenderer } from "../../../src/3d/viewer-engine/room/IRoomRenderer";
import { ViewerRoomEngine } from "../../../src/3d/viewer-engine/room/ViewerRoomEngine";

describe("IRoomRenderer (M1)", () => {
  it("ViewerRoomEngine legado implementa IRoomRenderer e delega createRoom", () => {
    const createRoom = vi.fn();
    const engine: IRoomRenderer = new ViewerRoomEngine(() => ({
      createRoom,
      room: { width: 4, depth: 3, height: 2.8 },
      locked: false,
      visible: true,
    }));

    engine.createRoomWithDimensions(4, 3, 2.8, 4);
    expect(createRoom).toHaveBeenCalledWith(4, 3, 2.8, 4, undefined);
    expect(engine.getRoomExists()).toBe(true);
    expect(engine.getRoomDimensions()).toEqual({ width: 4, depth: 3, height: 2.8 });
    expect(engine.getRoomLocked()).toBe(false);
    expect(engine.getRoomVisible()).toBe(true);
  });
});
