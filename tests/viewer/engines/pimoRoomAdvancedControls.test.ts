import { describe, expect, it } from "vitest";
import {
  alignOpeningHorizontal,
  alignOpeningVertical,
  refineOpeningPlacement,
  snapVerticalOffset,
} from "../../../src/utils/openingConstraints";
import { applyWallLengthToRoom } from "../../../src/3d/room/roomAdvancedEdit";
import { createDefaultProjectRoom } from "../../../src/3d/viewer-engine/room/RoomEngine";

describe("pimo-room controlos avançados (fase 5)", () => {
  it("align horizontal/vertical posiciona nas âncoras da parede", () => {
    expect(alignOpeningHorizontal("start", 900, 4000)).toBe(0);
    expect(alignOpeningHorizontal("center", 900, 4000)).toBe(1550);
    expect(alignOpeningHorizontal("end", 900, 4000)).toBe(3100);
    expect(alignOpeningVertical("floor", 1200, 2600)).toBe(0);
    expect(alignOpeningVertical("middle", 1200, 2600)).toBe(700);
    expect(alignOpeningVertical("top", 1200, 2600)).toBe(1400);
  });

  it("snap vertical atrai para piso/meio/topo", () => {
    expect(snapVerticalOffset(40, 2100, 2600, false)).toBe(0);
    expect(snapVerticalOffset(720, 1200, 2600, false)).toBe(700);
  });

  it("refineOpeningPlacement com snap activa grelha", () => {
    const refined = refineOpeningPlacement(
      { widthMm: 900, heightMm: 2100, horizontalOffsetMm: 123, floorOffsetMm: 17 },
      4000,
      2600,
      { snap: true }
    );
    expect(refined.horizontalOffsetMm % 50).toBe(0);
    expect(refined.floorOffsetMm).toBe(0);
  });

  it("applyWallLengthToRoom actualiza footprint canónico", () => {
    const room = createDefaultProjectRoom();
    const sul = room.walls.find((w) => w.label === "sul")!;
    const next = applyWallLengthToRoom(room, sul.id, 5200);
    expect(next.widthMm).toBe(5200);
    expect(next.walls.find((w) => w.label === "sul")!.widthMm).toBe(5200);
    expect(next.walls.find((w) => w.label === "norte")!.widthMm).toBe(5200);
  });
});
