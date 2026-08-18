import { describe, expect, it } from "vitest";
import { DesignerEngine } from "./DesignerEngine";

describe("DesignerEngine (Z-01.2.7)", () => {
  it("ensure devolve a mesma instância e get() começa a null", () => {
    const engine = new DesignerEngine();
    expect(engine.get()).toBeNull();
    const deps = { getBridge: () => null };
    const first = engine.ensure(deps);
    const second = engine.ensure(deps);
    expect(first).toBe(second);
    expect(engine.get()).toBe(first);
  });
});
