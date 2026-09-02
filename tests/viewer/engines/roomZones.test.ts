/**
 * pimo-room v4 — testes de zonas polígono + área.
 */
import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom, normalizeProjectRoom } from "../../../src/3d/viewer-engine/room/RoomEngine";
import {
  computeZoneMetrics,
  createMainZoneFromRoom,
  ensureRoomZones,
  polygonAreaM2,
  polygonPerimeterM,
} from "../../../src/3d/room/roomZones";

describe("roomZones", () => {
  it("área e perímetro de rectângulo 4×4 m", () => {
    const poly = [
      { x: -2000, z: -2000 },
      { x: 2000, z: -2000 },
      { x: 2000, z: 2000 },
      { x: -2000, z: 2000 },
    ];
    expect(polygonAreaM2(poly)).toBeCloseTo(16, 5);
    expect(polygonPerimeterM(poly)).toBeCloseTo(16, 5);
  });

  it("ensureRoomZones é opt-in e não altera salas sem zones por omissão", () => {
    const room = createDefaultProjectRoom();
    expect(room.zones).toBeUndefined();
    const withZones = ensureRoomZones(room);
    expect(withZones.zones).toHaveLength(1);
    expect(withZones.zones![0].id).toBe("zone-room-main");
    const metrics = computeZoneMetrics(withZones.zones![0]);
    expect(metrics.areaM2).toBeCloseTo((room.widthMm * room.depthMm) / 1e6, 5);
  });

  it("normalize preserva zones quando presentes e omite quando ausentes", () => {
    const room = createDefaultProjectRoom();
    const without = normalizeProjectRoom(room);
    expect(without?.zones).toBeUndefined();

    const withZ = normalizeProjectRoom({
      ...room,
      zones: [createMainZoneFromRoom(room)],
    });
    expect(withZ?.zones).toHaveLength(1);
    expect(withZ!.zones![0].polygonMm.length).toBe(4);
  });
});
