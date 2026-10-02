import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  areRoomFloorCeilingEnabled,
  areRoomOpeningsVisualEnabled,
} from "../../src/pimo-room/roomVisualGate";

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

describe("roomVisualGate (M6 — activação vNext)", () => {
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

  it("default: openings e piso/tecto activos", () => {
    expect(areRoomOpeningsVisualEnabled()).toBe(true);
    expect(areRoomFloorCeilingEnabled()).toBe(true);
  });

  it("flag on: openings e piso/tecto continuam activos", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(areRoomOpeningsVisualEnabled()).toBe(true);
    expect(areRoomFloorCeilingEnabled()).toBe(true);
  });
});
