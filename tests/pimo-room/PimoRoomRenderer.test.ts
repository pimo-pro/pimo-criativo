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

describe("PimoRoomRenderer / createRoomRenderer (M8)", () => {
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

  it("flag off: factory devolve ViewerRoomEngine legado", () => {
    const engine = createRoomRenderer(() => null);
    expect(engine).toBeInstanceOf(ViewerRoomEngine);
    expect(engine).not.toBeInstanceOf(PimoRoomRenderer);
  });

  it("flag on: factory devolve PimoRoomRenderer", () => {
    localStorage.setItem(LS_KEY, "1");
    const engine = createRoomRenderer(() => null);
    expect(engine).toBeInstanceOf(PimoRoomRenderer);
    expect((engine as PimoRoomRenderer).rendererKind).toBe("pimo-room-vnext");
  });

  it("PimoRoomRenderer cumpre IRoomRenderer e delega createRoom", () => {
    localStorage.setItem(LS_KEY, "1");
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
    const legacy = ensureRoomRenderer(null, getManager);
    expect(legacy).toBeInstanceOf(ViewerRoomEngine);
    localStorage.setItem(LS_KEY, "1");
    const vnext = ensureRoomRenderer(legacy, getManager);
    expect(vnext).toBeInstanceOf(PimoRoomRenderer);
    expect(vnext).not.toBe(legacy);
  });
});
