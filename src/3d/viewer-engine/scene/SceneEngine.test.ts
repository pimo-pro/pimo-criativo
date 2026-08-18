import { describe, expect, it, vi } from "vitest";
import { SceneEngine } from "./SceneEngine";
import type { SceneManager } from "./SceneManager";

describe("SceneEngine (Z-01.2.7)", () => {
  it("delega fundo e chão ao SceneManager existente", () => {
    const manager = {
      scene: { uuid: "scene" },
      root: { uuid: "root" },
      add: vi.fn(),
      setBackground: vi.fn(),
      setGroundVisible: vi.fn(),
      getGroundVisible: () => true,
      setGridVisible: vi.fn(),
      getGridVisible: () => false,
    } as unknown as SceneManager;
    const engine = new SceneEngine(manager);

    engine.setBackground("#fff");
    engine.setGroundVisible(false);
    engine.setGridVisible(true);

    expect(engine.scene).toBe(manager.scene);
    expect(manager.setBackground).toHaveBeenCalledWith("#fff");
    expect(manager.setGroundVisible).toHaveBeenCalledWith(false);
    expect(manager.setGridVisible).toHaveBeenCalledWith(true);
  });
});
