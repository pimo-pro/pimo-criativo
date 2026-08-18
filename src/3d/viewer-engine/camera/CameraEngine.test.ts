import { describe, expect, it } from "vitest";
import { computeCameraPresetPosition } from "./CameraEngine";

describe("CameraEngine (Z-01.2.7)", () => {
  it("frente olha de +Z e topo de +Y", () => {
    const center = { x: 1, y: 2, z: 3 };
    expect(computeCameraPresetPosition(center, 4, "front")).toEqual({ x: 1, y: 2, z: 7 });
    expect(computeCameraPresetPosition(center, 4, "top")).toEqual({ x: 1, y: 6, z: 3 });
    expect(computeCameraPresetPosition(center, 4, "left")).toEqual({ x: -3, y: 2, z: 3 });
  });

  it("isométrico mantém o centro como origem da diagonal", () => {
    const pos = computeCameraPresetPosition({ x: 0, y: 0, z: 0 }, 10, "isometric");
    expect(pos.x).toBeCloseTo(9);
    expect(pos.y).toBeCloseTo(7.2);
    expect(pos.z).toBeCloseTo(9);
  });
});
