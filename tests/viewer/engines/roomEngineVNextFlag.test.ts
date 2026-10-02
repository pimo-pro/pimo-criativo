import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  features,
  isRoomEngineVNextEnabled,
} from "../../../src/core/features";

const LS_KEY = "pimo.features.roomEngineVNext";

/** Polyfill mínimo — vitest corre em environment node. */
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

describe("roomEngineVNext flag (activação)", () => {
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

  it("default é true (motor vNext activo)", () => {
    expect(features.roomEngineVNext).toBe(true);
    expect(isRoomEngineVNextEnabled()).toBe(true);
  });

  it("override localStorage 1 mantém a flag activa", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(isRoomEngineVNextEnabled()).toBe(true);
  });

  it("override localStorage 0 força off (legado)", () => {
    localStorage.setItem(LS_KEY, "0");
    expect(isRoomEngineVNextEnabled()).toBe(false);
  });
});
