import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SNAP_WALL_THRESHOLD_MM, SnapEngine } from "../../../src/3d/viewer-engine/snapping/SnapEngine";

describe("SnapEngine (Z-01.2.8 D)", () => {
  it("integração da fachada: limiar 250 mm e ordem SmartAlign → constraints", () => {
    expect(SNAP_WALL_THRESHOLD_MM).toBe(250);

    const order: string[] = [];
    const engine = new SnapEngine({
      getAlignEngine: () =>
        ({
          isEnabled: () => true,
          applyDuringTranslate: () => {
            order.push("align");
          },
        }) as never,
      isAlignEnabled: () => true,
      buildAlignContext: () => ({}) as never,
      syncAlignOverlay: vi.fn(),
      getConstraints: () =>
        ({
          clampTransform: () => {
            order.push("constraints");
          },
        }) as never,
    });

    const mesh = new THREE.Object3D();
    mesh.position.set(0.6, 0.36, 0.3);
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
    expect(mesh.position.x * 1000).toBeCloseTo(600);
    expect(mesh.position.y * 1000).toBeCloseTo(360);
    expect(mesh.position.z * 1000).toBeCloseTo(300);
  });
});
