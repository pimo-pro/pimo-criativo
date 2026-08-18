import * as THREE from "three";

export type RendererOptions = {
  antialias?: boolean;
  clearColor?: string;
  toneMappingExposure?: number;
};

export class RendererManager {
  readonly renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement, options: RendererOptions = {}) {
    const antialias = options.antialias !== false;
    this.renderer = new THREE.WebGLRenderer({
      antialias,
      alpha: false,
      powerPreference: "high-performance",
    });
    const dpr = window.devicePixelRatio || 1;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    this.renderer.setPixelRatio(Math.min(dpr, isMobile ? 1.1 : 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);

    // --- Qualidade visual: gamma, contraste, sombras, antialiasing ---
    if ("outputColorSpace" in this.renderer) {
      (this.renderer as THREE.WebGLRenderer).outputColorSpace = THREE.SRGBColorSpace;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const exposure = options.toneMappingExposure != null && options.toneMappingExposure > 0
      ? options.toneMappingExposure
      : 1.0;
    this.renderer.toneMappingExposure = exposure;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (options.clearColor) {
      this.renderer.setClearColor(options.clearColor);
    }
    container.appendChild(this.renderer.domElement);
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.render(scene, camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    const canvas = this.renderer.domElement;
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }
}
