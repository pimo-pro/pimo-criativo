import { describe, expect, it, vi } from "vitest";
import { GizmoEngine } from "../../../src/3d/viewer-engine/tools/GizmoEngine";
import type { ViewerTools } from "../../../src/3d/viewer-engine/tools/ViewerTools";

describe("GizmoEngine (Z-01.2.8 B)", () => {
  it("attach/detach delegam ao ViewerTools (sem clamp de snap)", () => {
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
