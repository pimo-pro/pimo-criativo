import * as THREE from "three";

export type RendererOptions = {
  antialias?: boolean;
  clearColor?: string;
  toneMappingExposure?: number;
};

export class RendererManager {
  readonly renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement, options: RendererOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    if ("outputColorSpace" in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      (this.renderer as unknown as { outputEncoding: number }).outputEncoding = (THREE as unknown as {
        sRGBEncoding: number;
      }).sRGBEncoding;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = options.toneMappingExposure ?? 1.0;
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
    const canvas = this.renderer.domElement;
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }
}
