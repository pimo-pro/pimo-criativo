/**
 * pimo-room v4 — testes auto-zona por loops.
 */
import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom } from "../../../src/3d/viewer-engine/room/RoomEngine";
import {
  autoZonesFromClosedLoops,
  detectClosedWallLoopsMeters,
} from "../../../src/3d/room/roomAutoZones";
import { polygonAreaM2 } from "../../../src/3d/room/roomZones";

describe("roomAutoZones", () => {
  it("detecta um loop rectangular partilhando endpoints", () => {
    const segs = [
      { start: { x: 0, z: 0 }, end: { x: 4, z: 0 } },
      { start: { x: 4, z: 0 }, end: { x: 4, z: 3 } },
      { start: { x: 4, z: 3 }, end: { x: 0, z: 3 } },
      { start: { x: 0, z: 3 }, end: { x: 0, z: 0 } },
    ];
    const loops = detectClosedWallLoopsMeters(segs, 0.05);
    expect(loops.length).toBeGreaterThanOrEqual(1);
    const area =
      Math.abs(
        loops[0].reduce((s, p, i, arr) => {
          const q = arr[(i + 1) % arr.length];
          return s + p.x * q.z - q.x * p.z;
        }, 0)
      ) / 2;
    expect(area).toBeCloseTo(12, 4);
  });

  it("autoZonesFromClosedLoops na sala por omissão produz ≥1 zona com área ~ footprint", () => {
    const room = createDefaultProjectRoom();
    const zones = autoZonesFromClosedLoops(room);
    expect(zones.length).toBeGreaterThanOrEqual(1);
    const area = polygonAreaM2(zones[0].polygonMm);
    const expected = (room.widthMm * room.depthMm) / 1e6;
    // Eixos de parede estão offset pela espessura — área próxima (±35%)
    expect(area).toBeGreaterThan(expected * 0.65);
    expect(area).toBeLessThan(expected * 1.35);
  });
});
