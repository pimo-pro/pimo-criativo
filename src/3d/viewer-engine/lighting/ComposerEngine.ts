/**
 * ComposerEngine (Z-01.2.7 A) — pipelines EffectComposer (performance vs showcase).
 * Dois composers internos até unificação GPU futura.
 */
import * as THREE from "three";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { LIVE_MAIN_BLOOM, LIVE_SHOWCASE_BLOOM, type BloomCapturePreset } from "../export/renderExportQuality";

export type ComposerEngineMode = "performance" | "showcase" | "ultra";

type DisplayQualityLevel = "baixa" | "media" | "alta";

export type ComposerEngineDeps = {
  getRenderer: () => THREE.WebGLRenderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.PerspectiveCamera;
  getContainer: () => HTMLElement | null;
};

function livePixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function syncFxaa(pass: ShaderPass | null, width: number, height: number, pixelRatio: number): void {
  if (!pass) return;
  const w = Math.max(1, width * pixelRatio);
  const h = Math.max(1, height * pixelRatio);
  const uniform = pass.material.uniforms["resolution"];
  if (uniform?.value) {
    uniform.value.x = 1 / w;
    uniform.value.y = 1 / h;
  }
}

export class ComposerEngine {
  showcase: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  bokeh: BokehPass | null = null;
  showcaseFxaa: ShaderPass | null = null;
  main: EffectComposer | null = null;
  mainBloom: UnrealBloomPass | null = null;
  mainFxaa: ShaderPass | null = null;
  private showcaseBloomProfile: BloomCapturePreset = LIVE_SHOWCASE_BLOOM;
  private mainBloomProfile: BloomCapturePreset = LIVE_MAIN_BLOOM;
  private readonly deps: ComposerEngineDeps;

  constructor(deps: ComposerEngineDeps) {
    this.deps = deps;
  }

  static ensure(current: ComposerEngine | null, deps: ComposerEngineDeps): ComposerEngine {
    return current ?? new ComposerEngine(deps);
  }

  applyDisplayQualityBloomProfiles(level: DisplayQualityLevel): void {
    // “Baixa” deve ser limpa (sem bloom perceptível).
    // “Média/Alta” seguem com bloom, mas com limiar/força ajustados para não “lavar” o MDF.
    const MAIN_LOW: BloomCapturePreset = { strength: 0, radius: LIVE_MAIN_BLOOM.radius, threshold: 1 };
    const SHOWCASE_MEDIA: BloomCapturePreset = { strength: 0.075, radius: 0.28, threshold: 0.94 };
    const SHOWCASE_HIGH: BloomCapturePreset = { strength: 0.09, radius: 0.29, threshold: 0.965 };

    switch (level) {
      case "baixa":
        this.mainBloomProfile = MAIN_LOW;
        this.showcaseBloomProfile = { ...LIVE_SHOWCASE_BLOOM, strength: 0, threshold: 1 };
        break;
      case "media":
        this.mainBloomProfile = LIVE_MAIN_BLOOM;
        this.showcaseBloomProfile = SHOWCASE_MEDIA;
        break;
      case "alta":
        this.mainBloomProfile = LIVE_MAIN_BLOOM;
        this.showcaseBloomProfile = SHOWCASE_HIGH;
        break;
    }

    // Se os passes já existirem, aplica imediatamente sem recriar pipelines.
    if (this.mainBloom) {
      this.mainBloom.strength = this.mainBloomProfile.strength;
      this.mainBloom.radius = this.mainBloomProfile.radius;
      this.mainBloom.threshold = this.mainBloomProfile.threshold;
    }
    if (this.bloom) {
      this.bloom.strength = this.showcaseBloomProfile.strength;
      this.bloom.radius = this.showcaseBloomProfile.radius;
      this.bloom.threshold = this.showcaseBloomProfile.threshold;
    }
  }

  setMode(mode: ComposerEngineMode): void {
    if (mode === "showcase") {
      this.ensureShowcase();
      return;
    }
    this.disposeShowcase();
  }

  setBokehEnabled(enabled: boolean): void {
    if (this.bokeh) this.bokeh.enabled = enabled;
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
    this.bloom = new UnrealBloomPass(
      new Vector2(w, h),
      this.showcaseBloomProfile.strength,
      this.showcaseBloomProfile.radius,
      this.showcaseBloomProfile.threshold
    );
    this.showcase.addPass(this.bloom);
    this.bokeh = new BokehPass(scene, camera, {
      focus: 5,
      aperture: 0.02,
      maxblur: 0.004,
    });
    this.bokeh.enabled = false;
    this.showcase.addPass(this.bokeh);
    this.showcaseFxaa = new ShaderPass(FXAAShader);
    this.showcase.addPass(this.showcaseFxaa);
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
    this.mainBloom = new UnrealBloomPass(
      new Vector2(w, h),
      this.mainBloomProfile.strength,
      this.mainBloomProfile.radius,
      this.mainBloomProfile.threshold
    );
    this.main.addPass(this.mainBloom);
    this.mainFxaa = new ShaderPass(FXAAShader);
    this.main.addPass(this.mainFxaa);
    this.updateMainSize();
    return this.main;
  }

  /**
   * Dimensiona o composer para a captura (não usa o CSS do viewport).
   */
  setExportSize(width: number, height: number, pixelRatio = 1): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const pr = Math.max(0.5, pixelRatio);
    if (this.showcase) {
      this.showcase.setSize(w, h);
      this.showcase.setPixelRatio(pr);
      if (this.bloom) this.bloom.resolution.set(w * pr, h * pr);
      syncFxaa(this.showcaseFxaa, w, h, pr);
    }
    if (this.main) {
      this.main.setSize(w, h);
      this.main.setPixelRatio(pr);
      if (this.mainBloom) this.mainBloom.resolution.set(w * pr, h * pr);
      syncFxaa(this.mainFxaa, w, h, pr);
    }
  }

  updateShowcaseSize(): void {
    if (!this.showcase) return;
    const container = this.deps.getContainer();
    if (!container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const pr = livePixelRatio();
    this.showcase.setSize(w, h);
    this.showcase.setPixelRatio(pr);
    if (this.bloom) {
      this.bloom.resolution.set(w * pr, h * pr);
    }
    syncFxaa(this.showcaseFxaa, w, h, pr);
  }

  updateMainSize(): void {
    if (!this.main) return;
    const container = this.deps.getContainer();
    if (!container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const pr = livePixelRatio();
    this.main.setSize(w, h);
    this.main.setPixelRatio(pr);
    if (this.mainBloom) {
      this.mainBloom.resolution.set(w * pr, h * pr);
    }
    syncFxaa(this.mainFxaa, w, h, pr);
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
    this.showcaseFxaa = null;
  }

  disposeMain(): void {
    if (!this.main) return;
    if ("renderTarget1" in this.main && "renderTarget2" in this.main) {
      (this.main.renderTarget1 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
      (this.main.renderTarget2 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
    }
    this.main = null;
    this.mainBloom = null;
    this.mainFxaa = null;
  }

  dispose(): void {
    this.disposeShowcase();
    this.disposeMain();
  }
}
