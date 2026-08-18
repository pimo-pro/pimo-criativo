import { describe, expect, it, vi } from "vitest";
import { SelectionEngine } from "./SelectionEngine";

describe("SelectionEngine (Z-01.2.7)", () => {
  it("actualiza outlines e grupo sem alterar malha", () => {
    const syncMultiOutlines = vi.fn();
    const setGroupMemberIds = vi.fn();
    const clearGroupMemberIds = vi.fn();
    const refreshGizmo = vi.fn();
    const engine = new SelectionEngine({
      syncMultiOutlines,
      setGroupMemberIds,
      clearGroupMemberIds,
      refreshGizmo,
      getSelectedObjects: () => [],
      notifyAligned: vi.fn(),
    });

    engine.setMultiSelectionOutlines(["box:a"]);
    engine.setGroupTransformMembers(["box:a", "box:b"]);
    engine.clearGroupTransformMembers();

    expect(syncMultiOutlines).toHaveBeenCalledWith(["box:a"]);
    expect(setGroupMemberIds).toHaveBeenCalledWith(["box:a", "box:b"]);
    expect(clearGroupMemberIds).toHaveBeenCalled();
    expect(refreshGizmo).toHaveBeenCalledTimes(2);
  });

  it("align recusa lista vazia", () => {
    const engine = new SelectionEngine({
      syncMultiOutlines: vi.fn(),
      setGroupMemberIds: vi.fn(),
      clearGroupMemberIds: vi.fn(),
      refreshGizmo: vi.fn(),
      getSelectedObjects: () => [],
      notifyAligned: vi.fn(),
    });
    expect(engine.align("left")).toBe(false);
  });
});
