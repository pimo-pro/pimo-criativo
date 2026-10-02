import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  areRoomAdvancedHostsEnabled,
  gatedSyncLevelGhosts,
} from "../../src/pimo-room/advancedHostsGate";
import { createEmptyRoomState } from "../../src/pimo-room-v4/RoomState";

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

describe("advancedHostsGate (M4)", () => {
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

  it("default (flag off): hosts avançados activos", () => {
    expect(areRoomAdvancedHostsEnabled()).toBe(true);
  });

  it("flag on: hosts avançados desligados", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(areRoomAdvancedHostsEnabled()).toBe(false);
  });

  it("gatedSyncLevelGhosts não lança com flag on (no-op)", () => {
    localStorage.setItem(LS_KEY, "1");
    expect(() => gatedSyncLevelGhosts(createEmptyRoomState())).not.toThrow();
  });
});
