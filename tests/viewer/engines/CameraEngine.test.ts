import { describe, expect, it, vi } from "vitest";
import {
  CameraEngine,
  computeCameraPresetPosition,
} from "../../../src/3d/viewer-engine/camera/CameraEngine";
import type { CameraManager } from "../../../src/3d/viewer-engine/camera/CameraManager";

describe("CameraEngine (Z-01.2.8 B)", () => {
  it("aplica preset frontal em metros (domínio mm = * 1000)", () => {
    const setTarget = vi.fn();
    const setPosition = vi.fn();
    const engine = new CameraEngine({ setTarget, setPosition } as unknown as CameraManager);
    const orbit = { set: vi.fn() };
    const distM = 2.5;

    engine.applyPreset("front", { x: 0.6, y: 0.36, z: 0.3 }, distM, orbit);

    const expected = computeCameraPresetPosition({ x: 0.6, y: 0.36, z: 0.3 }, distM, "front");
    expect(setPosition).toHaveBeenCalledWith(expected.x, expected.y, expected.z);
    expect(expected.z * 1000).toBeCloseTo(2800);
    expect(engine.preset).toBe("front");
    expect(orbit.set).toHaveBeenCalledWith(0.6, 0.36, 0.3);
  });
});
