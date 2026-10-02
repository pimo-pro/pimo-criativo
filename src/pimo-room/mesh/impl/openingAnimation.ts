/**
 * pimo-room v4 — animação open/close de folhas de porta/janela.
 */
import type * as THREE from "three";

export type OpeningAnimState = {
  raf: number | null;
  targetOpen: boolean;
};

const animByGroup = new WeakMap<THREE.Object3D, OpeningAnimState>();

/**
 * Anima `leafPivot.rotation.y` (ou `leafPivot.position.x` para correr) até aberto/fechado.
 */
export function animateOpeningLeaf(
  group: THREE.Object3D,
  opts: {
    mode: "swing" | "slide";
    open: boolean;
    openAngleRad?: number;
    slideDistanceM?: number;
    durationMs?: number;
  }
): void {
  const leaf = group.userData.leafPivot as THREE.Object3D | undefined;
  if (!leaf) {
    group.userData.isOpen = opts.open;
    return;
  }
  const duration = Math.max(80, opts.durationMs ?? 280);
  const openAngle = opts.openAngleRad ?? -Math.PI / 2;
  const slide = opts.slideDistanceM ?? 0.4;

  const from =
    opts.mode === "swing"
      ? leaf.rotation.y
      : leaf.position.x;
  const to =
    opts.mode === "swing" ? (opts.open ? openAngle : 0) : opts.open ? slide : 0;

  const prev = animByGroup.get(group);
  if (prev?.raf != null) cancelAnimationFrame(prev.raf);

  const started = performance.now();
  const state: OpeningAnimState = { raf: null, targetOpen: opts.open };
  animByGroup.set(group, state);

  const step = (now: number) => {
    const t = Math.min(1, (now - started) / duration);
    const eased = t * (2 - t); // ease-out
    const v = from + (to - from) * eased;
    if (opts.mode === "swing") leaf.rotation.y = v;
    else leaf.position.x = v;
    if (t < 1) {
      state.raf = requestAnimationFrame(step);
    } else {
      state.raf = null;
      group.userData.isOpen = opts.open;
    }
  };
  state.raf = requestAnimationFrame(step);
}

export function setOpeningOpenInstant(
  group: THREE.Object3D,
  open: boolean,
  mode: "swing" | "slide",
  openAngleRad = -Math.PI / 2,
  slideDistanceM = 0.4
): void {
  const leaf = group.userData.leafPivot as THREE.Object3D | undefined;
  group.userData.isOpen = open;
  if (!leaf) return;
  if (mode === "swing") leaf.rotation.y = open ? openAngleRad : 0;
  else leaf.position.x = open ? slideDistanceM : 0;
}
