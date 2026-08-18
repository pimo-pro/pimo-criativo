import { describe, expect, it } from "vitest";
import { shouldAttachScaleGizmo } from "./scaleGizmoPolicy";

const emptySelection = {
  selectedRemateId: null,
  selectedRodapeId: null,
  selectedHematiId: null,
  selectedDivSep: null,
  selectedWallIndex: null,
  selectedRoomElementId: null,
  selectedRoomUtilityId: null,
  groupMemberCount: 0,
  boxEntry: undefined as { cadOnly?: boolean; locked?: boolean } | undefined,
};

describe("shouldAttachScaleGizmo (Z-02.2)", () => {
  it("anexa em caixa cadOnly (GLB)", () => {
    expect(
      shouldAttachScaleGizmo({
        ...emptySelection,
        boxEntry: { cadOnly: true },
      })
    ).toBe(true);
  });

  it("não anexa em caixa industrial", () => {
    expect(
      shouldAttachScaleGizmo({
        ...emptySelection,
        boxEntry: { cadOnly: false },
      })
    ).toBe(false);
  });

  it("não anexa em remate, rodapé, hemati, DIV/SEP, parede ou sala", () => {
    expect(shouldAttachScaleGizmo({ ...emptySelection, selectedRemateId: "r1", boxEntry: { cadOnly: true } })).toBe(
      false
    );
    expect(shouldAttachScaleGizmo({ ...emptySelection, selectedRodapeId: "p1" })).toBe(false);
    expect(shouldAttachScaleGizmo({ ...emptySelection, selectedHematiId: "h1" })).toBe(false);
    expect(
      shouldAttachScaleGizmo({
        ...emptySelection,
        selectedDivSep: { boxId: "b", kind: "div", itemId: "d1" },
      })
    ).toBe(false);
    expect(shouldAttachScaleGizmo({ ...emptySelection, selectedWallIndex: 0 })).toBe(false);
    expect(shouldAttachScaleGizmo({ ...emptySelection, selectedRoomElementId: "door-1" })).toBe(false);
    expect(shouldAttachScaleGizmo({ ...emptySelection, selectedRoomUtilityId: "util-1" })).toBe(false);
  });

  it("não anexa em grupo nem em peça bloqueada", () => {
    expect(
      shouldAttachScaleGizmo({
        ...emptySelection,
        groupMemberCount: 2,
        boxEntry: { cadOnly: true },
      })
    ).toBe(false);
    expect(
      shouldAttachScaleGizmo({
        ...emptySelection,
        boxEntry: { cadOnly: true, locked: true },
      })
    ).toBe(false);
  });
});
