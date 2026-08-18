import { describe, expect, it } from "vitest";
import { isCadOnlyWorkspaceBox } from "./isCadOnlyWorkspaceBox";

describe("isCadOnlyWorkspaceBox", () => {
  it("é verdadeiro para GLB sem prateleiras nem gavetas e sem Base PI", () => {
    expect(
      isCadOnlyWorkspaceBox({
        models: [{ id: "m1" }],
        prateleiras: 0,
        gavetas: 0,
      })
    ).toBe(true);
  });

  it("é falso para caixa industrial (sem modelos)", () => {
    expect(
      isCadOnlyWorkspaceBox({
        models: [],
        prateleiras: 0,
        gavetas: 0,
      })
    ).toBe(false);
  });

  it("é falso para Base PI mesmo com modelos", () => {
    expect(
      isCadOnlyWorkspaceBox({
        baseCabinetId: "pi-base-600",
        models: [{ id: "m1" }],
        prateleiras: 0,
        gavetas: 0,
      })
    ).toBe(false);
  });

  it("é falso quando há prateleiras ou gavetas", () => {
    expect(
      isCadOnlyWorkspaceBox({
        models: [{ id: "m1" }],
        prateleiras: 1,
        gavetas: 0,
      })
    ).toBe(false);
    expect(
      isCadOnlyWorkspaceBox({
        models: [{ id: "m1" }],
        prateleiras: 0,
        gavetas: 2,
      })
    ).toBe(false);
  });
});
