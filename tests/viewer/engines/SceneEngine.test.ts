import { describe, expect, it, vi } from "vitest";
import { SceneEngine } from "../../../src/3d/viewer-engine/scene/SceneEngine";
import type { SceneManager } from "../../../src/3d/viewer-engine/scene/SceneManager";

describe("SceneEngine (Z-01.2.8 A)", () => {
  it("envolve o SceneManager existente e não cria uma segunda cena", () => {
    const scene = { uuid: "scene-1" };
    const manager = {
      scene,
      root: { uuid: "root-1" },
      add: vi.fn(),
      setBackground: vi.fn(),
      setGroundVisible: vi.fn(),
      getGroundVisible: () => true,
      setGridVisible: vi.fn(),
      getGridVisible: () => false,
    } as unknown as SceneManager;
    const engine = new SceneEngine(manager);

    engine.add({ name: "room" } as never);
    engine.setBackground("#0f172a");

    expect(engine.scene).toBe(scene);
    expect(engine.manager).toBe(manager);
    expect(manager.add).toHaveBeenCalledTimes(1);
    expect(manager.setBackground).toHaveBeenCalledWith("#0f172a");
  });
});
