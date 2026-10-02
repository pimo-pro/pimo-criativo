import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActivePimoViewerApi,
  getActiveViewerCore,
  setActivePimoViewerApi,
  setActiveViewerCore,
} from "./pimoViewerRuntime";
import { getPimoViewerStubApi } from "../../context/pimoViewerStubApi";
import {
  RoomEngineBoundary,
  getRoomEngineViewerApi,
  getRoomEngineViewerHost,
  getRoomViewerApi,
  getRoomViewerCore,
  setRoomViewerCore,
  type RoomEngineViewerApi,
  type RoomEngineViewerHost,
} from "../../pimo-room/domain";

afterEach(() => {
  RoomEngineBoundary.viewer.setHost(null);
  RoomEngineBoundary.viewer.setFallback(null);
  setActiveViewerCore(null);
  setActivePimoViewerApi(null);
  vi.unstubAllGlobals();
});

describe("pimoViewerRuntime (Z-01.2.6)", () => {
  it("guarda e limpa a instância activa do ViewerCore", () => {
    const core = { viewerReady: true, addBox: () => false } as ReturnType<typeof getActiveViewerCore>;
    setActiveViewerCore(core);
    expect(getActiveViewerCore()).toBe(core);
    setActiveViewerCore(null);
    expect(getActiveViewerCore()).toBeNull();
  });

  it("sincroniza a ponte global de compatibilidade", () => {
    const compatWindow = {} as Window;
    vi.stubGlobal("window", compatWindow);
    const core = {
      viewerReady: true,
      addBox: () => false,
    } as ReturnType<typeof getActiveViewerCore>;

    setActiveViewerCore(core);
    expect(window.viewerCore).toBe(core);

    setActiveViewerCore(null);
    expect(window.viewerCore).toBeUndefined();
  });

  it("RoomEngine host prefere injeção e preserva aliases compatíveis", () => {
    const active = {
      viewerReady: true,
      addBox: () => false,
    } as ReturnType<typeof getActiveViewerCore>;
    const injected = {
      viewerReady: true,
      addBox: () => true,
    } as ReturnType<typeof getActiveViewerCore>;

    RoomEngineBoundary.viewer.setFallback({
      getHost: () =>
        getActiveViewerCore() as unknown as RoomEngineViewerHost | null,
      getApi: () =>
        (getActivePimoViewerApi() ??
          getActiveViewerCore()) as unknown as RoomEngineViewerApi | null,
    });

    setActiveViewerCore(active);
    expect(getRoomEngineViewerHost()).toBe(active);
    expect(getRoomViewerCore()).toBe(active);

    RoomEngineBoundary.viewer.setHost(injected);
    expect(getRoomEngineViewerHost()).toBe(injected);
    expect(getRoomEngineViewerApi()).toBe(injected);
    expect(getRoomViewerCore()).toBe(injected);
    expect(getRoomViewerApi()).toBe(injected);

    setRoomViewerCore(null);
    expect(getRoomEngineViewerHost()).toBe(active);
    expect(getRoomViewerCore()).toBe(active);
  });

  it("guarda e limpa a PimoViewerApi activa", () => {
    const api = getPimoViewerStubApi();
    setActivePimoViewerApi(api);
    expect(getActivePimoViewerApi()).toBe(api);
    setActivePimoViewerApi(null);
    expect(getActivePimoViewerApi()).toBeNull();
  });
});
