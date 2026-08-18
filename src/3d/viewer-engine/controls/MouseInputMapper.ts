import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type MouseButtonAction = "orbit" | "pan" | "zoom" | "select" | "contextMenu";

export type MouseInputMapping = {
  leftClickAction: MouseButtonAction;
  rightClickAction: MouseButtonAction;
  middleClickAction: MouseButtonAction;
  wheelAction: "zoom";
};

/** Presets persistidos em viewerSettings. A navegação canónica ignora-os (Z-02.5). */
export type MouseInputPreset = "cad" | "classic" | "orbitFriendly" | "mouseCentric";

const DISABLED_MOUSE = -1 as THREE.MOUSE;

/**
 * Navegação única do Viewer:
 * - botão esquerdo → Orbit
 * - botão do meio → Pan
 * - Shift + esquerdo → Pan (nativo do OrbitControls quando LEFT = ROTATE)
 * - roda → Zoom
 * Independente de enabledTools, tipo de peça e modo (gizmo/sala/showcase/photo).
 */
export const CANONICAL_MOUSE_NAVIGATION: MouseInputMapping = {
  leftClickAction: "orbit",
  rightClickAction: "contextMenu",
  middleClickAction: "pan",
  wheelAction: "zoom",
};

export function normalizeMouseInputPreset(preset: string): MouseInputPreset {
  if (preset === "orbitFriendly" || preset === "mouseCentric") return preset;
  if (preset === "classic" || preset === "orbital") return "classic";
  return "cad";
}

export function getMouseInputMapping(_preset?: MouseInputPreset): MouseInputMapping {
  return { ...CANONICAL_MOUSE_NAVIGATION };
}

function actionToOrbitMouse(action: MouseButtonAction): THREE.MOUSE | typeof DISABLED_MOUSE {
  switch (action) {
    case "orbit":
      return THREE.MOUSE.ROTATE;
    case "pan":
      return THREE.MOUSE.PAN;
    case "zoom":
      return THREE.MOUSE.DOLLY;
    case "select":
    case "contextMenu":
      return DISABLED_MOUSE;
    default:
      return DISABLED_MOUSE;
  }
}

export type CameraNavigationLockTarget = {
  enabled: boolean;
  enableRotate: boolean;
  enablePan: boolean;
  enableZoom: boolean;
};

/**
 * Durante o arrasto de um gizmo, desliga só orbit/pan.
 * O zoom da roda permanece sempre activo.
 */
export function applyCameraNavigationLock(
  controls: CameraNavigationLockTarget,
  orbitPanEnabled: boolean
): void {
  controls.enabled = true;
  controls.enableRotate = orbitPanEnabled;
  controls.enablePan = orbitPanEnabled;
  controls.enableZoom = true;
}

export function applyMouseInputMappingToOrbitControls(
  controls: OrbitControls,
  mapping: MouseInputMapping = CANONICAL_MOUSE_NAVIGATION
): void {
  controls.mouseButtons.LEFT = actionToOrbitMouse(mapping.leftClickAction);
  controls.mouseButtons.MIDDLE = actionToOrbitMouse(mapping.middleClickAction);
  controls.mouseButtons.RIGHT = actionToOrbitMouse(mapping.rightClickAction);
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enabled = true;
}

export function getPointerActionForButton(
  mapping: MouseInputMapping,
  button: number
): MouseButtonAction | null {
  if (button === 0) return mapping.leftClickAction;
  if (button === 1) return mapping.middleClickAction;
  if (button === 2) return mapping.rightClickAction;
  return null;
}

/** A selecção faz-se no clique; o pointerdown esquerdo não bloqueia o Orbit. */
export function shouldBlockPointerDownForSelection(
  _mapping: MouseInputMapping,
  _button: number
): boolean {
  return false;
}
