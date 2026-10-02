import { describe, expect, it } from "vitest";
import { createDefaultProjectRoom } from "../../src/3d/viewer-engine/room/RoomEngine";
import { fromProjectRoomConfig } from "../../src/pimo-room/convert";
import {
  RoomIndustrialAdapter,
  toAutoRoomFillInput,
} from "../../src/pimo-room/industrial";

describe("pimo-room industrial isolation (M2)", () => {
  it("sync mantém workspaceBoxes vazio e cutlistSafe", () => {
    const state = fromProjectRoomConfig(createDefaultProjectRoom());
    const result = RoomIndustrialAdapter.sync(state);
    expect(result.workspaceBoxes).toEqual([]);
    expect(result.constraints.cutlistSafe).toBe(true);
    expect(RoomIndustrialAdapter.assertIndustrialIsolation(result)).toBe(true);
  });

  it("toAutoRoomFillInput devolve ProjectRoomConfig válido", () => {
    const base = createDefaultProjectRoom();
    const state = fromProjectRoomConfig(base);
    const input = toAutoRoomFillInput(state);
    expect(input.widthMm).toBe(base.widthMm);
    expect(input.walls.length).toBeGreaterThanOrEqual(4);
  });
});
