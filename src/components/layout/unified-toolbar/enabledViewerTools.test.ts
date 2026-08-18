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
});
