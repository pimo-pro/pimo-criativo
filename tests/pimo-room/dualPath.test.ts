import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultProjectRoom } from "../../src/3d/viewer-engine/room/RoomEngine";
import {
  projectRoomFromRoomState,
  roomStateFromProjectRoom,
} from "../../src/pimo-room/dualPath";

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

describe("pimo-room dualPath (M3)", () => {
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

  it("flag off: round-trip preserva footprint", () => {
    localStorage.setItem(LS_KEY, "0");
    const room = createDefaultProjectRoom();
    const state = roomStateFromProjectRoom(room);
    const back = projectRoomFromRoomState(state);
    expect(back.widthMm).toBe(room.widthMm);
    expect(back.depthMm).toBe(room.depthMm);
    expect(back.walls.length).toBeGreaterThanOrEqual(4);
  });

  it("flag on (default): round-trip equivalente via domínio", () => {
    localStorage.removeItem(LS_KEY);
    const room = createDefaultProjectRoom();
    const state = roomStateFromProjectRoom(room);
    const back = projectRoomFromRoomState(state);
    expect(back.widthMm).toBe(room.widthMm);
    expect(back.depthMm).toBe(room.depthMm);
    expect(back.walls.length).toBeGreaterThanOrEqual(4);
  });
});
