import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  areRoomAdvancedHostsEnabled,
  gatedSyncLevelGhosts,
} from "../../src/pimo-room/advancedHostsGate";
import { createEmptyRoomState } from "../../src/pimo-room/domain/RoomState";

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

describe("advancedHostsGate (M4 — activação vNext)", () => {
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

  it("default: hosts avançados activos", () => {
    expect(areRoomAdvancedHostsEnabled()).toBe(true);
  });

  it("flag on: hosts avançados continuam activos", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(areRoomAdvancedHostsEnabled()).toBe(true);
  });

  it("gatedSyncLevelGhosts não lança com flag on", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(() => gatedSyncLevelGhosts(createEmptyRoomState())).not.toThrow();
  });
});
