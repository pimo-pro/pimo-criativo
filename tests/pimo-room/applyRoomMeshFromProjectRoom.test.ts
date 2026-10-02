import { describe, expect, it, vi } from "vitest";
import { createDefaultProjectRoom } from "../../src/3d/viewer-engine/room/RoomEngine";
import {
  applyRoomMeshFromProjectRoom,
  getProjectRoomMeshFingerprint,
} from "../../src/pimo-room/applyRoomMeshFromProjectRoom";

describe("applyRoomMeshFromProjectRoom (M7)", () => {
  it("fingerprint é estável para a mesma sala", () => {
    const room = createDefaultProjectRoom();
    expect(getProjectRoomMeshFingerprint(room)).toBe(getProjectRoomMeshFingerprint(room));
    expect(getProjectRoomMeshFingerprint(room).length).toBeGreaterThan(10);
  });

  it("fingerprint muda com dimensões", () => {
    const room = createDefaultProjectRoom();
    const a = getProjectRoomMeshFingerprint(room);
    const b = getProjectRoomMeshFingerprint({ ...room, widthMm: room.widthMm + 100 });
    expect(a).not.toBe(b);
  });

  it("aplica createRoomWithDimensions a partir do SSOT mm", () => {
    const createRoomWithDimensions = vi.fn();
    const removeRoom = vi.fn();
    const room = createDefaultProjectRoom();
    applyRoomMeshFromProjectRoom({ createRoomWithDimensions, removeRoom }, room);
    expect(createRoomWithDimensions).toHaveBeenCalled();
    const [w, d, h, numWalls] = createRoomWithDimensions.mock.calls[0]!;
    expect(w).toBeCloseTo(room.widthMm / 1000, 5);
    expect(d).toBeCloseTo(room.depthMm / 1000, 5);
    expect(h).toBeCloseTo(room.heightMm / 1000, 5);
    expect(numWalls).toBe(4);
  });

  it("removeRoom se paredes insuficientes", () => {
    const createRoomWithDimensions = vi.fn();
    const removeRoom = vi.fn();
    const room = createDefaultProjectRoom();
    applyRoomMeshFromProjectRoom(
      { createRoomWithDimensions, removeRoom },
      { ...room, walls: room.walls.slice(0, 2) }
    );
    expect(removeRoom).toHaveBeenCalled();
    expect(createRoomWithDimensions).not.toHaveBeenCalled();
  });
});
