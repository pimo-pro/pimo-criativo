import * as THREE from "three";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SceneManager } from "./SceneManager";
import type { SceneOptions } from "./SceneManager";
import { CameraManager } from "./CameraManager";
import type { CameraOptions } from "./CameraManager";
import { RendererManager } from "./RendererManager";
import type { RendererOptions } from "./RendererManager";
import { Lights } from "./Lights";
import type { LightsOptions } from "./Lights";
import { Controls } from "./Controls";
import type { ControlsOptions } from "./Controls";
import { createWoodMaterial, type LoadedWoodMaterial } from "../materials/WoodMaterial";
import { defaultMaterialSet, getMaterialPreset, mergeMaterialSet } from "../materials/MaterialLibrary";
import type { MaterialSet } from "../materials/MaterialLibrary";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { updateBoxGeometry, updateBoxGroup, buildBoxLegacy } from "../objects/BoxBuilder";
import type { BoxOptions } from "../objects/BoxBuilder";
import { RoomBuilder } from "../room/RoomBuilder";
import type { RoomConfig, DoorWindowConfig } from "../room/types";
import { DEFAULT_DOOR_CONFIG, DEFAULT_WINDOW_CONFIG } from "../room/types";
import type { EnvironmentOptions } from "./Environment";
import type {
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerCameraPreset,
  ViewerRenderFormat,
} from "../../context/projectTypes";
import { loadGLB } from "../../core/glb/glbLoader";

/**
 * Interface multi-box do Viewer:
 * - addBox(id, options): registra caixa (paramétrica ou CAD-only)
 * - removeBox(id): remove caixa e libera recursos
 * - updateBox(id, options): atualiza dimensões, posição, rotação
 * - setBoxIndex(id, index): reordena (reflow automático)
 * - addModelToBox/removeModelFromBox/listModels: modelos GLB por caixa
 * - selectBox(id): caixa ativa (highlight)
 */

export type ViewerOptions = {
  background?: string;
  scene?: SceneOptions;
  environment?: EnvironmentOptions;
  /** URL do HDRI para modo realista (reflexos, luz ambiente). Se definido, carrega automaticamente. */
  environmentMap?: string;
  camera?: CameraOptions;
  renderer?: RendererOptions;
  lights?: LightsOptions;
  controls?: ControlsOptions;
  enableControls?: boolean;
  box?: BoxOptions;
  /** Se true, não cria o box inicial "main"; módulos só aparecem ao gerar design ou carregar modelo. */
  skipInitialBox?: boolean;
};

export class Viewer {
  private container: HTMLElement;
  private sceneManager: SceneManager;
  private cameraManager: CameraManager;
  private rendererManager: RendererManager;
  private controls: Controls | null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private envMap: THREE.Texture | null = null;
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private boxes = new Map<
    string,
    {
      mesh: THREE.Object3D;
      width: number;
      height: number;
      depth: number;
      index: number;
      cadOnly?: boolean;
      manualPosition?: boolean;
      cadModels: Array<{
        id: string;
        object: THREE.Object3D;
        path: string;
      }>;
      material: LoadedWoodMaterial | null;
      detailMapsRequested?: boolean;
      detailTextures?: {
        normal?: THREE.Texture | null;
        roughness?: THREE.Texture | null;
        metalness?: THREE.Texture | null;
        ao?: THREE.Texture | null;
      };
      detailMapsActive?: boolean;
    }
  >();
  private mainBoxId = "main";
  private materialSet: MaterialSet;
  private defaultMaterialName = "mdf_branco";
  private boxGap = 0;
  private modelCounter = 0;
  private roomBuilder: RoomBuilder;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private selectedBoxId: string | null = null;
  private onBoxSelected: ((_id: string | null) => void) | null = null;
  private onModelLoaded: ((_boxId: string, _modelId: string, _object: THREE.Object3D) => void) | null = null;
  private onBoxTransform: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotationY: number) => void) | null = null;
  private transformControls: TransformControls | null = null;
  /** Helper (Object3D) retornado por getHelper(); é o que é adicionado à cena e tem .visible. */
  private transformControlsHelper: THREE.Object3D | null = null;
  private transformMode: "translate" | "rotate" | null = null;
  private readonly _boundingBox = new THREE.Box3();
  private readonly _center = new THREE.Vector3();
  private readonly _size = new THREE.Vector3();
  private _initialCanvasSizeDone = false;
  private readonly isMobile: boolean;
  private hoveredBoxId: string | null = null;
  private outlineCurrentOpacity = 0;
  private outlineTargetOpacity = 0;
  private placementMode: "door" | "window" | null = null;
  private onRoomElementPlaced: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null = null;
  private onRoomElementSelected: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null = null;

  /** Exploded View: posições base (do projeto) e offsets visuais. */
  private explodedViewEnabled = false;
  private explodedBasePositions = new Map<string, { x: number; y: number; z: number }>();
  private explodedOffsets = new Map<string, { x: number; y: number; z: number }>();
  private readonly EXPLODED_OFFSET_M = 0.1;
  private readonly EXPLODED_LERP = 0.12;

  /** "performance" = leve, sem DOF/Bloom; "showcase" = DOF+Bloom+turntable */
  private currentMode: "performance" | "showcase" = "performance";
  private turntableEnabled = false;
  private turntableSpeed = 0.15;
  private lights: Lights;
  private selectionOutline: THREE.BoxHelper | null = null;
  private selectionOutlineTarget: THREE.Object3D | null = null;
  private selectionOutlineMaterial: THREE.LineBasicMaterial | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private bokehPass: BokehPass | null = null;
  /** Compositor principal: RenderPass + bloom muito suave (modo atual). */
  private mainComposer: EffectComposer | null = null;
  private mainBloomPass: UnrealBloomPass | null = null;
  private hdriLoaded = false;
  private pendingHDRIUrl: string | null = null;
  private ultraPerformanceMode = false;
  private defaultPixelRatio: number;
  private ultraLightState: {
    key: number;
    fill: number;
    ambient: number;
    rim: number;
    castShadow: boolean;
    shadowRadius: number;
  } | null = null;
  private ultraLightTarget: {
    key: number;
    fill: number;
    ambient: number;
    rim: number;
    castShadow: boolean;
    shadowRadius: number;
  } | null = null;
  private readonly LIGHT_LERP_FACTOR = 0.14;
  private _diagnosticsLogged = false;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    if (!container) {
      throw new Error("Viewer: container is required");
    }
    const userAgent =
      typeof window !== "undefined" && window.navigator ? window.navigator.userAgent : "";
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent ?? ""
    );
    this.container = container;
    const background = options.background ?? options.scene?.background;
    this.sceneManager = new SceneManager({
      background,
      environment: options.environment,
    });
    this.cameraManager = new CameraManager(options.camera);
    this.rendererManager = new RendererManager(container, {
      ...options.renderer,
      clearColor: background,
    });
    const shadowMapSize = this.isMobile ? 512 : (options.lights?.shadowMapSize ?? 2048);
    this.lights = new Lights(this.sceneManager.scene, {
      ...options.lights,
      shadowMapSize,
    });
    this.defaultPixelRatio = this.rendererManager.renderer.getPixelRatio();
    this.selectionOutlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#7dd3fc"),
      linewidth: 1,
      opacity: 0.6,
      transparent: true,
      depthTest: true,
    });
    this.selectionOutline = new THREE.BoxHelper(new THREE.Object3D(), 0x00aeef);
    if (this.selectionOutlineMaterial) {
      (this.selectionOutline.material as THREE.Material).dispose();
      this.selectionOutline.material = this.selectionOutlineMaterial;
    }
    this.selectionOutline.visible = false;
    this.sceneManager.scene.add(this.selectionOutline);

    this.roomBuilder = new RoomBuilder();
    this.sceneManager.add(this.roomBuilder.getGroup());

    this.pendingHDRIUrl =
      options.environmentMap ?? `${import.meta.env.BASE_URL}hdr/studio_neutral.hdr`;

    this.materialSet = mergeMaterialSet(defaultMaterialSet);
    if (!options.skipInitialBox) {
      this.addBox(this.mainBoxId, { ...options.box, materialName: "MDF Branco" });
    }

    this.controls = options.enableControls === false
      ? null
      : new Controls(this.cameraManager.camera, this.rendererManager.renderer.domElement, options.controls);

    this.transformControls = new TransformControls(
      this.cameraManager.camera,
      this.rendererManager.renderer.domElement
    );
    this.transformControls.setSpace("world");
    this.transformControls.addEventListener("dragging-changed", (event) => {
      if (this.controls?.controls) {
        this.controls.controls.enabled = !event.value;
      }
      if (!event.value) this.notifyBoxTransform();
    });
    this.transformControls.addEventListener("objectChange", () => {
      this.clampTransform();
    });
    this.transformControlsHelper = this.transformControls.getHelper();
    this.transformControlsHelper.visible = false;
    this.sceneManager.scene.add(this.transformControlsHelper);

    this.updateCameraTarget();

    this.rendererManager.renderer.domElement.addEventListener("click", this.handleCanvasClick);
    this.rendererManager.renderer.domElement.addEventListener("pointermove", this.handleCanvasPointerMove);
    this.rendererManager.renderer.domElement.addEventListener("pointerleave", this.handleCanvasPointerLeave);

    if (this.pendingHDRIUrl) {
      this.loadHDRI(this.pendingHDRIUrl, { setBackground: false });
    }
    this.start();
    window.addEventListener("resize", this.updateCanvasSize);
  }

  getCurrentMode(): "performance" | "showcase" {
    return this.currentMode;
  }

  setMode(mode: "performance" | "showcase", turntable = false): void {
    this.currentMode = mode;
    this.turntableEnabled = mode === "showcase" && turntable;
    this.lights.setShadowMapSize(this.isMobile ? 512 : 2048);
    if (mode === "showcase") {
      if (!this.hdriLoaded && this.pendingHDRIUrl) {
        this.loadHDRI(this.pendingHDRIUrl, { setBackground: false });
      }
      if (!this.composer) {
        this.initShowcaseComposer();
      }
    } else {
      this.disposeComposer();
    }
  }

  setShowcaseMode(active: boolean, turntable = false): void {
    this.setMode(active ? "showcase" : "performance", turntable);
  }

  getShowcaseMode(): boolean {
    return this.currentMode === "showcase";
  }

  setUltraPerformanceMode(active: boolean): void {
    if (this.ultraPerformanceMode === active) return;
    this.ultraPerformanceMode = active;

    if (active) {
      if (!this.ultraLightState) {
        this.ultraLightState = {
          key: this.lights.keyLight.intensity,
          fill: this.lights.fillLight.intensity,
          ambient: this.lights.ambient.intensity,
          rim: this.lights.rimLight.intensity,
          castShadow: this.lights.keyLight.castShadow,
          shadowRadius: this.lights.keyLight.shadow.radius,
        };
      }
      this.ultraLightTarget = {
        key: this.ultraLightState.key * 0.65,
        fill: this.ultraLightState.fill * 0.6,
        ambient: this.ultraLightState.ambient * 0.7,
        rim: this.ultraLightState.rim * 0.4,
        castShadow: false,
        shadowRadius: 0.5,
      };
      const performanceRatio = this.isMobile ? 0.9 : 1.1;
      this.rendererManager.renderer.setPixelRatio(performanceRatio);
    } else {
      if (this.ultraLightState) {
        this.ultraLightTarget = { ...this.ultraLightState };
      } else {
        this.ultraLightTarget = null;
      }
      this.ultraLightState = null;
      this.rendererManager.renderer.setPixelRatio(this.defaultPixelRatio);
    }

    this.updateCanvasSize();
    this.boxes.forEach((entry) => {
      this.applyDetailMapState(entry);
    });
  }

  private lerpLightsToTarget(): void {
    if (!this.ultraLightTarget) return;
    const t = this.LIGHT_LERP_FACTOR;
    const key = this.lights.keyLight.intensity;
    const fill = this.lights.fillLight.intensity;
    const ambient = this.lights.ambient.intensity;
    const rim = this.lights.rimLight.intensity;
    const radius = this.lights.keyLight.shadow.radius;

    this.lights.keyLight.intensity = key + (this.ultraLightTarget.key - key) * t;
    this.lights.fillLight.intensity = fill + (this.ultraLightTarget.fill - fill) * t;
    this.lights.ambient.intensity = ambient + (this.ultraLightTarget.ambient - ambient) * t;
    this.lights.rimLight.intensity = rim + (this.ultraLightTarget.rim - rim) * t;
    this.lights.keyLight.shadow.radius = radius + (this.ultraLightTarget.shadowRadius - radius) * t;

    const snap = 0.002;
    if (
      Math.abs(this.lights.keyLight.intensity - this.ultraLightTarget.key) < snap &&
      Math.abs(this.lights.fillLight.intensity - this.ultraLightTarget.fill) < snap &&
      Math.abs(this.lights.ambient.intensity - this.ultraLightTarget.ambient) < snap &&
      Math.abs(this.lights.rimLight.intensity - this.ultraLightTarget.rim) < snap
    ) {
      this.lights.keyLight.intensity = this.ultraLightTarget.key;
      this.lights.fillLight.intensity = this.ultraLightTarget.fill;
      this.lights.ambient.intensity = this.ultraLightTarget.ambient;
      this.lights.rimLight.intensity = this.ultraLightTarget.rim;
      this.lights.keyLight.castShadow = this.ultraLightTarget.castShadow;
      this.lights.keyLight.shadow.radius = this.ultraLightTarget.shadowRadius;
      this.ultraLightTarget = null;
    } else {
      this.lights.keyLight.castShadow = this.ultraLightTarget.castShadow;
    }
  }

  getUltraPerformanceMode(): boolean {
    return this.ultraPerformanceMode;
  }

  setExplodedView(enabled: boolean): void {
    if (this.explodedViewEnabled === enabled) return;
    this.explodedViewEnabled = enabled;
    if (enabled) {
      this.explodedBasePositions.clear();
      this.explodedOffsets.clear();
      const positions: Array<{ id: string; x: number; y: number; z: number }> = [];
      this.boxes.forEach((entry, id) => {
        const p = entry.mesh.position;
        this.explodedBasePositions.set(id, { x: p.x, y: p.y, z: p.z });
        positions.push({ id, x: p.x, y: p.y, z: p.z });
      });
      if (positions.length > 1) {
        const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
        const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
        const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
        positions.forEach((p) => {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dz = p.z - cz;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const scale = this.EXPLODED_OFFSET_M / len;
          this.explodedOffsets.set(p.id, {
            x: dx * scale,
            y: dy * scale,
            z: dz * scale,
          });
        });
      }
    } else {
      this.explodedOffsets.clear();
    }
  }

  getExplodedView(): boolean {
    return this.explodedViewEnabled;
  }

  private updateExplodedView(): void {
    if (this.explodedViewEnabled && this.explodedOffsets.size > 0) {
      this.boxes.forEach((entry, id) => {
        const base = this.explodedBasePositions.get(id);
        const off = this.explodedOffsets.get(id);
        if (base && off) {
          const target = {
            x: base.x + off.x,
            y: base.y + off.y,
            z: base.z + off.z,
          };
          entry.mesh.position.x += (target.x - entry.mesh.position.x) * this.EXPLODED_LERP;
          entry.mesh.position.y += (target.y - entry.mesh.position.y) * this.EXPLODED_LERP;
          entry.mesh.position.z += (target.z - entry.mesh.position.z) * this.EXPLODED_LERP;
        }
      });
    } else if (!this.explodedViewEnabled && this.explodedBasePositions.size > 0) {
      let allDone = true;
      this.boxes.forEach((entry, id) => {
        const base = this.explodedBasePositions.get(id);
        if (base) {
          const mx = entry.mesh.position.x;
          const my = entry.mesh.position.y;
          const mz = entry.mesh.position.z;
          const dx = base.x - mx;
          const dy = base.y - my;
          const dz = base.z - mz;
          const eps = 0.0005;
          if (Math.abs(dx) > eps || Math.abs(dy) > eps || Math.abs(dz) > eps) {
            allDone = false;
            entry.mesh.position.x += dx * this.EXPLODED_LERP;
            entry.mesh.position.y += dy * this.EXPLODED_LERP;
            entry.mesh.position.z += dz * this.EXPLODED_LERP;
          } else {
            entry.mesh.position.set(base.x, base.y, base.z);
          }
        }
      });
      if (allDone) this.explodedBasePositions.clear();
    }
  }

  private initShowcaseComposer(): void {
    const renderer = this.rendererManager.renderer;
    const scene = this.sceneManager.scene;
    const camera = this.cameraManager.camera;
    const w = this.container?.clientWidth ?? 1;
    const h = this.container?.clientHeight ?? 1;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloomPass = new UnrealBloomPass(new Vector2(w, h), 0.18, 0.35, 0.9);
    this.composer.addPass(this.bloomPass);
    this.bokehPass = new BokehPass(scene, camera, {
      focus: 5,
      aperture: 0.02,
      maxblur: 0.004,
    });
    this.composer.addPass(this.bokehPass);
    this.updateShowcaseComposerSize();
  }

  private updateShowcaseComposerSize(): void {
    if (!this.composer || !this.container) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  }

  private initMainComposer(): void {
    if (this.mainComposer || !this.container) return;
    const renderer = this.rendererManager.renderer;
    const scene = this.sceneManager.scene;
    const camera = this.cameraManager.camera;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.mainComposer = new EffectComposer(renderer);
    this.mainComposer.addPass(new RenderPass(scene, camera));
    this.mainBloomPass = new UnrealBloomPass(new Vector2(w, h), 0.05, 0.4, 0.85);
    this.mainComposer.addPass(this.mainBloomPass);
    this.mainComposer.setSize(w, h);
    this.mainComposer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  private updateMainComposerSize(): void {
    if (!this.mainComposer || !this.container) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.mainComposer.setSize(w, h);
    this.mainComposer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (this.mainBloomPass) {
      this.mainBloomPass.resolution.set(w, h);
    }
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    if ("renderTarget1" in this.composer && "renderTarget2" in this.composer) {
      (this.composer.renderTarget1 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
      (this.composer.renderTarget2 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
    }
    this.composer = null;
    this.bloomPass = null;
    this.bokehPass = null;
  }

  private disposeMainComposer(): void {
    if (!this.mainComposer) return;
    if ("renderTarget1" in this.mainComposer && "renderTarget2" in this.mainComposer) {
      (this.mainComposer.renderTarget1 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
      (this.mainComposer.renderTarget2 as THREE.WebGLRenderTarget | undefined)?.dispose?.();
    }
    this.mainComposer = null;
    this.mainBloomPass = null;
  }

  loadHDRI(url: string, options?: { setBackground?: boolean }) {
    if (!this.pmremGenerator) {
      this.pmremGenerator = new THREE.PMREMGenerator(this.rendererManager.renderer);
    }
    const loader = new RGBELoader();
    if (THREE.UnsignedByteType) {
      loader.setDataType(THREE.UnsignedByteType);
    }
    loader.load(
      url,
      (texture) => {
      if (this.isMobile && texture.image && "data" in texture.image) {
        const image = texture.image as {
          width: number;
          height: number;
          data?: Float32Array | Uint16Array | Uint8Array;
        };
        if (image.width && image.height && image.data) {
          const targetWidth = Math.max(256, Math.floor(image.width / 2));
          const targetHeight = Math.max(128, Math.floor(image.height / 2));
          if (targetWidth < image.width && targetHeight < image.height) {
            let targetData: Float32Array | Uint16Array | Uint8Array;
            if (image.data instanceof Float32Array) {
              targetData = new Float32Array(targetWidth * targetHeight * 4);
            } else if (image.data instanceof Uint16Array) {
              targetData = new Uint16Array(targetWidth * targetHeight * 4);
            } else {
              targetData = new Uint8Array(targetWidth * targetHeight * 4);
            }
            for (let y = 0; y < targetHeight; y++) {
              const srcY = Math.min(
                image.height - 1,
                Math.floor((y / targetHeight) * image.height)
              );
              for (let x = 0; x < targetWidth; x++) {
                const srcX = Math.min(
                  image.width - 1,
                  Math.floor((x / targetWidth) * image.width)
                );
                const dstIndex = (y * targetWidth + x) * 4;
                const srcIndex = (srcY * image.width + srcX) * 4;
                targetData[dstIndex] = image.data[srcIndex];
                targetData[dstIndex + 1] = image.data[srcIndex + 1];
                targetData[dstIndex + 2] = image.data[srcIndex + 2];
                targetData[dstIndex + 3] = image.data[srcIndex + 3];
              }
            }
            image.data = targetData;
            image.width = targetWidth;
            image.height = targetHeight;
            texture.needsUpdate = true;
          }
        }
      }
      const envMap = this.pmremGenerator?.fromEquirectangular(texture).texture ?? null;
      texture.dispose();
      if (!envMap) return;
      if (this.envMap) {
        this.envMap.dispose();
      }
      this.envMap = envMap;
      this.sceneManager.scene.environment = envMap;
      if (options?.setBackground ?? true) {
        this.sceneManager.scene.background = envMap;
      }
      this.hdriLoaded = true;
      this.pendingHDRIUrl = null;
      if (import.meta.env.PROD) {
        console.log("[Viewer] HDRI carregado:", url);
      }
    },
      undefined,
      () => {
        console.warn("[Viewer] Falha ao carregar HDRI:", url, "- usando fallback (sem envMap).");
        this.hdriLoaded = true;
        this.pendingHDRIUrl = null;
        this.applyEnvMapFallback();
      }
    );
  }

  private applyEnvMapFallback(): void {
    const fallbackColor = new THREE.Color("#f2f0eb");
    this.boxes.forEach((entry) => {
      const mat = entry.material?.material;
      if (mat && mat instanceof THREE.MeshStandardMaterial) {
        mat.envMapIntensity = 0;
        if (mat.color.getHex() === 0x000000 || mat.color.getStyle().toLowerCase() === "#000000") {
          mat.color.copy(fallbackColor);
        }
      }
      if (entry.mesh instanceof THREE.Group) {
        entry.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.envMapIntensity = 0;
            if (child.material.color.getHex() === 0x000000) {
              child.material.color.copy(fallbackColor);
            }
          }
        });
      } else if (entry.mesh instanceof THREE.Mesh && entry.mesh.material instanceof THREE.MeshStandardMaterial) {
        entry.mesh.material.envMapIntensity = 0;
        if (entry.mesh.material.color.getHex() === 0x000000) {
          entry.mesh.material.color.copy(fallbackColor);
        }
      }
    });
  }

  loadMaterialSet(materialConfig?: MaterialSet) {
    this.materialSet = mergeMaterialSet(this.materialSet, materialConfig);
  }

  updateBoxMaterial(id: string, materialName: string) {
    const entry = this.boxes.get(id);
    if (!entry) return;
    const nextMaterial = this.loadMaterial(materialName);
    if (!nextMaterial) return;
    
    // Atualizar material de todos os painéis do caixote
    if (entry.mesh instanceof THREE.Group) {
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = nextMaterial.material;
        }
      });
    } else if (entry.mesh instanceof THREE.Mesh) {
      entry.mesh.material = nextMaterial.material;
    }
    
    if (this.selectedBoxId === id) {
      this.applyHighlight(entry);
    }
    if (entry.material) {
      entry.material.material.dispose();
      entry.material.textures.forEach((texture) => texture.dispose());
    }
    entry.material = nextMaterial;
    entry.detailMapsRequested = false;
    entry.detailTextures = undefined;
    entry.detailMapsActive = undefined;
    if (this.ultraPerformanceMode) {
      this.applyDetailMapState(entry);
    } else if (this.selectedBoxId === id) {
      this.ensureMaterialDetailMaps(entry);
      this.refreshOutlineTarget();
    }
  }

  updateBoxDimensions(
    id: string,
    dimensions: { width: number; height: number; depth: number }
  ): boolean {
    return this.updateBox(id, dimensions);
  }

  setBoxPosition(id: string, position: { x: number; y: number; z: number }): boolean {
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return false;
    }
    return this.updateBox(id, { position });
  }

  setCameraFrontView() {
    this.cameraManager.setPosition(0, 2.2, 6);
    this.updateCameraTarget();
  }

  addBox(id: string, options: BoxOptions = {}): boolean {
    if (this.boxes.has(id)) return false;
    const opts = options ?? {};
    const cadOnly = opts.cadOnly === true;
    const { width, height, depth } = this.getBoxDimensionsFromOptions(opts);
    const index = opts.index ?? this.getNextBoxIndex();

    let box: THREE.Object3D;
    let material: LoadedWoodMaterial | null = null;

    if (cadOnly) {
      // Caixa só CAD: grupo vazio; o GLB é a própria caixa (sem geometria paramétrica)
      box = new THREE.Group();
      box.name = id;
    } else {
      const materialName = opts.materialName ?? this.defaultMaterialName;
      material = this.loadMaterial(materialName) ?? this.loadMaterial("mdf_branco");
      const boxOptions: BoxOptions = {
        ...opts,
        width: opts.width ?? 1,
        height: opts.height ?? 1,
        depth: opts.depth ?? 1,
        thickness: opts.thickness ?? 0.019,
        index: opts.index,
        materialName,
      };
      if (material?.material != null) {
        boxOptions.material = material.material;
      }
      box = buildBoxLegacy(boxOptions);
    }

    box.frustumCulled = false;
    box.userData.boxId = id;
    const baseY = cadOnly ? 0 : height / 2;
    // CAD-only sem manualPosition: (0,0,0); reflowBoxes() abaixo define X/Z. Paramétricas/idem.
    const useReflowPosition = !(opts.manualPosition === true && opts.position);
    const position =
      useReflowPosition && cadOnly
        ? { x: 0, y: 0, z: 0 }
        : (opts.position ?? { x: 0, y: baseY, z: 0 });
    box.position.set(position.x, position.y, position.z);
    if (opts.rotationY != null && Number.isFinite(opts.rotationY)) {
      box.rotation.y = opts.rotationY;
    }
    this.sceneManager.add(box);
    this.boxes.set(id, {
      mesh: box,
      width,
      height,
      depth,
      index,
      cadOnly: cadOnly || undefined,
      manualPosition: opts.manualPosition ?? false,
      cadModels: [],
      material,
      detailMapsRequested: false,
      detailTextures: undefined,
      detailMapsActive: undefined,
    });
    if (this.ultraPerformanceMode) {
      const entry = this.boxes.get(id);
      if (entry) {
        this.applyDetailMapState(entry);
      }
    }
    this.reflowBoxes();
    this.updateCameraTarget();
    return true;
  }

  updateBox(id: string, options: Partial<BoxOptions> = {}): boolean {
    const entry = this.boxes.get(id);
    if (!entry) return false;
    const opts = options ?? {};
    if (
      (opts.size !== undefined && (!Number.isFinite(opts.size) || opts.size <= 0)) ||
      (opts.width !== undefined && (!Number.isFinite(opts.width) || opts.width <= 0)) ||
      (opts.height !== undefined && (!Number.isFinite(opts.height) || opts.height <= 0)) ||
      (opts.depth !== undefined && (!Number.isFinite(opts.depth) || opts.depth <= 0))
    ) {
      return false;
    }
    if (
      opts.position &&
      (!Number.isFinite(opts.position.x) ||
        !Number.isFinite(opts.position.y) ||
        !Number.isFinite(opts.position.z))
    ) {
      return false;
    }
    if (opts.index !== undefined && (!Number.isFinite(opts.index) || opts.index < 0)) {
      return false;
    }
    let width = entry.width;
    let height = entry.height;
    let depth = entry.depth;
    let heightChanged = false;
    let indexChanged = false;
    const dimensionsChanged =
      opts.width !== undefined ||
      opts.height !== undefined ||
      opts.depth !== undefined ||
      opts.size !== undefined ||
      opts.thickness !== undefined;

    if (dimensionsChanged) {
      width = Math.max(0.001, opts.width ?? opts.size ?? width);
      height = Math.max(0.001, opts.height ?? opts.size ?? height);
      depth = Math.max(0.001, opts.depth ?? opts.size ?? depth);
      heightChanged = height !== entry.height;
      // Caixa CAD-only: não tem geometria paramétrica para atualizar; só atualizamos dimensões para reflow
      if (!entry.cadOnly) {
        const fullOpts: Partial<BoxOptions> = {
          width: opts.width ?? width,
          height: opts.height ?? height,
          depth: opts.depth ?? depth,
          thickness: opts.thickness,
        };
        const updated =
          entry.mesh instanceof THREE.Group
            ? updateBoxGroup(entry.mesh, fullOpts)
            : updateBoxGeometry(entry.mesh as THREE.Mesh, fullOpts);
        width = updated.width;
        height = updated.height;
        depth = updated.depth;
      } else {
        entry.mesh.position.y = 0;
      }
    }
    if (opts.index !== undefined && opts.index !== entry.index) {
      entry.index = opts.index;
      indexChanged = true;
    }
    if (opts.materialName && !entry.cadOnly) {
      this.updateBoxMaterial(id, opts.materialName);
    }
    if (opts.position) {
      this.explodedBasePositions.set(id, { ...opts.position });
      if (!this.explodedViewEnabled) {
        entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
      }
    } else {
      // Não alterar X/Z: vêm do reflow (ou já estão corretos). Só corrigir Y (base no chão).
      entry.mesh.position.y = entry.cadOnly ? 0 : height / 2;
    }
    if (opts.rotationY != null && Number.isFinite(opts.rotationY)) {
      entry.mesh.rotation.y = opts.rotationY;
    }
    if (opts.manualPosition !== undefined) {
      entry.manualPosition = opts.manualPosition;
    }
    entry.mesh.updateMatrixWorld();
    entry.width = width;
    entry.height = height;
    entry.depth = depth;
    if (dimensionsChanged && entry.cadOnly) {
      entry.cadModels.forEach((model) => {
        if (model.object.userData?.isCatalogGlb) {
          this.applyCatalogModelScale(entry, model.object);
        }
      });
    }
    const reflowNeeded =
      indexChanged || (dimensionsChanged && entry.cadOnly);
    if (reflowNeeded) {
      this.reflowBoxes();
      this.updateCameraTarget();
    }
    if (heightChanged && !entry.cadOnly) {
      this.updateModelsVerticalPosition(entry);
    }
    return true;
  }

  setBoxIndex(id: string, index: number): boolean {
    const entry = this.boxes.get(id);
    if (!entry) return false;
    if (!Number.isFinite(index) || index < 0) return false;
    entry.index = index;
    this.reflowBoxes();
    this.updateCameraTarget();
    return true;
  }

  removeBox(id: string): boolean {
    const entry = this.boxes.get(id);
    if (!entry) return false;
    if (this.selectedBoxId === id) {
      this.setSelectedBox(null);
    }
    this.clearModelsFromBox(id);
    this.sceneManager.root.remove(entry.mesh);
    
    // Dispose corretamente para grupos e meshes
    if (entry.mesh instanceof THREE.Group) {
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    } else if (entry.mesh instanceof THREE.Mesh) {
      if (entry.mesh.geometry) {
        entry.mesh.geometry.dispose();
      }
      if (entry.mesh.material) {
        if (Array.isArray(entry.mesh.material)) {
          entry.mesh.material.forEach((material) => material.dispose());
        } else {
          entry.mesh.material.dispose();
        }
      }
    }
    
    if (entry.material) {
      entry.material.textures.forEach((texture) => texture.dispose());
    }
    this.boxes.delete(id);
    this.reflowBoxes();
    this.updateCameraTarget();
    return true;
  }

  clearBoxes(): void {
    Array.from(this.boxes.keys()).forEach((id) => this.removeBox(id));
  }

  createRoom(config: RoomConfig): void {
    this.roomBuilder.createRoom(config);
  }

  removeRoom(): void {
    this.roomBuilder.clearRoom(true);
  }

  setPlacementMode(mode: "door" | "window" | null): void {
    this.placementMode = mode;
  }

  setOnRoomElementPlaced(
    callback: ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null
  ): void {
    this.onRoomElementPlaced = callback;
  }

  setOnRoomElementSelected(
    callback: ((_data: { elementId: string; wallId: number; type: "door" | "window"; config: DoorWindowConfig } | null) => void) | null
  ): void {
    this.onRoomElementSelected = callback;
  }

  updateRoomElementConfig(elementId: string, config: DoorWindowConfig): boolean {
    return this.roomBuilder.updateElementConfig(elementId, config);
  }

  addDoorToRoom(wallId: number, config: DoorWindowConfig): string {
    return this.roomBuilder.addDoor(wallId, config);
  }

  addWindowToRoom(wallId: number, config: DoorWindowConfig): string {
    return this.roomBuilder.addWindow(wallId, config);
  }

  getRoomWalls(): THREE.Mesh[] {
    return this.roomBuilder.getWalls();
  }

  setOnBoxSelected(callback: (_id: string | null) => void): void {
    this.onBoxSelected = callback;
  }

  setOnModelLoaded(callback: ((_boxId: string, _modelId: string, _object: THREE.Object3D) => void) | null): void {
    this.onModelLoaded = callback;
  }

  setOnBoxTransform(callback: ((_boxId: string, _position: { x: number; y: number; z: number }, _rotationY: number) => void) | null): void {
    this.onBoxTransform = callback;
  }

  setTransformMode(mode: "translate" | "rotate" | null): void {
    this.transformMode = mode;
    if (this.transformControls) {
      if (this.selectedBoxId && mode) {
        const entry = this.boxes.get(this.selectedBoxId);
        if (entry) {
          this.transformControls.attach(entry.mesh);
          this.transformControls.setMode(mode);
          if (this.transformControlsHelper) this.transformControlsHelper.visible = true;
        }
      } else {
        this.transformControls.detach();
        if (this.transformControlsHelper) this.transformControlsHelper.visible = false;
      }
    }
  }

  selectBox(id: string | null): void {
    this.setSelectedBox(id);
  }

  /** Aplica highlight na caixa (igual a selectBox; exposto para sincronização RightPanel ↔ Viewer). */
  highlightBox(id: string | null): void {
    this.setSelectedBox(id);
  }

  addModelToBox(boxId: string, modelPath: string, modelId?: string): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    if (!modelPath || typeof modelPath !== "string") return false;
    const extension = this.getModelExtension(modelPath);
    if (!extension) return false;
    const id = modelId ?? this.getNextModelId();
    if (entry.cadModels.some((model) => model.id === id)) return false;
    const isCatalogModel = id.startsWith("catalog:");

    this.loadModelObject(modelPath, extension)
      .then((object) => {
        entry.mesh.add(object);
        object.traverse((child) => {
          child.userData.boxId = boxId;
        });
        if (isCatalogModel) {
          object.userData.isCatalogGlb = true;
          this.storeCatalogBaseSize(object);
          if (entry.cadOnly) {
            this.applyCatalogModelScale(entry, object);
          }
        } else if (entry.cadOnly) {
          // Caixa só CAD: o GLB é a própria caixa; centrar bbox na origem do grupo para reflow correto
          this.centerObjectInGroup(object);
        } else {
          object.position.set(0, entry.height / 2, 0);
        }
        entry.cadModels.push({ id, object, path: modelPath });
        this.onModelLoaded?.(boxId, id, object);
      })
      .catch(() => {
        // Falha silenciosa conforme especificado
      });

    return true;
  }

  /** Coloca o GLB com base no chão: centra em X e Z; em Y coloca a base em y=0 no grupo. */
  private centerObjectInGroup(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(object);
    this._boundingBox.getCenter(this._center);
    object.position.x = -this._center.x;
    object.position.z = -this._center.z;
    object.position.y = -this._boundingBox.min.y;
  }

  /** Guarda o bounding box base do GLB para permitir escala por dimensão. */
  private storeCatalogBaseSize(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(object);
    this._boundingBox.getSize(this._size);
    object.userData.glbBaseSize = {
      x: Math.max(this._size.x, 0.001),
      y: Math.max(this._size.y, 0.001),
      z: Math.max(this._size.z, 0.001),
    };
  }

  /** Ajusta escala do GLB de catálogo para corresponder às dimensões da caixa. */
  private applyCatalogModelScale(
    entry: { width: number; height: number; depth: number },
    object: THREE.Object3D
  ): void {
    const base = object.userData.glbBaseSize as { x: number; y: number; z: number } | undefined;
    if (!base) return;
    const sx = entry.width / Math.max(base.x, 0.001);
    const sy = entry.height / Math.max(base.y, 0.001);
    const sz = entry.depth / Math.max(base.z, 0.001);
    object.scale.set(sx, sy, sz);
    this.centerObjectInGroup(object);
  }

  removeModelFromBox(boxId: string, modelId: string): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    const index = entry.cadModels.findIndex((model) => model.id === modelId);
    if (index === -1) return false;
    const [model] = entry.cadModels.splice(index, 1);
    if (model.object.parent) {
      model.object.parent.remove(model.object);
    }
    this.disposeObject(model.object);
    return true;
  }

  clearModelsFromBox(boxId: string): void {
    const entry = this.boxes.get(boxId);
    if (!entry) return;
    entry.cadModels.forEach((model) => {
      if (model.object.parent) {
        model.object.parent.remove(model.object);
      }
      this.disposeObject(model.object);
    });
    entry.cadModels = [];
  }

  listModels(boxId: string): Array<{ id: string; path: string }> | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    return entry.cadModels.map((model) => ({ id: model.id, path: model.path }));
  }

  /** Dimensões da caixa em metros (para layout e auto-posicionamento). */
  getBoxDimensions(boxId: string): { width: number; height: number; depth: number } | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    return { width: entry.width, height: entry.height, depth: entry.depth };
  }

  /** Posição do modelo em espaço local da caixa (metros; origem no centro da caixa). */
  getModelPosition(boxId: string, modelId: string): { x: number; y: number; z: number } | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    const model = entry.cadModels.find((m) => m.id === modelId);
    if (!model) return null;
    const p = model.object.position;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** Tamanho do bounding box do modelo em metros (largura, altura, profundidade). */
  getModelBoundingBoxSize(boxId: string, modelId: string): { width: number; height: number; depth: number } | null {
    const entry = this.boxes.get(boxId);
    if (!entry) return null;
    const model = entry.cadModels.find((m) => m.id === modelId);
    if (!model) return null;
    entry.mesh.updateMatrixWorld(true);
    model.object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(model.object);
    const size = new THREE.Vector3();
    this._boundingBox.getSize(size);
    return { width: size.x, height: size.y, depth: size.z };
  }

  /** Define a posição do modelo em espaço local da caixa (metros; origem no centro da caixa). */
  setModelPosition(boxId: string, modelId: string, position: { x: number; y: number; z: number }): boolean {
    const entry = this.boxes.get(boxId);
    if (!entry) return false;
    const model = entry.cadModels.find((m) => m.id === modelId);
    if (!model) return false;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      return false;
    }
    model.object.position.set(position.x, position.y, position.z);
    return true;
  }

  setBoxGap(gap: number) {
    this.boxGap = Math.max(0, gap);
    this.reflowBoxes();
    this.updateCameraTarget();
  }

  /**
   * Posiciona todas as caixas (paramétricas e CAD-only) lado a lado em X/Z; não altera Y.
   * CAD-only e paramétricas são tratadas da mesma forma; só manualPosition mantém X/Z.
   */
  reflowBoxes() {
    let cursorX = 0;
    const ordered = Array.from(this.boxes.values()).sort((a, b) => a.index - b.index);
    ordered.forEach((entry) => {
      let w: number;
      if (!entry.cadOnly && entry.mesh) {
        entry.mesh.updateMatrixWorld(true);
        this._boundingBox.setFromObject(entry.mesh);
        this._boundingBox.getSize(this._size);
        w = Math.max(this._size.x, 0.001);
      } else {
        w = Math.max(Number(entry.width) || 0.001, 0.001);
      }
      entry.mesh.frustumCulled = false;
      if (!entry.manualPosition) {
        entry.mesh.position.x = cursorX + w / 2;
        entry.mesh.position.z = 0;
      }
      entry.mesh.updateMatrixWorld();
      this.explodedBasePositions.set(entry.mesh.userData.boxId as string, {
        x: entry.mesh.position.x,
        y: entry.mesh.position.y,
        z: entry.mesh.position.z,
      });
      cursorX += w + this.boxGap;
    });
  }

  private updateCameraTarget() {
    if (this.boxes.size === 0) {
      this.cameraManager.setTarget(0, 0, 0);
      if (this.controls) {
        this.controls.controls.target.set(0, 0, 0);
        this.cameraManager.camera.lookAt(0, 0, 0);
        this.controls.update();
      }
      return;
    }
    this._boundingBox.makeEmpty();
    this.boxes.forEach((entry) => {
      this._boundingBox.expandByObject(entry.mesh);
    });
    this._boundingBox.getCenter(this._center);
    this.cameraManager.setTarget(this._center.x, this._center.y, this._center.z);
    if (this.controls) {
      this.controls.controls.target.copy(this._center);
      this.cameraManager.camera.lookAt(this._center);
      this.controls.update();
    }
  }

  private getBoxDimensionsFromOptions(options?: BoxOptions) {
    const width = Math.max(0.001, options?.width ?? options?.size ?? 1);
    const height = Math.max(0.001, options?.height ?? options?.size ?? 1);
    const depth = Math.max(0.001, options?.depth ?? options?.size ?? 1);
    return { width, height, depth };
  }

  private getNextBoxIndex() {
    if (this.boxes.size === 0) return 0;
    let maxIndex = -1;
    this.boxes.forEach((entry) => {
      if (entry.index > maxIndex) {
        maxIndex = entry.index;
      }
    });
    return maxIndex + 1;
  }

  private getNextModelId() {
    this.modelCounter += 1;
    return `model-${this.modelCounter}`;
  }

  private getModelExtension(path: string) {
    const lower = path.toLowerCase();
    // Data URLs (ex.: upload GLB em base64) não têm extensão no fim
    if (lower.startsWith("data:")) {
      if (lower.includes("gltf-binary") || lower.includes("model/gltf") || lower.includes("model/gltf-binary")) return "glb";
      if (lower.includes("model/gltf+json")) return "gltf";
      return null;
    }
    const match = lower.match(/\.(glb|gltf|obj|stl)$/);
    return match ? match[1] : null;
  }

  private loadModelObject(path: string, extension: string): Promise<THREE.Object3D> {
    if (extension === "glb" || extension === "gltf") {
      return loadGLB(path);
    }
    if (extension === "obj") {
      const loader = new OBJLoader();
      return loader.loadAsync(path);
    }
    if (extension === "stl") {
      const loader = new STLLoader();
      return loader.loadAsync(path).then((geometry) => {
        const material = new THREE.MeshStandardMaterial({ color: "#d1d5db", roughness: 0.8 });
        return new THREE.Mesh(geometry, material);
      });
    }
    return Promise.reject(new Error("Unsupported model format"));
  }

  private updateModelsVerticalPosition(entry: {
    cadModels: Array<{ object: THREE.Object3D }>;
    height: number;
  }) {
    entry.cadModels.forEach((model) => {
      model.object.position.y = entry.height / 2;
    });
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  private handleCanvasClick = (event: MouseEvent) => {
    if (this.placementMode && this.onRoomElementPlaced) {
      const hit = this.getWallHitAtPointer(event);
      if (hit) {
        if (hit.type === "door") {
          this.roomBuilder.addDoor(hit.wallId, hit.config);
        } else {
          this.roomBuilder.addWindow(hit.wallId, hit.config);
        }
        this.onRoomElementPlaced(hit.wallId, hit.config, hit.type);
        this.setPlacementMode(null);
      }
      return;
    }
    const boxId = this.getBoxIdAtPointer(event);
    if (boxId) {
      this.setHoveredBox(boxId);
      this.setSelectedBox(boxId);
      this.onRoomElementSelected?.(null);
      return;
    }
    const roomHit = this.getRoomElementAtPointer(event);
    if (roomHit) {
      this.setHoveredBox(null);
      this.setSelectedBox(null);
      this.onRoomElementSelected?.(roomHit);
      return;
    }
    this.setHoveredBox(null);
    this.setSelectedBox(null);
    this.onRoomElementSelected?.(null);
  };

  private handleCanvasPointerMove = (event: PointerEvent) => {
    const id = this.getBoxIdAtPointer(event);
    this.setHoveredBox(id);
  };

  private handleCanvasPointerLeave = () => {
    this.setHoveredBox(null);
  };

  /** Obtém boxId a partir de um mesh (grupo ou filho/GLB); sobe na hierarquia até encontrar userData.boxId ou o grupo da caixa. */
  private getBoxIdByMesh(mesh: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = mesh;
    while (current) {
      const boxId = current.userData?.boxId as string | undefined;
      if (boxId && this.boxes.has(boxId)) return boxId;
      for (const [id, entry] of this.boxes.entries()) {
        if (entry.mesh === current) return id;
      }
      current = current.parent;
    }
    return null;
  }

  private setSelectedBox(id: string | null) {
    if (this.selectedBoxId === id) {
      this.onBoxSelected?.(id);
      return;
    }
    if (this.selectedBoxId && !this.ultraPerformanceMode) {
      const previous = this.boxes.get(this.selectedBoxId);
      if (previous) {
        this.releaseDetailMaps(previous);
      }
    }
    this.selectedBoxId = id;
    if (this.transformControls) {
      this.transformControls.detach();
      if (id && this.transformMode) {
        const entry = this.boxes.get(id);
        if (entry) {
          this.transformControls.attach(entry.mesh);
          this.transformControls.setMode(this.transformMode);
          (this.transformControls as unknown as THREE.Object3D).visible = true;
        }
      } else {
        (this.transformControls as unknown as THREE.Object3D).visible = false;
      }
    }
    if (id) {
      const entry = this.boxes.get(id);
      if (entry) {
        this.ensureMaterialDetailMaps(entry);
      }
    }
    this.refreshOutlineTarget();
    this.onBoxSelected?.(id);
  }

  private clampTransform() {
    if (!this.transformControls || !this.selectedBoxId) return;
    const obj = this.transformControls.object;
    if (!obj || !this.boxes.has(this.selectedBoxId)) return;
    const entry = this.boxes.get(this.selectedBoxId)!;
    if (obj !== entry.mesh) return;
    if (this.transformMode === "translate") {
      obj.position.y = entry.cadOnly ? 0 : entry.height / 2;
    } else if (this.transformMode === "rotate") {
      obj.rotation.x = 0;
      obj.rotation.z = 0;
    }
  }

  private notifyBoxTransform() {
    if (!this.selectedBoxId) return;
    const entry = this.boxes.get(this.selectedBoxId);
    if (!entry) return;
    const { x, y, z } = entry.mesh.position;
    this.onBoxTransform?.(this.selectedBoxId, { x, y, z }, entry.mesh.rotation.y);
  }

  private applyHighlight(_entry: { mesh: THREE.Object3D }) {
    this.refreshOutlineTarget();
  }

  private releaseDetailMaps(entry: {
    material: LoadedWoodMaterial | null;
    detailTextures?: {
      normal?: THREE.Texture | null;
      roughness?: THREE.Texture | null;
      metalness?: THREE.Texture | null;
      ao?: THREE.Texture | null;
    };
    detailMapsActive?: boolean;
  }) {
    if (!entry.material) return;
    const material = entry.material.material;
    if (!entry.detailTextures && entry.material.areDetailMapsLoaded()) {
      this.captureDetailTextures(entry);
    }
    material.normalMap = null;
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.aoMap = null;
    material.needsUpdate = true;
    entry.detailMapsActive = false;
  }

  private loadMaterial(materialName: string) {
    const preset = getMaterialPreset(this.materialSet, materialName);
    if (!preset || !preset.maps?.colorMap) return null;
    const maxAnisotropy = this.rendererManager.renderer.capabilities.getMaxAnisotropy();
    const anisotropy = Math.min(maxAnisotropy, 4);
    const loader = new THREE.TextureLoader();
    return createWoodMaterial(preset.maps, { ...preset.options, anisotropy }, loader);
  }

  private ensureMaterialDetailMaps(entry: {
    material: LoadedWoodMaterial | null;
    detailMapsRequested?: boolean;
    detailTextures?: {
      normal?: THREE.Texture | null;
      roughness?: THREE.Texture | null;
      metalness?: THREE.Texture | null;
      ao?: THREE.Texture | null;
    };
    detailMapsActive?: boolean;
  }) {
    if (!entry.material) return;
    if (entry.material.areDetailMapsLoaded()) {
      this.captureDetailTextures(entry);
      this.applyDetailMapState(entry);
      return;
    }
    if (this.ultraPerformanceMode) return;
    if (entry.detailMapsRequested) return;
    entry.detailMapsRequested = true;
    void entry.material
      .loadDetailMaps()
      .then(() => {
        entry.detailMapsRequested = false;
        this.captureDetailTextures(entry);
        this.applyDetailMapState(entry);
      })
      .catch(() => {
        entry.detailMapsRequested = false;
      });
  }

  private captureDetailTextures(entry: {
    material: LoadedWoodMaterial | null;
    detailTextures?: {
      normal?: THREE.Texture | null;
      roughness?: THREE.Texture | null;
      metalness?: THREE.Texture | null;
      ao?: THREE.Texture | null;
    };
  }) {
    if (!entry.material) return;
    const material = entry.material.material;
    const prev = entry.detailTextures;
    entry.detailTextures = {
      normal: material.normalMap ?? prev?.normal ?? null,
      roughness: material.roughnessMap ?? prev?.roughness ?? null,
      metalness: material.metalnessMap ?? prev?.metalness ?? null,
      ao: material.aoMap ?? prev?.ao ?? null,
    };
  }

  private applyDetailMapState(entry: {
    material: LoadedWoodMaterial | null;
    detailTextures?: {
      normal?: THREE.Texture | null;
      roughness?: THREE.Texture | null;
      metalness?: THREE.Texture | null;
      ao?: THREE.Texture | null;
    };
    detailMapsActive?: boolean;
  }) {
    if (!entry.material) return;
    const material = entry.material.material;
    if (!entry.detailTextures && entry.material.areDetailMapsLoaded()) {
      this.captureDetailTextures(entry);
    }
    if (this.ultraPerformanceMode) {
      if (entry.detailMapsActive !== false) {
        material.normalMap = null;
        material.roughnessMap = null;
        material.metalnessMap = null;
        material.aoMap = null;
        material.needsUpdate = true;
        entry.detailMapsActive = false;
      }
      return;
    }
    if (!entry.detailTextures) return;
    material.normalMap = entry.detailTextures.normal ?? null;
    material.roughnessMap = entry.detailTextures.roughness ?? null;
    material.metalnessMap = entry.detailTextures.metalness ?? null;
    material.aoMap = entry.detailTextures.ao ?? null;
    material.needsUpdate = true;
    entry.detailMapsActive = true;
  }

  private refreshOutlineTarget() {
    if (!this.selectionOutline || !this.selectionOutlineMaterial) return;
    const targetId = this.selectedBoxId ?? this.hoveredBoxId;
    if (!targetId) {
      this.selectionOutlineTarget = null;
      this.outlineTargetOpacity = 0;
      return;
    }
    const entry = this.boxes.get(targetId);
    if (!entry) {
      this.selectionOutlineTarget = null;
      this.outlineTargetOpacity = 0;
      return;
    }
    this.selectionOutlineTarget = entry.mesh;
    const isSelected = targetId === this.selectedBoxId;
    this.outlineTargetOpacity = isSelected ? 0.9 : 0.55;
    const colorHex = isSelected ? 0x38bdf8 : 0x7dd3fc;
    this.selectionOutlineMaterial.color.setHex(colorHex);
    this.selectionOutlineMaterial.needsUpdate = true;
    this.selectionOutline.visible = true;
    this.selectionOutline.update(entry.mesh);
  }

  private setHoveredBox(id: string | null) {
    if (this.hoveredBoxId === id) return;
    this.hoveredBoxId = id;
    this.refreshOutlineTarget();
  }

  private getBoxIdAtPointer(event: { clientX: number; clientY: number }) {
    const canvas = this.rendererManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.cameraManager.camera);
    const allMeshes: THREE.Object3D[] = [];
    this.boxes.forEach((entry) => {
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) allMeshes.push(child);
      });
    });
    const hits = this.raycaster.intersectObjects(allMeshes, false);
    if (!hits.length) return null;
    return this.getBoxIdByMesh(hits[0].object);
  }

  private getWallHitAtPointer(event: { clientX: number; clientY: number }): {
    wallId: number;
    config: DoorWindowConfig;
    type: "door" | "window";
  } | null {
    const roomGroup = this.roomBuilder.getGroup();
    const roomMeshes: THREE.Object3D[] = [];
    roomGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) roomMeshes.push(child);
    });
    if (!roomMeshes.length) return null;

    const canvas = this.rendererManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.cameraManager.camera);
    const hits = this.raycaster.intersectObjects(roomMeshes, true);
    if (!hits.length) return null;

    let wall: THREE.Mesh | null = null;
    const hitPoint = hits[0].point.clone();
    let current: THREE.Object3D | null = hits[0].object;
    while (current) {
      const wid = (current as THREE.Mesh & { userData?: { wallId?: number } }).userData?.wallId;
      if (typeof wid === "number" && current instanceof THREE.Mesh) {
        wall = current;
        break;
      }
      current = current.parent;
    }
    if (!wall) return null;

    const wallId = wall.userData.wallId as number;
    const wallLenMm = (wall.userData.wallLengthMm as number) ?? 4000;
    const wallHeightMm = (wall.userData.wallHeightMm as number) ?? 2700;
    wall.worldToLocal(hitPoint);

    const type = this.placementMode ?? "door";
    const baseConfig = type === "door" ? { ...DEFAULT_DOOR_CONFIG } : { ...DEFAULT_WINDOW_CONFIG };
    const wallLenM = wallLenMm / 1000;
    const horizLeftMm = (hitPoint.x + wallLenM / 2) * 1000 - baseConfig.widthMm / 2;
    const horizontalOffsetMm = Math.max(0, Math.min(wallLenMm - baseConfig.widthMm, horizLeftMm));
    const floorOffsetMm = Math.max(
      0,
      Math.min(wallHeightMm - baseConfig.heightMm, hitPoint.y * 1000 - baseConfig.heightMm / 2)
    );
    const config: DoorWindowConfig = {
      ...baseConfig,
      horizontalOffsetMm,
      floorOffsetMm,
    };
    return { wallId, config, type };
  }

  private getRoomElementAtPointer(event: { clientX: number; clientY: number }): {
    elementId: string;
    wallId: number;
    type: "door" | "window";
    config: DoorWindowConfig;
  } | null {
    const roomGroup = this.roomBuilder.getGroup();
    const roomMeshes: THREE.Object3D[] = [];
    roomGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData?.isRoomElement === true) {
        roomMeshes.push(child);
      }
    });
    if (!roomMeshes.length) return null;

    const canvas = this.rendererManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.cameraManager.camera);
    const hits = this.raycaster.intersectObjects(roomMeshes, true);
    if (!hits.length) return null;

    let current: THREE.Object3D | null = hits[0].object;
    while (current) {
      const elementId = current.userData?.elementId as string | undefined;
      const elementType = current.userData?.elementType as "door" | "window" | undefined;
      const config = current.userData?.config as DoorWindowConfig | undefined;
      if (elementId && elementType && config) {
        const wall = current.parent;
        const wallId = wall?.userData?.wallId as number | undefined;
        if (typeof wallId === "number") {
          return { elementId, wallId, type: elementType, config: { ...config } };
        }
      }
      current = current.parent;
    }
    return null;
  }

  private updateCanvasSize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth ?? 1;
    const h = this.container.clientHeight ?? 1;
    this.rendererManager.renderer.setSize(w, h);
    this.cameraManager.camera.aspect = w / h;
    this.cameraManager.camera.updateProjectionMatrix();
    this.updateShowcaseComposerSize();
    this.updateMainComposerSize();
  };

  private start() {
    const animate = () => {
      if (this.container && !this._initialCanvasSizeDone) {
        this.updateCanvasSize();
        this._initialCanvasSizeDone = true;
      }
      if (!this._diagnosticsLogged) {
        this._diagnosticsLogged = true;
        const exp = this.rendererManager.renderer.toneMappingExposure;
        if (exp <= 0) {
          this.rendererManager.renderer.toneMappingExposure = 1.05;
        }
        const { keyLight, fillLight, ambient, hemisphere } = this.lights;
        if (keyLight.intensity <= 0) keyLight.intensity = 0.55;
        if (fillLight.intensity <= 0) fillLight.intensity = 0.15;
        if (ambient.intensity <= 0) ambient.intensity = 0.4;
        if (hemisphere.intensity <= 0) hemisphere.intensity = 0.35;
        if (import.meta.env.PROD) {
          console.log(
            "[Viewer] Lights:",
            "key", keyLight.intensity,
            "fill", fillLight.intensity,
            "ambient", ambient.intensity,
            "hemi", hemisphere.intensity,
            "| Exposure:", this.rendererManager.renderer.toneMappingExposure
          );
          const first = this.boxes.values().next().value;
          if (first?.material?.material instanceof THREE.MeshStandardMaterial) {
            const m = first.material.material;
            console.log(
              "[Viewer] Material sample:",
              "color", m.color.getStyle(),
              "roughness", m.roughness,
              "envMapIntensity", m.envMapIntensity
            );
          }
        }
      }
      this.controls?.update();
      this.lerpLightsToTarget();
      this.updateExplodedView();
      if (this.selectionOutline && this.selectionOutlineMaterial) {
        this.outlineCurrentOpacity += (this.outlineTargetOpacity - this.outlineCurrentOpacity) * 0.25;
        const shouldShow = this.outlineCurrentOpacity > 0.02 && this.selectionOutlineTarget;
        if (shouldShow && this.selectionOutlineTarget) {
          this.selectionOutline.visible = true;
          this.selectionOutline.update(this.selectionOutlineTarget);
        } else if (!shouldShow) {
          this.selectionOutline.visible = false;
        }
        this.selectionOutlineMaterial.opacity = Math.max(0, Math.min(1, this.outlineCurrentOpacity));
        this.selectionOutlineMaterial.needsUpdate = true;
      }

      if (this.currentMode === "showcase" && this.composer && this.bokehPass) {
        this._boundingBox.makeEmpty();
        this.boxes.forEach((entry) => {
          this._boundingBox.expandByObject(entry.mesh);
        });
        this._boundingBox.getCenter(this._center);
        const cam = this.cameraManager.camera;
        const focusDist = cam.position.distanceTo(this._center);
        (this.bokehPass as { uniforms: Record<string, { value: number }> }).uniforms["focus"].value = focusDist;

        if (this.turntableEnabled && this.controls?.controls && this.currentMode === "showcase") {
          const target = this.controls.controls.target;
          const dx = cam.position.x - target.x;
          const dz = cam.position.z - target.z;
          const angle = this.turntableSpeed * 0.01;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          cam.position.x = target.x + dx * cos - dz * sin;
          cam.position.z = target.z + dx * sin + dz * cos;
          cam.lookAt(target);
        }

        this.composer.render();
      } else if (!this.ultraPerformanceMode) {
        if (!this.mainComposer) this.initMainComposer();
        if (this.mainComposer) {
          this.mainComposer.render();
        } else {
          this.rendererManager.render(this.sceneManager.scene, this.cameraManager.camera);
        }
      } else {
        this.rendererManager.render(this.sceneManager.scene, this.cameraManager.camera);
      }

      this.rafId = requestAnimationFrame(animate);
    };
    this.rafId = requestAnimationFrame(animate);
  }

  async renderScene(options: ViewerRenderOptions): Promise<ViewerRenderResult | null> {
    const sizeMap: Record<ViewerRenderOptions["size"], [number, number]> = {
      small: [1280, 720],
      medium: [1600, 900],
      large: [1920, 1080],
      "4k": [3840, 2160],
    };
    const [width, height] = sizeMap[options.size] ?? sizeMap.medium;
    const preset: ViewerCameraPreset = options.preset ?? "current";
    const applyWatermark = options.watermark ?? false;
    const format: ViewerRenderFormat = options.format ?? "png";
    const quality = format === "jpg" ? Math.max(0.1, Math.min(options.quality ?? 0.92, 1)) : 1;
    const shadowFactor = THREE.MathUtils.clamp(options.shadowIntensity ?? 1, 0, 1);
    const renderer = this.rendererManager.renderer;
    const scene = this.sceneManager.scene;
    const camera = this.cameraManager.camera;
    const controls = this.controls?.controls ?? null;

    const originalCameraPosition = camera.position.clone();
    const originalCameraQuaternion = camera.quaternion.clone();
    const originalCameraZoom = camera.zoom;
    const originalControlsTarget = controls ? controls.target.clone() : null;

    const originalLightState = {
      key: this.lights.keyLight.intensity,
      fill: this.lights.fillLight.intensity,
      ambient: this.lights.ambient.intensity,
      rim: this.lights.rimLight.intensity,
      castShadow: this.lights.keyLight.castShadow,
      shadowRadius: this.lights.keyLight.shadow.radius,
    };

    const applyPresetCamera = () => {
    if (preset === "current") return;
    if (this.boxes.size === 0) return;

    this._boundingBox.makeEmpty();
    this.boxes.forEach((entry) => {
      this._boundingBox.expandByObject(entry.mesh);
    });
    if (this._boundingBox.isEmpty()) return;
    this._boundingBox.getCenter(this._center);
    this._boundingBox.getSize(this._size);
    const center = this._center.clone();
    const maxDim = Math.max(this._size.x, this._size.y, this._size.z, 1);
    const distance = maxDim * 1.8;

    const offsets: Record<ViewerCameraPreset, THREE.Vector3> = {
      current: new THREE.Vector3().copy(camera.position),
      front: new THREE.Vector3(0, maxDim * 0.35, distance),
      top: new THREE.Vector3(0, distance, 0.001),
      iso1: new THREE.Vector3(distance * 0.9, distance * 0.7, distance * 0.9),
      iso2: new THREE.Vector3(-distance * 0.75, distance * 0.65, distance * 0.9),
    };

    const offset = offsets[preset] ?? offsets.current;
    camera.position.set(center.x + offset.x, center.y + offset.y, center.z + offset.z);

    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
    };

    const applyShadowIntensity = () => {
      const eased = 0.4 + shadowFactor * 0.6;
      this.lights.keyLight.intensity = originalLightState.key * eased;
      this.lights.fillLight.intensity = originalLightState.fill * (0.6 + shadowFactor * 0.4);
      this.lights.ambient.intensity = originalLightState.ambient * (0.7 + shadowFactor * 0.3);
      this.lights.rimLight.intensity = originalLightState.rim * (0.5 + shadowFactor * 0.5);
      this.lights.keyLight.castShadow = shadowFactor > 0.15 ? originalLightState.castShadow : false;
      this.lights.keyLight.shadow.radius = originalLightState.shadowRadius * (0.5 + shadowFactor * 0.5);
    };

    applyPresetCamera();
    applyShadowIntensity();

    if (options.mode === "pbr") {
      const selectedEntry = this.selectedBoxId
        ? this.boxes.get(this.selectedBoxId) ?? null
        : null;
      if (
        selectedEntry &&
        selectedEntry.material &&
        !selectedEntry.material.areDetailMapsLoaded() &&
        !this.ultraPerformanceMode
      ) {
        selectedEntry.detailMapsRequested = true;
        try {
          await selectedEntry.material.loadDetailMaps();
          selectedEntry.detailMapsRequested = false;
          this.captureDetailTextures(selectedEntry);
          this.applyDetailMapState(selectedEntry);
        } catch {
          selectedEntry.detailMapsRequested = false;
        }
      } else if (selectedEntry) {
        this.captureDetailTextures(selectedEntry);
        this.applyDetailMapState(selectedEntry);
      }
    }

    const prevPixelRatio = renderer.getPixelRatio();
    const prevRenderTarget = renderer.getRenderTarget();
    const prevClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const prevClearAlpha = renderer.getClearAlpha();
    const prevBackground = scene.background;
    const prevEnvironment = scene.environment;

    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: true,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
    });

    const swappedMaterials: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> = [];
    let linesMaterial: THREE.MeshBasicMaterial | null = null;

    try {
      renderer.setPixelRatio(1);
      renderer.setRenderTarget(renderTarget);

      if (options.background === "white") {
        renderer.setClearColor("#ffffff", 1);
        scene.background = new THREE.Color("#ffffff");
      } else {
        renderer.setClearColor("#000000", 0);
        scene.background = null;
      }

      if (options.mode === "lines") {
        linesMaterial = new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true });
        this.boxes.forEach((entry) => {
          entry.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              swappedMaterials.push({ mesh: child, material: child.material });
              child.material = linesMaterial!;
            }
          });
        });
        scene.environment = null;
      }

      renderer.render(scene, camera);

      const buffer = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }
      const imageData = context.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        const srcOffset = (height - y - 1) * width * 4;
        const dstOffset = y * width * 4;
        imageData.data.set(buffer.subarray(srcOffset, srcOffset + width * 4), dstOffset);
      }
      context.putImageData(imageData, 0, 0);

      if (applyWatermark) {
        const padding = Math.max(16, width * 0.02);
        const fontSize = Math.max(24, Math.round(width * 0.04));
        context.globalAlpha = 0.55;
        context.fillStyle = "#0f172a";
        context.font = `bold ${fontSize}px 'Segoe UI', 'Inter', sans-serif`;
        context.textAlign = "right";
        context.textBaseline = "bottom";
        context.fillText("PIMO", width - padding + 2, height - padding + 2);
        context.fillStyle = "#1e293b";
        context.fillText("PIMO", width - padding + 1, height - padding + 1);
        context.fillStyle = "#38bdf8";
        context.fillText("PIMO", width - padding, height - padding);
        context.globalAlpha = 1;
      }

      const dataUrl =
        format === "jpg"
          ? canvas.toDataURL("image/jpeg", quality)
          : canvas.toDataURL("image/png", 1);
      return { dataUrl, width, height };
    } finally {
      camera.position.copy(originalCameraPosition);
      camera.quaternion.copy(originalCameraQuaternion);
      camera.zoom = originalCameraZoom;
      camera.updateProjectionMatrix();
      if (controls && originalControlsTarget) {
        controls.target.copy(originalControlsTarget);
        controls.update();
      }
      this.lights.keyLight.intensity = originalLightState.key;
      this.lights.fillLight.intensity = originalLightState.fill;
      this.lights.ambient.intensity = originalLightState.ambient;
      this.lights.rimLight.intensity = originalLightState.rim;
      this.lights.keyLight.castShadow = originalLightState.castShadow;
      this.lights.keyLight.shadow.radius = originalLightState.shadowRadius;
      swappedMaterials.forEach(({ mesh, material }) => {
        mesh.material = material;
      });
      if (linesMaterial) {
        linesMaterial.dispose();
      }
      renderer.setRenderTarget(prevRenderTarget);
      renderer.setPixelRatio(prevPixelRatio);
      renderer.setClearColor(prevClearColor, prevClearAlpha);
      scene.background = prevBackground;
      scene.environment = prevEnvironment;
      renderTarget.dispose();
    }
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener("resize", this.updateCanvasSize);
    this.resizeObserver?.disconnect();
    this.disposeComposer();
    this.disposeMainComposer();
    this.controls?.dispose();
    if (this.transformControls) {
      this.transformControls.detach();
      if (this.transformControlsHelper) {
        this.sceneManager.scene.remove(this.transformControlsHelper);
        this.transformControlsHelper = null;
      }
      this.transformControls.dispose();
    }
    const canvas = this.rendererManager.renderer.domElement;
    canvas.removeEventListener("click", this.handleCanvasClick);
    canvas.removeEventListener("pointermove", this.handleCanvasPointerMove);
    canvas.removeEventListener("pointerleave", this.handleCanvasPointerLeave);
    if (this.envMap) {
      this.envMap.dispose();
    }
    this.pmremGenerator?.dispose();
    if (this.selectionOutline) {
      this.sceneManager.scene.remove(this.selectionOutline);
      this.selectionOutline.geometry.dispose();
      if (this.selectionOutlineMaterial) {
        this.selectionOutlineMaterial.dispose();
      }
      this.selectionOutline = null;
      this.selectionOutlineMaterial = null;
      this.selectionOutlineTarget = null;
    }
    
    // Limpar todos os caixotes corretamente
    this.clearBoxes();
    this.roomBuilder.clearRoom();

    this.sceneManager.dispose();
    this.rendererManager.dispose();
  }
}
