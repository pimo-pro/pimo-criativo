import * as THREE from "three";
import { runWithAllLayoutBoundsProxiesVisible } from "../box/boxAabbUtils";
import type { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import type { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";

/**
 * Contrato do loop de runtime/render.
 * Ordem por frame: onBeforeRenderTick() -> renderOneFrame() -> onAfterRenderTick?().
 * Invariantes:
 * - O core fornece callbacks sem efeitos colaterais irreversíveis por frame.
 * - ensureMainComposer/getMainComposer e getShowcaseComposer refletem o estado real do pipeline.
 * - onResize() ajusta renderer/camera/composers; o módulo não observa DOM por conta própria.
 */
type ViewerRuntimeLoopDeps = {
  getRenderer: () => THREE.WebGLRenderer;
  renderScene: () => void;
  getCamera: () => THREE.PerspectiveCamera;
  setCameraAspect: (_aspect: number) => void;
  updateCameraProjection: () => void;
  getContainer: () => HTMLElement;
  ensureMainComposer: () => void;
  getShowcaseComposer: () => EffectComposer | null;
  getMainComposer: () => EffectComposer | null;
  getBokehPass: () => BokehPass | null;
  updateShowcaseComposerSize: () => void;
  updateMainComposerSize: () => void;
  getCurrentMode: () => "performance" | "showcase";
  isUltraPerformanceMode: () => boolean;
  isTurntableEnabled: () => boolean;
  getTurntableSpeed: () => number;
  getTurntableTarget: () => THREE.Vector3 | null;
  getBoxes: () => Map<string, { mesh: THREE.Object3D }>;
  onBeforeRenderTick: () => void;
  onAfterRenderTick?: () => void;
};

/** Responsável apenas pela cadência de frame e seleção do pipeline de render. */
export class ViewerRuntimeLoop {
  private readonly deps: ViewerRuntimeLoopDeps;
  private rafId: number | null = null;
  private initialCanvasSizeDone = false;
  private readonly boundingBox = new THREE.Box3();
  private readonly center = new THREE.Vector3();

  constructor(deps: ViewerRuntimeLoopDeps) {
    this.deps = deps;
  }

  start(): void {
    if (this.rafId !== null) return;
    const animate = () => {
      if (!this.initialCanvasSizeDone) {
        this.onResize();
        this.initialCanvasSizeDone = true;
      }
      this.deps.onBeforeRenderTick();
      this.renderOneFrame();
      this.deps.onAfterRenderTick?.();
      this.rafId = requestAnimationFrame(animate);
    };
    this.rafId = requestAnimationFrame(animate);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  requestRender(): void {
    if (this.rafId == null) return;
    requestAnimationFrame(() => this.renderOneFrame());
  }

  renderOneFrame(): void {
    const mode = this.deps.getCurrentMode();
    const composer = this.deps.getShowcaseComposer();
    const bokeh = this.deps.getBokehPass();
    if (mode === "showcase" && composer && bokeh) {
      const boxEntries = this.deps.getBoxes();
      const roots = Array.from(boxEntries.values()).map((e) => e.mesh);
      runWithAllLayoutBoundsProxiesVisible(roots, () => {
        this.boundingBox.makeEmpty();
        boxEntries.forEach((entry) => {
          this.boundingBox.expandByObject(entry.mesh);
        });
      });
      this.boundingBox.getCenter(this.center);
      const cam = this.deps.getCamera();
      const focusDist = cam.position.distanceTo(this.center);
      (bokeh as unknown as { uniforms: Record<string, { value: number }> }).uniforms["focus"].value = focusDist;

      if (this.deps.isTurntableEnabled()) {
        const target = this.deps.getTurntableTarget();
        if (target) {
          const dx = cam.position.x - target.x;
          const dz = cam.position.z - target.z;
          const angle = this.deps.getTurntableSpeed() * 0.01;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          cam.position.x = target.x + dx * cos - dz * sin;
          cam.position.z = target.z + dx * sin + dz * cos;
          cam.lookAt(target);
        }
      }
      composer.render();
      return;
    }

    if (!this.deps.isUltraPerformanceMode()) {
      this.deps.ensureMainComposer();
      const main = this.deps.getMainComposer();
      if (main) {
        main.render();
      } else {
        this.deps.renderScene();
      }
      return;
    }
    this.deps.renderScene();
  }

  onResize(): void {
    const container = this.deps.getContainer();
    const w = container.clientWidth ?? 1;
    const h = container.clientHeight ?? 1;
    this.deps.getRenderer().setSize(w, h);
    this.deps.setCameraAspect(w / h);
    this.deps.updateCameraProjection();
    this.deps.updateShowcaseComposerSize();
    this.deps.updateMainComposerSize();
  }

  isRunning(): boolean {
    return this.rafId !== null;
  }
}
