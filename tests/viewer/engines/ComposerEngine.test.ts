import { describe, expect, it } from "vitest";
import { ComposerEngine } from "../../../src/3d/viewer-engine/lighting/ComposerEngine";

describe("ComposerEngine (Z-01.2.8 A)", () => {
  it("performance não cria bloom/bokeh; dispose é seguro sem WebGL", () => {
    const engine = new ComposerEngine({
      getRenderer: () => {
        throw new Error("não deve criar EffectComposer em performance");
      },
      getScene: () => {
        throw new Error("scene");
      },
      getCamera: () => {
        throw new Error("camera");
      },
      getContainer: () => null,
    });

    engine.setMode("performance");
    expect(engine.showcase).toBeNull();
    expect(engine.bloom).toBeNull();
    expect(engine.bokeh).toBeNull();
    expect(engine.main).toBeNull();
    engine.dispose();
    expect(engine.showcase).toBeNull();
  });
});
