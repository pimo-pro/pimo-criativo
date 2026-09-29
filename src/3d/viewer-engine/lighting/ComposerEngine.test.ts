import { describe, expect, it } from "vitest";
import { ComposerEngine } from "./ComposerEngine";

describe("ComposerEngine (Z-01.2.7)", () => {
  it("setMode(performance) não cria composer sem renderer", () => {
    const engine = new ComposerEngine({
      getRenderer: () => {
        throw new Error("não deve criar pipeline em performance");
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
    expect(engine.main).toBeNull();
  });

  it("nível inicial baixo não cria composer nem FXAA", () => {
    const engine = new ComposerEngine({
      getRenderer: () => {
        throw new Error("não deve criar pipeline no nível inicial baixo");
      },
      getScene: () => {
        throw new Error("scene");
      },
      getCamera: () => {
        throw new Error("camera");
      },
      getContainer: () => null,
    });
    expect(engine.ensureMain()).toBeNull();
    expect(engine.main).toBeNull();
    expect(engine.mainFxaa).toBeNull();
  });

  it("dispose é idempotente", () => {
    const engine = new ComposerEngine({
      getRenderer: () => null as never,
      getScene: () => null as never,
      getCamera: () => null as never,
      getContainer: () => null,
    });
    engine.dispose();
    engine.dispose();
    expect(engine.showcase).toBeNull();
  });
});
