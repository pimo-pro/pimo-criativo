import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SNAP_THRESHOLD } from "../../snapping/ModelWallSnap";
import { SNAP_WALL_THRESHOLD_MM, SnapEngine } from "./SnapEngine";

describe("SnapEngine (Z-01.2.3)", () => {
  it("limiar de parede é 250 mm (D-10)", () => {
    expect(SNAP_WALL_THRESHOLD_MM).toBe(250);
    expect(SNAP_THRESHOLD * 1000).toBe(250);
  });

  it("pipeline de caixa: SmartAlign depois TransformConstraints; nunca SmartSnapping.applyDuringTranslate", () => {
    const order: string[] = [];
    const applyDuringTranslate = vi.fn(() => {
      order.push("align");
    });
    const clampTransform = vi.fn(() => {
      order.push("constraints");
    });
    const smartSnappingApply = vi.fn();

    const engine = new SnapEngine({
      getAlignEngine: () =>
        ({
          isEnabled: () => true,
          applyDuringTranslate,
        }) as never,
      isAlignEnabled: () => true,
      buildAlignContext: () => ({}) as never,
      syncAlignOverlay: vi.fn(),
      getConstraints: () => ({ clampTransform }) as never,
    });

    const mesh = new THREE.Object3D();
    mesh.position.set(0.6, 0, 0.3);
    const beforeMm = {
      x: mesh.position.x * 1000,
      y: mesh.position.y * 1000,
      z: mesh.position.z * 1000,
    };

    engine.applyBoxTranslatePipeline({
      align: {
        mesh,
        entity: { kind: "box", id: "box-1" },
        isDragging: true,
        currentTool: "translate",
      },
      clampCtx: {} as never,
    });

    expect(order).toEqual(["align", "constraints"]);
    expect(applyDuringTranslate).toHaveBeenCalledTimes(1);
    expect(clampTransform).toHaveBeenCalledTimes(1);
    expect(smartSnappingApply).not.toHaveBeenCalled();
    expect(mesh.position.x * 1000).toBeCloseTo(beforeMm.x, 6);
    expect(mesh.position.y * 1000).toBeCloseTo(beforeMm.y, 6);
    expect(mesh.position.z * 1000).toBeCloseTo(beforeMm.z, 6);
  });

  it("com alinhamento desligado só corre TransformConstraints", () => {
    const applyDuringTranslate = vi.fn();
    const clampTransform = vi.fn();
    const engine = new SnapEngine({
      getAlignEngine: () =>
        ({
          isEnabled: () => true,
          applyDuringTranslate,
        }) as never,
      isAlignEnabled: () => false,
      buildAlignContext: () => ({}) as never,
      syncAlignOverlay: vi.fn(),
      getConstraints: () => ({ clampTransform }) as never,
    });

    engine.applyBoxTranslatePipeline({
      align: {
        mesh: new THREE.Object3D(),
        entity: { kind: "box", id: "box-1" },
        isDragging: true,
        currentTool: "translate",
      },
      clampCtx: {} as never,
    });

    expect(applyDuringTranslate).not.toHaveBeenCalled();
    expect(clampTransform).toHaveBeenCalledTimes(1);
  });
});
