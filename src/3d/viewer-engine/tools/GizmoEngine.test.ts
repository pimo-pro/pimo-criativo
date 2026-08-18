import { describe, expect, it, vi } from "vitest";
import { GizmoEngine } from "./GizmoEngine";
import type { ViewerTools } from "./ViewerTools";

describe("GizmoEngine (Z-01.2.7)", () => {
  it("delega refresh e restore ao ViewerTools", () => {
    const tools = {
      updateTransformControlsAttachment: vi.fn(),
      restoreTransformGizmoPivot: vi.fn(),
    } as unknown as ViewerTools;
    const engine = new GizmoEngine(tools);
    engine.refreshAttachment();
    engine.restorePivot();
    expect(tools.updateTransformControlsAttachment).toHaveBeenCalledTimes(1);
    expect(tools.restoreTransformGizmoPivot).toHaveBeenCalledTimes(1);
  });
});
