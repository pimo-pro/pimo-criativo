import { describe, expect, it, vi } from "vitest";
import { BoxEngine } from "../../../src/3d/viewer-engine/box/BoxEngine";
import type { BoxSceneController } from "../../../src/3d/viewer-engine/box/BoxSceneController";

describe("BoxEngine (Z-01.2.8 C)", () => {
  it("addBox via fachada delega ao controller; malha permanece no BoxBuilder", () => {
    const controller = {
      addBox: vi.fn((params: { id: string; options?: { width?: number } }) => params.id === "box-1"),
      createUpdateBoxStructurePlan: vi.fn(),
      applyOnlyTransformUpdate: vi.fn(),
      applyStructuralUpdate: vi.fn(),
    } as unknown as BoxSceneController;
    const engine = new BoxEngine(controller);

    expect(engine.addBox({ id: "box-1", options: { width: 0.6 } } as never)).toBe(true);
    expect(controller.addBox).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(controller.addBox).mock.calls[0]?.[0] as { options?: { width?: number } };
    expect((arg.options?.width ?? 0) * 1000).toBeCloseTo(600);
  });
});
