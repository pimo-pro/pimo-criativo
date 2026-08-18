import { describe, expect, it, vi } from "vitest";
import { ROOM_LAYOUT_INSET_MM } from "../autoLayout/autoLayoutTypes";
import type { AutoLayoutPlan } from "../autoLayout/autoLayoutTypes";
import type { SmartLayoutBridge } from "../snapping/smartLayoutTypes";
import { LayoutEngine } from "./LayoutEngine";

vi.mock("../../../core/autoRoomFill", () => ({
  runKitchenLayout30OnState: vi.fn((prev: { id: string }) => ({
    state: { ...prev, filledBy: "kitchen-3.0" },
    createdBoxIds: [],
  })),
  runAutoRoomFillOnState: vi.fn((prev: { id: string }) => ({
    state: { ...prev, filledBy: "legacy-room" },
    createdBoxIds: [],
  })),
}));

function makeBox() {
  return {
    id: "box-1",
    locked: false,
    posicaoX_mm: 600,
    posicaoY_mm: 360,
    posicaoZ_mm: 300,
    rotacaoY: 0,
    espessura: 18,
    dimensoes: { largura: 600, profundidade: 560, altura: 720 },
  };
}

function makeBridge(onPlan: (_plan: AutoLayoutPlan) => void): SmartLayoutBridge {
  return {
    getWorkspaceBoxes: () => [makeBox() as never],
    applyPlan: onPlan,
    getRoomBoundsMm: () => ({
      minX_mm: 0,
      maxX_mm: 3600,
      minZ_mm: 0,
      maxZ_mm: 3000,
      minY_mm: 0,
      maxY_mm: 2700,
    }),
    getOpeningsMm: () => [],
    getWallOffsetMm: () => 0,
  };
}

describe("LayoutEngine (Z-01.2.4)", () => {
  it("projecto: Kitchen 3.0 é o canónico; auto-room legado fica no outro canal", async () => {
    const { runKitchenLayout30OnState, runAutoRoomFillOnState } = await import(
      "../../../core/autoRoomFill"
    );
    const prev = { id: "proj-1" } as never;

    const kitchen = LayoutEngine.runProjectKitchenLayout(prev);
    const legacy = LayoutEngine.runProjectAutoRoomFill(prev);

    expect(runKitchenLayout30OnState).toHaveBeenCalledTimes(1);
    expect(runAutoRoomFillOnState).toHaveBeenCalledTimes(1);
    expect(kitchen?.state).toMatchObject({ filledBy: "kitchen-3.0" });
    expect(legacy?.state).toMatchObject({ filledBy: "legacy-room" });
  });

  it("3D fillWallWithModule produz posições em mm (não metros); inset de parede é 0 mm", () => {
    expect(ROOM_LAYOUT_INSET_MM).toBe(0);

    const placements: Array<{ x_mm: number; y_mm: number; z_mm: number }> = [];
    const bridge = makeBridge((plan) => {
      for (const m of plan.moveBoxes) placements.push(m.placement);
      for (const c of plan.cloneBoxes) placements.push(c.placement);
    });

    const engine = new LayoutEngine({
      getBridge: () => bridge,
      refineBoxWithSmartSnap: () => {},
      isSmartSnapEnabled: () => false,
      buildSnapContext: () => ({}) as never,
      getBoxWorldPosition: () => null,
      setBoxWorldPosition: () => {},
    });
    engine.bindBridge(bridge);

    const ok = engine.fillWallWithModule(0, "box-1");
    expect(ok).toBe(true);
    expect(placements.length).toBeGreaterThan(0);
    for (const p of placements) {
      expect(p.x_mm).toBeGreaterThanOrEqual(100);
      expect(p.y_mm).toBeCloseTo(360, 6);
      expect(p.z_mm).toBeGreaterThanOrEqual(100);
      expect(p.x_mm).toBeLessThan(10_000);
      expect(p.z_mm).toBeLessThan(10_000);
    }
  });

  it("3D: autoLayout.fillWallWithModule e smartLayout.autoWallFill são adapters distintos", () => {
    const bridge = makeBridge(() => {});
    const engine = new LayoutEngine({
      getBridge: () => bridge,
      refineBoxWithSmartSnap: () => {},
      isSmartSnapEnabled: () => false,
      buildSnapContext: () => ({}) as never,
      getBoxWorldPosition: () => null,
      setBoxWorldPosition: () => {},
    });
    engine.bindBridge(bridge);

    const autoLayout = vi.spyOn(engine.autoLayoutEngine, "fillWallWithModule");
    const smartWall = vi.spyOn(engine.wallFill, "fillWall");

    engine.fillWallWithModule(0, "box-1");
    expect(autoLayout).toHaveBeenCalledTimes(1);
    expect(smartWall).not.toHaveBeenCalled();

    engine.autoWallFill(0, "box-1");
    expect(smartWall).toHaveBeenCalledTimes(1);

    autoLayout.mockRestore();
    smartWall.mockRestore();
  });
});
