import { describe, expect, it, vi } from "vitest";
import { LayoutEngine } from "../../../src/3d/viewer-engine/layout/LayoutEngine";

vi.mock("@/core/autoRoomFill", () => ({
  runKitchenLayout30OnState: vi.fn((prev: { id: string }) => ({
    state: { ...prev, filledBy: "kitchen-3.0" },
    createdBoxIds: [],
  })),
  runAutoRoomFillOnState: vi.fn((prev: { id: string }) => ({
    state: { ...prev, filledBy: "legacy-room" },
    createdBoxIds: [],
  })),
}));

describe("LayoutEngine (Z-01.2.8 D)", () => {
  it("a fachada delega Kitchen 3.0 no canal de projecto e adapters 3D à parte", async () => {
    const { runKitchenLayout30OnState, runAutoRoomFillOnState } = await import("@/core/autoRoomFill");
    const prev = { id: "proj-facade" } as never;

    expect(LayoutEngine.runProjectKitchenLayout(prev)?.state).toMatchObject({ filledBy: "kitchen-3.0" });
    expect(LayoutEngine.runProjectAutoRoomFill(prev)?.state).toMatchObject({ filledBy: "legacy-room" });
    expect(runKitchenLayout30OnState).toHaveBeenCalledTimes(1);
    expect(runAutoRoomFillOnState).toHaveBeenCalledTimes(1);

    const engine = new LayoutEngine({
      getBridge: () => null,
      refineBoxWithSmartSnap: () => {},
      isSmartSnapEnabled: () => false,
      buildSnapContext: () => ({}) as never,
      getBoxWorldPosition: () => null,
      setBoxWorldPosition: () => {},
    });
    const autoLayout = vi.spyOn(engine.autoLayoutEngine, "fillWallWithModule").mockReturnValue(false);
    const smartWall = vi.spyOn(engine.wallFill, "fillWall").mockReturnValue(false);

    engine.fillWallWithModule(0, "box-1");
    engine.autoWallFill(0, "box-1");

    expect(autoLayout).toHaveBeenCalledTimes(1);
    expect(smartWall).toHaveBeenCalledTimes(1);
    autoLayout.mockRestore();
    smartWall.mockRestore();
  });
});
