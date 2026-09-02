/**
 * pimo-room v4 — testes de cotas de zona.
 */
import { describe, expect, it } from "vitest";
import { createMainZoneFromRoom } from "../../../src/3d/room/roomZones";
import { formatZoneDimensionText } from "../../../src/3d/room/zoneDimensionLabels";
import { createDefaultProjectRoom } from "../../../src/3d/viewer-engine/room/RoomEngine";

describe("zoneDimensionLabels", () => {
  it("formata área e perímetro em português métrico", () => {
    const room = createDefaultProjectRoom();
    const zone = createMainZoneFromRoom(room);
    const text = formatZoneDimensionText(zone);
    expect(text).toContain("m²");
    expect(text).toContain("P ");
    expect(text).toContain("Sala");
    // 4×4 m → 16.00 m²
    expect(text).toMatch(/16\.00 m²/);
  });
});
