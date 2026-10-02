import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isRoomWallSnapEnabled } from "../../src/pimo-room/wallSnapGate";

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

describe("wallSnapGate (M5)", () => {
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

  it("default (flag off): snap de parede activo", () => {
    expect(isRoomWallSnapEnabled()).toBe(true);
  });

  it("flag on: snap de parede desligado", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(isRoomWallSnapEnabled()).toBe(false);
  });
});
