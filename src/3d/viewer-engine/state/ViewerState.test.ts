import { describe, expect, it } from "vitest";
import { ViewerState } from "./ViewerState";

describe("ViewerState (Z-01.2.7 E)", () => {
  it("guarda selecção e modo de render sem efeitos na cena", () => {
    const state = new ViewerState();
    expect(state.getSelectedBox()).toBeNull();
    state.setSelectedBox("box-1");
    expect(state.getSelectedBox()).toBe("box-1");
    state.setCurrentMode("showcase");
    expect(state.getCurrentMode()).toBe("showcase");
  });
});
