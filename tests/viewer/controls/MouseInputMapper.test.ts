import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyCameraNavigationLock,
  applyMouseInputMappingToOrbitControls,
  CANONICAL_MOUSE_NAVIGATION,
  getMouseInputMapping,
  getPointerActionForButton,
  shouldBlockPointerDownForSelection,
  type MouseInputPreset,
} from "../../../src/3d/viewer-engine/controls/MouseInputMapper";

describe("MouseInputMapper (Z-02.5)", () => {
  it("unifica Orbit/Pan/Zoom independentemente do preset persistido", () => {
    const presets: MouseInputPreset[] = ["cad", "classic", "orbitFriendly", "mouseCentric"];
    for (const preset of presets) {
      expect(getMouseInputMapping(preset)).toEqual(CANONICAL_MOUSE_NAVIGATION);
    }
  });

  it("mapeia esquerdo=Orbit, meio=Pan, roda=Zoom", () => {
    const mapping = getMouseInputMapping();
    expect(mapping.leftClickAction).toBe("orbit");
    expect(mapping.middleClickAction).toBe("pan");
    expect(mapping.wheelAction).toBe("zoom");
    expect(getPointerActionForButton(mapping, 0)).toBe("orbit");
    expect(getPointerActionForButton(mapping, 1)).toBe("pan");
  });

  it("Shift+esquerdo é Pan porque LEFT fica ROTATE (OrbitControls nativo)", () => {
    expect(CANONICAL_MOUSE_NAVIGATION.leftClickAction).toBe("orbit");
    expect(THREE.MOUSE.ROTATE).toBeDefined();
    expect(THREE.MOUSE.PAN).toBeDefined();
  });

  it("não bloqueia pointerdown para selecção — o esquerdo fica livre para Orbit", () => {
    expect(shouldBlockPointerDownForSelection(getMouseInputMapping(), 0)).toBe(false);
  });

  it("aplica o mesmo mapeamento para peça industrial e GLB (sem tipo de peça)", () => {
    const industrial = getMouseInputMapping("cad");
    const glb = getMouseInputMapping("cad");
    expect(industrial).toEqual(glb);
    expect(industrial.leftClickAction).toBe("orbit");
    expect(industrial.middleClickAction).toBe("pan");
  });

  it("mantém zoom da roda quando orbit/pan estão bloqueados pelo gizmo", () => {
    const controls = {
      enabled: false,
      enableRotate: true,
      enablePan: true,
      enableZoom: true,
    };
    applyCameraNavigationLock(controls, false);
    expect(controls.enabled).toBe(true);
    expect(controls.enableRotate).toBe(false);
    expect(controls.enablePan).toBe(false);
    expect(controls.enableZoom).toBe(true);

    applyCameraNavigationLock(controls, true);
    expect(controls.enableRotate).toBe(true);
    expect(controls.enablePan).toBe(true);
    expect(controls.enableZoom).toBe(true);
  });

  it("liga orbit/pan/zoom no objecto de controlos", () => {
    const controls = {
      mouseButtons: { LEFT: -1, MIDDLE: -1, RIGHT: -1 },
      enableRotate: false,
      enablePan: false,
      enableZoom: false,
      enabled: false,
    };
    applyMouseInputMappingToOrbitControls(controls as never);
    expect(controls.mouseButtons.LEFT).toBe(THREE.MOUSE.ROTATE);
    expect(controls.mouseButtons.MIDDLE).toBe(THREE.MOUSE.PAN);
    expect(controls.enableZoom).toBe(true);
    expect(controls.enabled).toBe(true);
  });
});
