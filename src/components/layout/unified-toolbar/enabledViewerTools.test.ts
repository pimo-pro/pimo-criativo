import { describe, expect, it } from "vitest";
import { resolveEnabledViewerTools } from "./enabledViewerTools";

describe("resolveEnabledViewerTools (Z-02.2)", () => {
  it("expõe só select/move/rotate em elementos industriais", () => {
    expect(
      resolveEnabledViewerTools({
        pieceLocked: false,
        remateSelected: false,
        nonIndustrialScalable: false,
      })
    ).toEqual(["select", "move", "rotate"]);
  });

  it("inclui scale em GLB / cadOnly", () => {
    expect(
      resolveEnabledViewerTools({
        pieceLocked: false,
        remateSelected: false,
        nonIndustrialScalable: true,
      })
    ).toEqual(["select", "move", "rotate", "scale"]);
  });

  it("não inclui scale com remate seleccionado", () => {
    expect(
      resolveEnabledViewerTools({
        pieceLocked: false,
        remateSelected: true,
        nonIndustrialScalable: true,
      })
    ).toEqual(["select", "move", "rotate"]);
  });

  it("só select se peça industrial bloqueada", () => {
    expect(
      resolveEnabledViewerTools({
        pieceLocked: true,
        remateSelected: false,
        nonIndustrialScalable: true,
      })
    ).toEqual(["select"]);
  });

  it("nunca inclui orbit/pan — navegação é do rato (Z-02.5)", () => {
    const cases = [
      { pieceLocked: false, remateSelected: false, nonIndustrialScalable: false },
      { pieceLocked: false, remateSelected: false, nonIndustrialScalable: true },
      { pieceLocked: true, remateSelected: false, nonIndustrialScalable: false },
      { pieceLocked: false, remateSelected: true, nonIndustrialScalable: true },
    ];
    for (const input of cases) {
      const tools = resolveEnabledViewerTools(input);
      expect(tools).not.toContain("orbit");
      expect(tools).not.toContain("pan");
    }
  });
});
