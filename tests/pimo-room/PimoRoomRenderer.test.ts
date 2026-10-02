import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IRoomRenderer } from "../../src/3d/viewer-engine/room/IRoomRenderer";
import { ViewerRoomEngine } from "../../src/3d/viewer-engine/room/ViewerRoomEngine";
import { createRoomRenderer, ensureRoomRenderer } from "../../src/pimo-room/createRoomRenderer";
import { PimoRoomRenderer } from "../../src/pimo-room/PimoRoomRenderer";

const LS_KEY = "pimo.features.roomEngineVNext";

function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    },
  });
}

describe("PimoRoomRenderer / createRoomRenderer (M8 — activação)", () => {
  beforeEach(() => {
    installLocalStoragePolyfill();
    localStorage.removeItem(LS_KEY);
  });

  afterEach(() => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  });

  it("default (flag on): factory devolve PimoRoomRenderer", () => {
    const engine = createRoomRenderer(() => null);
    expect(engine).toBeInstanceOf(PimoRoomRenderer);
    expect((engine as PimoRoomRenderer).rendererKind).toBe("pimo-room-vnext");
  });

  it("flag off: factory devolve ViewerRoomEngine legado", () => {
    localStorage.setItem(LS_KEY, "0");
    const engine = createRoomRenderer(() => null);
    expect(engine).toBeInstanceOf(ViewerRoomEngine);
    expect(engine).not.toBeInstanceOf(PimoRoomRenderer);
  });

  it("PimoRoomRenderer cumpre IRoomRenderer e delega createRoom", () => {
    const createRoom = vi.fn();
    const engine: IRoomRenderer = createRoomRenderer(() => ({
      createRoom,
      room: { width: 4, depth: 3, height: 2.6 },
    }));
    engine.createRoomWithDimensions(4, 3, 2.6, 4);
    expect(createRoom).toHaveBeenCalledWith(4, 3, 2.6, 4, undefined);
  });

  it("ensureRoomRenderer troca de instância se a flag mudar", () => {
    const getManager = () => null;
    const vnext = ensureRoomRenderer(null, getManager);
    expect(vnext).toBeInstanceOf(PimoRoomRenderer);
    localStorage.setItem(LS_KEY, "0");
    const legacy = ensureRoomRenderer(vnext, getManager);
    expect(legacy).toBeInstanceOf(ViewerRoomEngine);
    expect(legacy).not.toBeInstanceOf(PimoRoomRenderer);
    expect(legacy).not.toBe(vnext);
  });
});
