import { describe, expect, it } from "vitest";
import {
  getActivePimoViewerApi,
  getActiveViewerCore,
  setActivePimoViewerApi,
  setActiveViewerCore,
} from "./pimoViewerRuntime";
import { getPimoViewerStubApi } from "../../context/pimoViewerStubApi";

describe("pimoViewerRuntime (Z-01.2.6)", () => {
  it("guarda e limpa a instância activa do ViewerCore", () => {
    const core = { viewerReady: true, addBox: () => false } as ReturnType<typeof getActiveViewerCore>;
    setActiveViewerCore(core);
    expect(getActiveViewerCore()).toBe(core);
    setActiveViewerCore(null);
    expect(getActiveViewerCore()).toBeNull();
  });

  it("guarda e limpa a PimoViewerApi activa", () => {
    const api = getPimoViewerStubApi();
    setActivePimoViewerApi(api);
    expect(getActivePimoViewerApi()).toBe(api);
    setActivePimoViewerApi(null);
    expect(getActivePimoViewerApi()).toBeNull();
  });
});
