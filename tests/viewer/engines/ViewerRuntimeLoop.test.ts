import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerRuntimeLoop } from "../../../src/3d/viewer-engine/runtime/ViewerRuntimeLoop";

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    getRenderer: () => ({ setSize: vi.fn() }),
    renderScene: vi.fn(),
    getCamera: () => ({
      position: { x: 0, y: 0, z: 1, distanceTo: () => 1 },
      lookAt: vi.fn(),
    }),
    setCameraAspect: vi.fn(),
    updateCameraProjection: vi.fn(),
    getContainer: () => ({ clientWidth: 100, clientHeight: 80 }),
    ensureMainComposer: vi.fn(),
    getShowcaseComposer: () => null,
    getMainComposer: () => null,
    getBokehPass: () => null,
    updateShowcaseComposerSize: vi.fn(),
    updateMainComposerSize: vi.fn(),
    getCurrentMode: () => "performance" as const,
    isUltraPerformanceMode: () => true,
    isTurntableEnabled: () => false,
    getTurntableSpeed: () => 0,
    getTurntableTarget: () => null,
    getBoxes: () => new Map(),
    onBeforeRenderTick: vi.fn(),
    onAfterRenderTick: vi.fn(),
    ...overrides,
  };
}

describe("ViewerRuntimeLoop (Z-01.2.8 E)", () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  });

  it("um tick corre before → render → after sem WebGL", () => {
    const queue: FrameRequestCallback[] = [];
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();

    const deps = createDeps();
    const loop = new ViewerRuntimeLoop(deps as never);
    expect(loop.isRunning()).toBe(false);
    loop.start();
    expect(loop.isRunning()).toBe(true);
    expect(queue).toHaveLength(1);

    queue.shift()?.(0);
    expect(deps.onBeforeRenderTick).toHaveBeenCalledTimes(1);
    expect(deps.renderScene).toHaveBeenCalledTimes(1);
    expect(deps.onAfterRenderTick).toHaveBeenCalledTimes(1);

    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });
});
