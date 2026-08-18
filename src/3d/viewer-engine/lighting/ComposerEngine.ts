/**
 * ComposerEngine (Z-01.2.7 A) — pipelines EffectComposer (performance vs showcase).
 * Dois composers internos até unificação GPU futura.
 */
import * as THREE from "three";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";

export type ComposerEngineMode = "performance" | "showcase" | "ultra";

export type ComposerEngineDeps = {
  getRenderer: () => THREE.WebGLRenderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.PerspectiveCamera;
  getContainer: () => HTMLElement | null;
};

export class ComposerEngine {
  showcase: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  bokeh: BokehPass | null = null;
  main: EffectComposer | null = null;
  mainBloom: UnrealBloomPass | null = null;
  private readonly deps: ComposerEngineDeps;

  constructor(deps: ComposerEngineDeps) {
    this.deps = deps;
  }

  static ensure(current: ComposerEngine | null, deps: ComposerEngineDeps): ComposerEngine {
    return current ?? new ComposerEngine(deps);
  }

  setMode(mode: ComposerEngineMode): void {
    if (mode === "showcase") {
      this.ensureShowcase();
      return;
    }
    this.disposeShowcase();
  }

  ensureShowcase(): EffectComposer | null {
    if (this.showcase) return this.showcase;
    const container = this.deps.getContainer();
    const renderer = this.deps.getRenderer();
    const scene = this.deps.getScene();
    const camera = this.deps.getCamera();
    const w = container?.clientWidth ?? 1;
    const h = container?.clientHeight ?? 1;

    this.showcase = new EffectComposer(renderer);
    this.showcase.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new Vector2(w, h), 0.18, 0.35, 0.9);
    this.showcase.addPass(this.bloom);
    this.bokeh = new BokehPass(scene, camera, {
      focus: 5,
      aperture: 0.02,
      maxblur: 0.004,
    });
    this.showcase.addPass(this.bokeh);
    this.updateShowcaseSize();
    return this.showcase;
  }

  ensureMain(): EffectComposer | null {
    if (this.main) return this.main;
    const container = this.deps.getContainer();
    if (!container) return null;
    const renderer = this.deps.getRenderer();
    const scene = this.deps.getScene();
    const camera = this.deps.getCamera();
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.main = new EffectComposer(renderer);
    this.main.addPass(new RenderPass(scene, camera));
    this.mainBloom = new UnrealBloomPass(new Vector2(w, h), 0.05, 0.4, 0.85);
    this.main.addPass(this.mainBloom);
    this.main.setSize(w, h);
    this.main.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    return this.main;
  }

  updateShowcaseSize(): void {
    if (!this.showcase) return;
    const container = this.deps.getContainer();
    if (!container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.showcase.setSize(w, h);
    this.showcase.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (this.bloom) {
      this.bloom.resolution.set(w, h);
    }
  }

  updateMainSize(): void {
    if (!this.main) return;
    const container = this.deps.getContainer();
    if (!container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.main.setSize(w, h);
    this.main.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (this.mainBloom) {
      this.mainBloom.resolution.set(w, h);
    }
  }

  disposeShowcase(): void {
    if (!this.showcase) return;
    if ("renderTarget1" in this.showcase && "renderTarget2" in this.showcase) {
      (this.showcase.renderTarget1 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
      (this.showcase.renderTarget2 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
    }
    this.showcase = null;
    this.bloom = null;
    this.bokeh = null;
  }

  disposeMain(): void {
    if (!this.main) return;
    if ("renderTarget1" in this.main && "renderTarget2" in this.main) {
      (this.main.renderTarget1 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
      (this.main.renderTarget2 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
    }
    this.main = null;
    this.mainBloom = null;
  }

  dispose(): void {
    this.disposeShowcase();
    this.disposeMain();
  }
}
