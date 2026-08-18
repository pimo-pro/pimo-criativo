import { describe, expect, it, vi } from "vitest";
import { SelectionEngine } from "../../../src/3d/viewer-engine/selection/SelectionEngine";

describe("SelectionEngine (Z-01.2.8 B)", () => {
  it("hit-test básico: outlines por id e align recusa selecção insuficiente", () => {
    const syncMultiOutlines = vi.fn();
    const engine = new SelectionEngine({
      syncMultiOutlines,
      setGroupMemberIds: vi.fn(),
      clearGroupMemberIds: vi.fn(),
      refreshGizmo: vi.fn(),
      getSelectedObjects: () => [],
      notifyAligned: vi.fn(),
    });

    engine.setMultiSelectionOutlines(["box:a"]);
    expect(syncMultiOutlines).toHaveBeenCalledWith(["box:a"]);
    expect(engine.align("left")).toBe(false);
  });
});
