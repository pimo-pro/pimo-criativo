import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { RoomManager, type IRoomManagerViewer, type RoomBounds, type WallEntryForViewer } from "../../../src/3d/room/RoomManager";
import { ViewerRoomEngine } from "../../../src/3d/viewer-engine/room/ViewerRoomEngine";

describe("pimo-room RoomManager + ViewerRoomEngine (fase 3)", () => {
  it("createRoom gera paredes centradas e notifica o viewer", () => {
    const setRoomFromManager = vi.fn();
    const clearRoomFromManager = vi.fn();
    const viewer: IRoomManagerViewer = { setRoomFromManager, clearRoomFromManager };
    const manager = new RoomManager(viewer);

    manager.createRoom(4, 3.5, 2.6, 4, 0.2);

    expect(manager.room).not.toBeNull();
    expect(manager.room!.width).toBe(4);
    expect(manager.wallsMain).toHaveLength(4);
    expect(manager.wallsMain.every((m) => m.material instanceof THREE.MeshStandardMaterial)).toBe(
      true
    );
    expect(setRoomFromManager).toHaveBeenCalledTimes(1);
    const [, bounds, group] = setRoomFromManager.mock.calls[0] as [
      WallEntryForViewer[],
      RoomBounds,
      THREE.Group,
    ];
    expect(group).toBe(manager.group);
    expect(bounds.centerX).toBeCloseTo(0, 5);
    expect(bounds.centerZ).toBeCloseTo(0, 5);
    expect(Math.abs(bounds.minX + bounds.maxX)).toBeLessThan(0.01);

    manager.removeRoom();
    expect(clearRoomFromManager).toHaveBeenCalled();
    expect(manager.room).toBeNull();
  });

  it("ViewerRoomEngine delega createRoomWithDimensions ao RoomManager", () => {
    const createRoom = vi.fn();
    const engine = new ViewerRoomEngine(() => ({
      createRoom,
      room: { width: 4, depth: 3, height: 2.6 },
    }));
    engine.createRoomWithDimensions(4, 3, 2.6, 4, 0.2);
    expect(createRoom).toHaveBeenCalledWith(4, 3, 2.6, 4, 0.2);
    expect(engine.getRoomExists()).toBe(true);
  });
});
