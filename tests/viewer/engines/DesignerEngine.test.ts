import { describe, expect, it } from "vitest";
import { DesignerEngine } from "../../../src/3d/viewer-engine/designer/DesignerEngine";

describe("DesignerEngine (Z-01.2.8 D)", () => {
  it("ensure é lazy-init encapsulado: get() começa a null e não reconstrói", () => {
    const engine = new DesignerEngine();
    expect(engine.get()).toBeNull();
    const first = engine.ensure({ getBridge: () => null });
    const second = engine.ensure({ getBridge: () => null });
    expect(first).toBe(second);
    expect(engine.get()).toBe(first);
  });
});
