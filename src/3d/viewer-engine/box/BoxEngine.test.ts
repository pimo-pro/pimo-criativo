import { describe, expect, it, vi } from "vitest";
import { BoxEngine } from "./BoxEngine";
import type { BoxSceneController } from "./BoxSceneController";

describe("BoxEngine (Z-01.2.7)", () => {
  it("delega addBox ao BoxSceneController (malha permanece no BoxBuilder)", () => {
    const controller = {
      addBox: vi.fn(() => true),
      createUpdateBoxStructurePlan: vi.fn(),
      applyOnlyTransformUpdate: vi.fn(),
      applyStructuralUpdate: vi.fn(),
    } as unknown as BoxSceneController;
    const engine = new BoxEngine(controller);
    const params = { id: "box-1" } as Parameters<BoxSceneController["addBox"]>[0];
    expect(engine.addBox(params)).toBe(true);
    expect(controller.addBox).toHaveBeenCalledWith(params);
  });
});
