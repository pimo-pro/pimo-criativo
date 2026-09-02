/**
 * pimo-room v4 — testes de miters dinâmicos.
 */
import { describe, expect, it } from "vitest";
import { Room } from "../../../src/3d/room/Room";
import { createMainWalls } from "../../../src/3d/room/WallFactory";
import {
  computeWallMiters,
  miterRadFromDirections,
} from "../../../src/3d/room/wallMiters";

describe("wallMiters dinâmicos", () => {
  it("canto a 90° produz miter ≈ π/4", () => {
    const m = miterRadFromDirections({ x: 1, z: 0 }, { x: 0, z: 1 });
    expect(m).toBeCloseTo(Math.PI / 4, 5);
  });

  it("ângulo de 60° entre direcções → half ≈ π/6", () => {
    const m = miterRadFromDirections({ x: 1, z: 0 }, { x: 0.5, z: Math.sqrt(3) / 2 });
    expect(m).toBeCloseTo(Math.PI / 6, 5);
  });

  it("L-shape partilhando endpoint calcula miters nos extremos unidos", () => {
    const walls = [
      { id: "a", start: { x: 0, z: 0 }, end: { x: 4, z: 0 }, thickness: 0.2 },
      { id: "b", start: { x: 4, z: 0 }, end: { x: 4, z: 3 }, thickness: 0.2 },
    ];
    const miters = computeWallMiters(walls, { toleranceM: 0.05 });
    expect(miters.get("a")?.endMiterRad).toBeCloseTo(Math.PI / 4, 4);
    expect(miters.get("b")?.startMiterRad).toBeCloseTo(Math.PI / 4, 4);
    expect(miters.get("a")?.startMiterRad ?? 0).toBe(0);
    expect(miters.get("b")?.endMiterRad ?? 0).toBe(0);
  });

  it("createMainWalls (rectângulo) aplica miters dinâmicos ≈ π/4 nos cantos", () => {
    const room = new Room(4, 3, 2.6);
    const walls = createMainWalls(room, 4, 0.2);
    for (const w of walls) {
      const m = w.userData.wallMiters as { startMiterRad?: number; endMiterRad?: number };
      expect(m.startMiterRad).toBeGreaterThan(0.5);
      expect(m.endMiterRad).toBeGreaterThan(0.5);
      expect(m.startMiterRad).toBeCloseTo(Math.PI / 4, 1);
      expect(m.endMiterRad).toBeCloseTo(Math.PI / 4, 1);
    }
    walls.forEach((w) => {
      w.geometry.dispose();
      const mat = w.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat.dispose();
    });
  });
});
