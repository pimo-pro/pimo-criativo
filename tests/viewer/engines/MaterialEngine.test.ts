import { afterEach, describe, expect, it } from "vitest";
import {
  getMaterialMode,
  setMaterialMode,
} from "../../../src/3d/viewer-engine/materials/MaterialEngine";

describe("MaterialEngine (Z-01.2.8 C)", () => {
  afterEach(() => {
    setMaterialMode("performance");
  });

  it("o modo por omissão é performance e o sync não gera malha", () => {
    expect(getMaterialMode()).toBe("performance");
    setMaterialMode("showcase");
    expect(getMaterialMode()).toBe("showcase");
    setMaterialMode("performance");
    expect(getMaterialMode()).toBe("performance");
  });
});
