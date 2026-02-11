import * as THREE from "three";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
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
import type { EnvironmentOptions } from "./Environment";
import type {
  ViewerRenderOptions,
  ViewerRenderResult,
  ViewerCameraPreset,
  ViewerRenderFormat,
} from "../../context/projectTypes";
import { loadGLB } from "../../core/glb/glbLoader";
import { snapHorizontalOffset } from "../../utils/openingConstraints";
import {
  applyVisualMaterialToMesh as applyVisualMaterialToMeshV2,
  type VisualMaterial,
} from "../../core/materials/materialLibraryV2";

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
      cabinetType?: "lower" | "upper";
      pe_cm?: number;
      feetEnabled?: boolean;
      autoRotateEnabled?: boolean;
      cadModels: Array<{
        id: string;
        object: THREE.Object3D;
        path: string;
      }>;
      material: LoadedWoodMaterial | null;
    }
  >();
  private materialSet: MaterialSet;
  private defaultMaterialName = "mdf_branco";
  private boxGap = 0;
  private modelCounter = 0;
  private roomBuilder: RoomBuilder;
  private roomBoxGroup: THREE.Group | null = null;
  private roomBoxWalls: Array<{ id: number; normal: THREE.Vector3; mesh: THREE.Mesh }> = [];
  private roomBoxFloor: THREE.Mesh | null = null;
  private roomBoxCeiling: THREE.Mesh | null = null;
  private roomBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY: number;
    maxY: number;
    centerX: number;
    centerZ: number;
  } | null = null;
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
  private onWallSelected: ((_wallId: number | null) => void) | null = null;
  private onWallTransform: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null = null;
  private onRoomElementTransform: ((_elementId: string, _config: DoorWindowConfig) => void) | null = null;

  private selectedWallIndex: number | null = null;
  private selectedRoomElementId: string | null = null;

  /** Lock: quando ativo, impede que caixas entrem uma na outra e respeitam limites da sala (colisão). */
  private lockEnabled = false;
  /** True enquanto o utilizador arrasta o TransformControls (para não snapar rotação a cada frame). */
  private _isDragging = false;
  /** Quando lock desativado: caixas que intersectam paredes (para destaque vermelho). */
  private boxesIntersectingWalls = new Set<string>();
  /** Parede escondida manualmente (se existir). */
  private manualHiddenWallId: number | null = null;
  /** Cache para evitar recalcular auto-hide quando câmera não muda. */
  private lastWallHideCamPos = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  private lastWallHideDir = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  private lastWallHideManualId: number | null = null;

  /** Overlay de dimensões da caixa selecionada (modo Selecionar). */
  private dimensionsOverlayVisible = false;
  private dimensionsOverlayGroup: THREE.Group | null = null;
  private dimensionsOverlayLines: THREE.LineSegments | null = null;

  /** "performance" = leve, sem DOF/Bloom; "showcase" = DOF+Bloom+turntable */
  private currentMode: "performance" | "showcase" = "performance";
  private turntableEnabled = false;
  private turntableSpeed = 0.15;
  private lights: Lights;
  private selectionOutline: THREE.BoxHelper | null = null;
  private selectionOutlineTarget: THREE.Object3D | null = null;
  private selectionOutlineMaterial: THREE.LineBasicMaterial | null = null;
  /** Outline da parede selecionada (Room Box). */
  private wallSelectionOutline: THREE.BoxHelper | null = null;
  private wallSelectionOutlineMaterial: THREE.LineBasicMaterial | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private bokehPass: BokehPass | null = null;
  /** Compositor principal: RenderPass + bloom muito suave (modo atual). */
  private mainComposer: EffectComposer | null = null;
  private mainBloomPass: UnrealBloomPass | null = null;
  private ultraPerformanceMode = false;
  private defaultPixelRatio: number;
  private defaultGroundSize: number;
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
    this.defaultGroundSize = options.environment?.groundSize ?? 20;
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

    this.wallSelectionOutlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#3b82f6"),
      linewidth: 1,
      opacity: 0.9,
      transparent: true,
      depthTest: true,
    });
    this.wallSelectionOutline = new THREE.BoxHelper(new THREE.Object3D(), 0x3b82f6);
    if (this.wallSelectionOutlineMaterial) {
      (this.wallSelectionOutline.material as THREE.Material).dispose();
      this.wallSelectionOutline.material = this.wallSelectionOutlineMaterial;
    }
    this.wallSelectionOutline.visible = false;
    this.sceneManager.scene.add(this.wallSelectionOutline);

    this.roomBuilder = new RoomBuilder();
    this.sceneManager.add(this.roomBuilder.getGroup());

    this.materialSet = mergeMaterialSet(defaultMaterialSet);

    this.controls = options.enableControls === false
      ? null
      : new Controls(this.cameraManager.camera, this.rendererManager.renderer.domElement, options.controls);

    this.transformControls = new TransformControls(
      this.cameraManager.camera,
      this.rendererManager.renderer.domElement
    );
    this.transformControls.setSpace("world");
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this._isDragging = Boolean((event as { value: unknown }).value);
      if (this.controls?.controls) {
        this.controls.controls.enabled = !event.value;
      }
      if (!event.value) {
        this.clampTransform();
        this.notifyBoxTransform();
        this.notifyWallTransform();
        this.notifyRoomElementTransform();
      }
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

  setLockEnabled(enabled: boolean): void {
    this.lockEnabled = enabled;
    this.updateBoxesIntersectingWalls();
    this.refreshOutlineTarget();
  }

  getLockEnabled(): boolean {
    return this.lockEnabled;
  }

  getCombinedBoundingBox(): { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; width: number; height: number; depth: number } | null {
    if (this.boxes.size === 0) return null;
    this._boundingBox.makeEmpty();
    this.boxes.forEach((entry) => this._boundingBox.expandByObject(entry.mesh));
    const min = this._boundingBox.min.clone();
    const max = this._boundingBox.max.clone();
    this._boundingBox.getSize(this._size);
    return {
      min,
      max,
      size: this._size.clone(),
      width: this._size.x,
      height: this._size.y,
      depth: this._size.z,
    };
  }

  /**
   * Maior X (borda direita) das caixas em metros.
   * Usa bbox real quando disponível; quando bbox ainda não carregado (ex.: Group vazio) usa position + width/2.
   * Sem caixas retorna -0.1.
   */
  getRightmostX(): number {
    if (this.boxes.size === 0) return -0.1;
    let maxX = -Infinity;
    this.boxes.forEach((entry) => {
      entry.mesh.updateMatrixWorld(true);
      this._boundingBox.setFromObject(entry.mesh);
      this._boundingBox.getSize(this._size);
      const rightEdge =
        this._size.x < 0.001 || !Number.isFinite(this._boundingBox.max.x)
          ? entry.mesh.position.x + entry.width / 2
          : this._boundingBox.max.x;
      if (rightEdge > maxX) maxX = rightEdge;
    });
    return Number.isFinite(maxX) ? maxX : -0.1;
  }

  /** Dimensões da caixa selecionada (L, A, P). Usado no modo Selecionar para overlay. */
  getSelectedBoxDimensions(): { width: number; height: number; depth: number } | null {
    if (!this.selectedBoxId) return null;
    const entry = this.boxes.get(this.selectedBoxId);
    if (!entry) return null;
    return { width: entry.width, height: entry.height, depth: entry.depth };
  }

  setDimensionsOverlayVisible(visible: boolean): void {
    this.dimensionsOverlayVisible = visible;
    if (visible && !this.dimensionsOverlayGroup) this.createDimensionsOverlay();
    if (this.dimensionsOverlayGroup) this.dimensionsOverlayGroup.visible = visible;
  }

  getDimensionsOverlayVisible(): boolean {
    return this.dimensionsOverlayVisible;
  }

  /**
   * Posição em pixels (relativa ao container do viewer) do topo-centro da caixa selecionada.
   * Usado para posicionar o overlay de texto (dimensões + rotação) acima da caixa.
   */
  getSelectedBoxScreenPosition(): { x: number; y: number } | null {
    if (!this.selectedBoxId || !this.container) return null;
    const entry = this.boxes.get(this.selectedBoxId);
    if (!entry) return null;
    entry.mesh.updateMatrixWorld(true);
    this._boundingBox.setFromObject(entry.mesh);
    const min = this._boundingBox.min;
    const max = this._boundingBox.max;
    const topCenter = new THREE.Vector3(
      (min.x + max.x) * 0.5,
      max.y,
      (min.z + max.z) * 0.5
    );
    topCenter.project(this.cameraManager.camera);
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const x = (topCenter.x + 1) * 0.5 * w;
    const y = (1 - topCenter.y) * 0.5 * h;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private createDimensionsOverlay(): void {
    if (this.dimensionsOverlayGroup) return;
    this.dimensionsOverlayGroup = new THREE.Group();
    this.dimensionsOverlayGroup.name = "dimensionsOverlay";
    this.sceneManager.scene.add(this.dimensionsOverlayGroup);
    const mat = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1 });
    const geo = new THREE.BufferGeometry();
    this.dimensionsOverlayLines = new THREE.LineSegments(geo, mat);
    this.dimensionsOverlayGroup.add(this.dimensionsOverlayLines);
    this.dimensionsOverlayGroup.visible = this.dimensionsOverlayVisible;
  }

  private updateDimensionsOverlay(): void {
    if (!this.dimensionsOverlayVisible || !this.dimensionsOverlayLines) return;
    if (!this.selectedBoxId) {
      this.dimensionsOverlayLines.visible = false;
      return;
    }
    const entry = this.boxes.get(this.selectedBoxId);
    if (!entry) {
      this.dimensionsOverlayLines.visible = false;
      return;
    }
    entry.mesh.updateMatrixWorld(true);
    this._boundingBox.setFromObject(entry.mesh);
    const min = this._boundingBox.min.clone();
    const max = this._boundingBox.max.clone();
    this.dimensionsOverlayLines.visible = true;
    const vertices = new Float32Array([
      min.x, min.y, min.z, max.x, min.y, min.z,
      min.x, max.y, min.z, max.x, max.y, min.z,
      min.x, min.y, max.z, max.x, min.y, max.z,
      min.x, max.y, max.z, max.x, max.y, max.z,
      min.x, min.y, min.z, min.x, max.y, min.z,
      max.x, min.y, min.z, max.x, max.y, min.z,
      min.x, min.y, max.z, min.x, max.y, max.z,
      max.x, min.y, max.z, max.x, max.y, max.z,
      min.x, min.y, min.z, min.x, min.y, max.z,
      max.x, min.y, min.z, max.x, min.y, max.z,
      min.x, max.y, min.z, min.x, max.y, max.z,
      max.x, max.y, min.z, max.x, max.y, max.z,
    ]);
    this.dimensionsOverlayLines.geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    this.dimensionsOverlayLines.geometry.attributes.position.needsUpdate = true;
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
    if (this.selectedBoxId === id) {
      this.refreshOutlineTarget();
    }
  }

  /**
   * Aplica material visual (MaterialLibrary v2) a um mesh: cor base, roughness, metallic, e opcionalmente textura/UV.
   * Não substitui updateBoxMaterial; uso opcional para integração com presets e texturas.
   */
  applyVisualMaterialToMesh(mesh: THREE.Mesh, visualMaterial: VisualMaterial): void {
    applyVisualMaterialToMeshV2(mesh, visualMaterial);
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
    console.log("CAMERA MOVE", "setCameraFrontView");
    this.cameraManager.setPosition(0, 2.2, 6);
    this.updateCameraTarget();
  }

  addBox(id: string, options: BoxOptions = {}): boolean {
    if (this.boxes.has(id)) return false;
    const opts = options ?? {};
    const cadOnly = opts.cadOnly === true;
    const { width, height, depth } = this.getBoxDimensionsFromOptions(opts);
    const index = opts.index ?? this.getNextBoxIndex();
    const manualPosition = opts.manualPosition === true;

    let box: THREE.Object3D;
    let material: LoadedWoodMaterial | null = null;

    if (cadOnly) {
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
    box.userData.costaRotationY =
      opts.costaRotationY != null && Number.isFinite(opts.costaRotationY) ? opts.costaRotationY : 0;
    const baseY = height / 2;
    // Posição inicial aplicada IMEDIATAMENTE; sem recenter, clamp, colisão nem bbox antes.
    let position =
      manualPosition && opts.position
        ? { x: opts.position.x, y: opts.position.y, z: opts.position.z }
        : cadOnly
          ? { x: 0, y: baseY, z: 0 }
          : (opts.position ?? { x: 0, y: baseY, z: 0 });
    const cabinetType =
      opts.cabinetType === "lower" || opts.cabinetType === "upper"
        ? opts.cabinetType
        : undefined;
    const feetEnabled = opts.feetEnabled ?? true;
    if (cabinetType === "lower" && feetEnabled) {
      position = {
        ...position,
        y: this.getFixedYForCabinet({ height, cabinetType, pe_cm: opts.pe_cm }),
      };
    }
    box.position.set(position.x, position.y, position.z);
    if (opts.rotationY != null && Number.isFinite(opts.rotationY)) {
      box.rotation.y = opts.rotationY;
    }
    // Registar em this.boxes ANTES de adicionar à cena (getRightmostX e restante lógica usam este mapa).
    this.boxes.set(id, {
      mesh: box,
      width,
      height,
      depth,
      index,
      cadOnly: cadOnly || undefined,
      manualPosition,
      cabinetType: cabinetType ?? undefined,
      pe_cm: opts.pe_cm,
      feetEnabled,
      autoRotateEnabled: opts.autoRotateEnabled !== false,
      cadModels: [],
      material,
    });
    this.sceneManager.add(box);
    if (this.roomBounds && this.isMeshInsideOrTouchingRoom(box)) {
      this.applyAutoRotateToRoom(box, { snapPosition: this.lockEnabled });
      if (this.lockEnabled) this.applyRoomConstraint(box, { ignoreY: manualPosition });
    }
    // reflowBoxes não altera caixas com manualPosition; clampTransform só em objectChange (arraste).
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
    const structureChanged =
      dimensionsChanged ||
      opts.shelves !== undefined ||
      opts.doors !== undefined ||
      opts.drawers !== undefined ||
      opts.hingeType !== undefined ||
      opts.runnerType !== undefined;

    if (structureChanged) {
      width = Math.max(0.001, opts.width ?? opts.size ?? width);
      height = Math.max(0.001, opts.height ?? opts.size ?? height);
      depth = Math.max(0.001, opts.depth ?? opts.size ?? depth);
      heightChanged = height !== entry.height;
      if (!entry.cadOnly) {
        const fullOpts: Partial<BoxOptions> = {
          width: opts.width ?? width,
          height: opts.height ?? height,
          depth: opts.depth ?? depth,
          thickness: opts.thickness,
          shelves: opts.shelves,
          doors: opts.doors,
          hingeType: opts.hingeType,
          drawers: opts.drawers,
          runnerType: opts.runnerType,
        };
        const updated =
          entry.mesh instanceof THREE.Group
            ? updateBoxGroup(entry.mesh, fullOpts)
            : updateBoxGeometry(entry.mesh as THREE.Mesh, fullOpts);
        width = updated.width;
        height = updated.height;
        depth = updated.depth;
      }
      if (entry.cadOnly && !entry.manualPosition) {
        entry.mesh.position.y = height / 2;
      }
    }
    if (opts.index !== undefined && opts.index !== entry.index) {
      entry.index = opts.index;
      indexChanged = true;
    }
    if (opts.materialName && !entry.cadOnly) {
      this.updateBoxMaterial(id, opts.materialName);
    }
    if (opts.cabinetType !== undefined) {
      entry.cabinetType =
        opts.cabinetType === "lower" || opts.cabinetType === "upper"
          ? opts.cabinetType
          : undefined;
    }
    if (opts.pe_cm !== undefined) entry.pe_cm = opts.pe_cm;
    if (opts.feetEnabled !== undefined) entry.feetEnabled = opts.feetEnabled;
    if (opts.autoRotateEnabled !== undefined) entry.autoRotateEnabled = opts.autoRotateEnabled;
    if (entry.manualPosition && !opts.position) {
      // Nunca alterar position.x/y/z quando manualPosition sem opts.position explícito.
    } else if (opts.position && !this.shouldUseFeetLock(entry)) {
      entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
    } else if (this.shouldUseFeetLock(entry)) {
      const fixedY = this.getFixedYForCabinet({
        height,
        cabinetType: entry.cabinetType,
        pe_cm: entry.pe_cm,
      });
      if (opts.position) {
        entry.mesh.position.set(opts.position.x, fixedY, opts.position.z);
      } else {
        entry.mesh.position.y = fixedY;
      }
    } else if (opts.position) {
      entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
    } else if (!entry.manualPosition) {
      entry.mesh.position.y = height / 2;
    }
    if (opts.rotationY != null && Number.isFinite(opts.rotationY)) {
      entry.mesh.rotation.y = opts.rotationY;
    }
    if (opts.costaRotationY !== undefined) {
      (entry.mesh as THREE.Object3D & { userData: { costaRotationY?: number } }).userData.costaRotationY =
        Number.isFinite(opts.costaRotationY) ? opts.costaRotationY : 0;
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
    if (this.roomBounds && this.isMeshInsideOrTouchingRoom(entry.mesh)) {
      this.applyAutoRotateToRoom(entry.mesh, { snapPosition: this.lockEnabled });
      if (this.lockEnabled) this.applyRoomConstraint(entry.mesh, { ignoreY: entry.manualPosition });
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
    void config;
    // Sistema de sala desativado temporariamente.
    this.clearRoomBounds();
  }

  removeRoom(): void {
    this.clearRoomBounds();
  }

  private clearRoomBox(): void {
    if (this.roomBoxGroup) {
      this.sceneManager.root.remove(this.roomBoxGroup);
    }
    this.roomBoxWalls.forEach((w) => {
      w.mesh.geometry.dispose();
      if (Array.isArray(w.mesh.material)) {
        w.mesh.material.forEach((m) => m.dispose());
      } else {
        w.mesh.material.dispose();
      }
    });
    if (this.roomBoxFloor) {
      this.roomBoxFloor.geometry.dispose();
      if (Array.isArray(this.roomBoxFloor.material)) {
        this.roomBoxFloor.material.forEach((m) => m.dispose());
      } else {
        this.roomBoxFloor.material.dispose();
      }
    }
    if (this.roomBoxCeiling) {
      this.roomBoxCeiling.geometry.dispose();
      if (Array.isArray(this.roomBoxCeiling.material)) {
        this.roomBoxCeiling.material.forEach((m) => m.dispose());
      } else {
        this.roomBoxCeiling.material.dispose();
      }
    }
    this.roomBoxGroup = null;
    this.roomBoxWalls = [];
    this.roomBoxFloor = null;
    this.roomBoxCeiling = null;
  }

  createRoomBox(bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY: number;
    maxY: number;
    centerX: number;
    centerZ: number;
  }): void {
    this.clearRoomBox();
    const { minX, maxX, minZ, maxZ, minY, maxY, centerX, centerZ } = bounds;
    const width = Math.max(0.01, maxX - minX);
    const depth = Math.max(0.01, maxZ - minZ);
    const height = Math.max(0.01, maxY - minY);
    const t = Viewer.ROOM_WALL_THICKNESS_M;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.75,
      metalness: 0.05,
      transparent: true,
      opacity: 0.8,
    });

    const group = new THREE.Group();
    group.name = "roomBox";

    const front = new THREE.Mesh(new THREE.BoxGeometry(width, height, t), wallMat.clone());
    front.position.set(centerX, minY + height / 2, minZ - t / 2);
    front.userData.wallId = 0;
    front.userData.wallNormal = new THREE.Vector3(0, 0, -1);
    front.userData.isRoomWall = true;
    front.userData.wallLengthMm = width * 1000;
    front.userData.wallHeightMm = height * 1000;
    front.userData.wallThicknessM = t;
    group.add(front);

    const right = new THREE.Mesh(new THREE.BoxGeometry(depth, height, t), wallMat.clone());
    right.rotation.y = Math.PI / 2;
    right.position.set(maxX + t / 2, minY + height / 2, centerZ);
    right.userData.wallId = 1;
    right.userData.wallNormal = new THREE.Vector3(-1, 0, 0);
    right.userData.isRoomWall = true;
    right.userData.wallLengthMm = depth * 1000;
    right.userData.wallHeightMm = height * 1000;
    right.userData.wallThicknessM = t;
    group.add(right);

    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, t), wallMat.clone());
    back.position.set(centerX, minY + height / 2, maxZ + t / 2);
    back.userData.wallId = 2;
    back.userData.wallNormal = new THREE.Vector3(0, 0, 1);
    back.userData.isRoomWall = true;
    back.userData.wallLengthMm = width * 1000;
    back.userData.wallHeightMm = height * 1000;
    back.userData.wallThicknessM = t;
    group.add(back);

    const left = new THREE.Mesh(new THREE.BoxGeometry(depth, height, t), wallMat.clone());
    left.rotation.y = Math.PI / 2;
    left.position.set(minX - t / 2, minY + height / 2, centerZ);
    left.userData.wallId = 3;
    left.userData.wallNormal = new THREE.Vector3(1, 0, 0);
    left.userData.isRoomWall = true;
    left.userData.wallLengthMm = depth * 1000;
    left.userData.wallHeightMm = height * 1000;
    left.userData.wallThicknessM = t;
    group.add(left);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), wallMat.clone());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, minY, centerZ);
    floor.userData.isRoomFloor = true;
    group.add(floor);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), wallMat.clone());
    ceiling.position.set(centerX, maxY + t / 2, centerZ);
    ceiling.userData.isRoomCeiling = true;
    group.add(ceiling);

    this.sceneManager.root.add(group);
    this.roomBoxGroup = group;
    this.roomBoxWalls = [
      { id: 0, normal: new THREE.Vector3(0, 0, -1), mesh: front },
      { id: 1, normal: new THREE.Vector3(-1, 0, 0), mesh: right },
      { id: 2, normal: new THREE.Vector3(0, 0, 1), mesh: back },
      { id: 3, normal: new THREE.Vector3(1, 0, 0), mesh: left },
    ];
    this.roomBoxFloor = floor;
    this.roomBoxCeiling = ceiling;
  }

  setRoomBounds(bounds: {
    width: number;
    depth: number;
    height: number;
    originX?: number;
    originZ?: number;
  }): void {
    void bounds;
    // Sistema de sala desativado temporariamente.
    this.clearRoomBounds();
  }

  clearRoomBounds(): void {
    this.roomBounds = null;
    this.sceneManager.setGroundSize(this.defaultGroundSize, this.defaultGroundSize);
    this.sceneManager.setGroundPosition(0, 0);
    this.clearRoomBox();
    this.roomBuilder.clearRoom(true);
  }

  /**
   * Reposiciona a câmera numa vista pré-definida (lookAt no centro da sala).
   * Sem sala: usa centro (0, 0, 0) e dimensões padrão.
   */
  setCameraView(
    preset: "top" | "bottom" | "front" | "back" | "right" | "left" | "isometric"
  ): void {
    console.log("CAMERA MOVE", `setCameraView:${preset}`);
    const centerX = this.roomBounds?.centerX ?? 0;
    const centerZ = this.roomBounds?.centerZ ?? 0;
    const minX = this.roomBounds?.minX ?? -2;
    const maxX = this.roomBounds?.maxX ?? 2;
    const minZ = this.roomBounds?.minZ ?? -1.5;
    const maxZ = this.roomBounds?.maxZ ?? 1.5;
    const roomHeight = this.roomBounds ? this.roomBounds.maxY - this.roomBounds.minY : 2.8;
    const roomWidth = maxX - minX;
    const roomDepth = maxZ - minZ;
    const dist = Math.max(roomWidth, roomDepth, roomHeight) * 1.2;

    this.cameraManager.setTarget(centerX, 0, centerZ);

    switch (preset) {
      case "top":
        this.cameraManager.setPosition(centerX, roomHeight * 2, centerZ);
        break;
      case "bottom":
        this.cameraManager.setPosition(centerX, -roomHeight * 0.5, centerZ);
        break;
      case "front":
        this.cameraManager.setPosition(centerX, roomHeight * 0.8, minZ - dist);
        break;
      case "back":
        this.cameraManager.setPosition(centerX, roomHeight * 0.8, maxZ + dist);
        break;
      case "right":
        this.cameraManager.setPosition(maxX + dist, roomHeight * 0.8, centerZ);
        break;
      case "left":
        this.cameraManager.setPosition(minX - dist, roomHeight * 0.8, centerZ);
        break;
      case "isometric":
      default:
        this.cameraManager.setPosition(
          minX + roomWidth * 0.8,
          roomHeight * 1.2,
          minZ + roomDepth * 0.8
        );
        break;
    }
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

  setOnWallSelected(callback: ((_wallId: number | null) => void) | null): void {
    this.onWallSelected = callback;
  }

  setOnWallTransform(callback: ((_wallIndex: number, _position: { x: number; z: number }, _rotation: number) => void) | null): void {
    this.onWallTransform = callback;
  }

  setOnRoomElementTransform(callback: ((_elementId: string, _config: DoorWindowConfig) => void) | null): void {
    this.onRoomElementTransform = callback;
  }

  updateRoomElementConfig(elementId: string, config: DoorWindowConfig): boolean {
    return this.roomBuilder.updateElementConfig(elementId, config);
  }

  addDoorToRoom(wallId: number, config: DoorWindowConfig): string {
    return this.roomBuilder.addDoorByIndex(wallId, config);
  }

  addWindowToRoom(wallId: number, config: DoorWindowConfig): string {
    return this.roomBuilder.addWindowByIndex(wallId, config);
  }

  getRoomWalls(): THREE.Mesh[] {
    return this.roomBoxWalls.map((w) => w.mesh);
  }

  /** Seleciona parede por índice (ex.: ao clicar na lista do painel). Atualiza TransformControls. */
  selectWallByIndex(index: number | null): void {
    void index;
    this.selectedWallIndex = null;
  }

  /** Seleciona abertura (porta/janela) por id (ex.: ao clicar no painel). Permite mover/rodar com botões do topo. */
  selectRoomElementById(elementId: string | null): void {
    void elementId;
    this.selectedRoomElementId = null;
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
    this.refreshTransformControlsAttachment();
  }

  /** Anexa ou desanexa TransformControls conforme seleção (caixa, parede ou abertura). */
  private refreshTransformControlsAttachment(): void {
    if (!this.transformControls) return;
    const mode = this.transformMode;
    if (this.selectedBoxId && mode) {
      const entry = this.boxes.get(this.selectedBoxId);
      if (entry) {
        this.transformControls.detach();
        this.transformControls.attach(entry.mesh);
        this.transformControls.setMode(mode);
        if (this.transformControlsHelper) this.transformControlsHelper.visible = true;
        return;
      }
    }
    if (this.selectedWallIndex !== null && mode) {
      const wall = this.roomBoxWalls.find((w) => w.id === this.selectedWallIndex)?.mesh;
      if (wall) {
        this.transformControls.detach();
        this.transformControls.attach(wall);
        this.transformControls.setMode(mode);
        if (this.transformControlsHelper) this.transformControlsHelper.visible = true;
        return;
      }
    }
    if (this.selectedRoomElementId && mode) {
      const element = this.roomBuilder.getElementById(this.selectedRoomElementId);
      if (element) {
        this.transformControls.detach();
        this.transformControls.attach(element);
        this.transformControls.setMode(mode);
        if (this.transformControlsHelper) this.transformControlsHelper.visible = true;
        return;
      }
    }
    this.transformControls.detach();
    if (this.transformControlsHelper) this.transformControlsHelper.visible = false;
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

  /**
   * Normaliza o pivot do modelo: centro em X/Z na origem do grupo, base no chão (y=0).
   * Usado para modelos do Catálogo e CAD-only para que não nasçam com pivot no meio (centro da tela).
   * Altera apenas object.position (filho); a posição do grupo (entry.mesh) não é tocada.
   */
  private centerObjectInGroup(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    this._boundingBox.setFromObject(object);
    this._boundingBox.getCenter(this._center);
    this._boundingBox.getSize(this._size);
    object.position.x = -this._center.x;
    object.position.z = -this._center.z;
    object.position.y = this._size.y / 2;
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

  /** Ajusta escala do GLB de catálogo e normaliza pivot (base no chão, centro XZ). Grupo não é movido. */
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
   * Posiciona caixas sem manualPosition lado a lado em X/Z.
   * manualPosition === true: NUNCA alterar position.x, position.y nem position.z.
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
      if (entry.manualPosition) {
        // Nunca alterar position: caixa posicionada pelo ProjectProvider (rightmost + 0.1, Y=altura/2, Z=0).
      } else {
        entry.mesh.position.x = cursorX + w / 2;
        entry.mesh.position.z = 0;
      }
      entry.mesh.updateMatrixWorld();
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

  private shouldUseFeetLock(entry: {
    cabinetType?: "lower" | "upper";
    feetEnabled?: boolean;
  }): boolean {
    return entry.cabinetType === "lower" && entry.feetEnabled !== false;
  }

  /** Altura Y (m) fixa para caixas inferiores com pés ativos. */
  private getFixedYForCabinet(entry: {
    height: number;
    cabinetType?: "lower" | "upper";
    pe_cm?: number;
  }): number {
    const h = entry.height;
    if (entry.cabinetType === "lower") {
      const peM = ((entry.pe_cm ?? Viewer.HEIGHT_BASE_CM) / 100);
      return peM + h / 2;
    }
    if (entry.cabinetType === "upper") {
      const baseM = Viewer.HEIGHT_UPPER_CM / 100;
      return baseM + h / 2;
    }
    return h / 2;
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
          this.roomBuilder.addDoorByIndex(hit.wallId, hit.config);
        } else {
          this.roomBuilder.addWindowByIndex(hit.wallId, hit.config);
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
      this.onWallSelected?.(null);
      return;
    }
    const roomHit = this.getRoomElementAtPointer(event);
    if (roomHit) {
      this.setHoveredBox(null);
      this.selectedBoxId = null;
      this.selectedWallIndex = null;
      this.selectedRoomElementId = roomHit.elementId;
      this.refreshTransformControlsAttachment();
      this.refreshOutlineTarget();
      this.onBoxSelected?.(null);
      this.onRoomElementSelected?.(roomHit);
      this.onWallSelected?.(null);
      return;
    }
    const wallId = this.getWallIdAtPointer(event);
    if (wallId !== null) {
      this.setHoveredBox(null);
      this.selectedBoxId = null;
      this.selectedWallIndex = wallId;
      this.selectedRoomElementId = null;
      this.refreshTransformControlsAttachment();
      this.refreshOutlineTarget();
      this.onBoxSelected?.(null);
      this.onRoomElementSelected?.(null);
      this.onWallSelected?.(wallId);
      return;
    }
    this.setHoveredBox(null);
    this.selectedBoxId = null;
    this.selectedWallIndex = null;
    this.selectedRoomElementId = null;
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
    this.onBoxSelected?.(null);
    this.onRoomElementSelected?.(null);
    this.onWallSelected?.(null);
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
    this.selectedBoxId = id;
    this.selectedWallIndex = null;
    this.selectedRoomElementId = null;
    this.refreshTransformControlsAttachment();
    this.refreshOutlineTarget();
    this.onBoxSelected?.(id);
  }

  /** Só chamado em objectChange (arraste do utilizador). Nunca na criação da caixa. */
  private clampTransform() {
    if (!this.transformControls) return;
    const obj = this.transformControls.object;
    if (!obj) return;
    if (this.selectedBoxId && this.boxes.has(this.selectedBoxId)) {
      const entry = this.boxes.get(this.selectedBoxId)!;
      if (obj === entry.mesh) {
        if (this.transformMode === "translate") {
          obj.updateMatrixWorld(true);
          this._boundingBox.setFromObject(obj);
          if (this._boundingBox.min.y < 0) obj.position.y -= this._boundingBox.min.y;
          if (this.lockEnabled) {
            this.applyCollisionConstraint(obj);
          }
          if (this.roomBounds && this.isMeshInsideOrTouchingRoom(obj)) {
            if (!this._isDragging) {
              this.applyAutoRotateToRoom(obj, { snapPosition: this.lockEnabled });
            }
            if (this.lockEnabled) {
              this.applyRoomConstraint(obj, { ignoreY: entry.manualPosition });
            }
          }
          if (this.shouldUseFeetLock(entry) && !entry.manualPosition) {
            obj.position.y = this.getFixedYForCabinet(entry);
          }
          this.updateBoxesIntersectingWalls();
        } else if (this.transformMode === "rotate") {
          obj.rotation.x = 0;
          obj.rotation.z = 0;
          if (!this._isDragging && this.roomBounds && this.isMeshInsideOrTouchingRoom(obj)) {
            (obj as THREE.Object3D & { rotation: { y: number } }).rotation.y = Viewer.snapRotationTo90(
              (obj as THREE.Object3D & { rotation: { y: number } }).rotation.y
            );
          }
        }
        return;
      }
    }
    if (this.selectedWallIndex !== null && this.roomBoxWalls.find((w) => w.id === this.selectedWallIndex)?.mesh === obj) {
      if (this.transformMode === "translate") {
        const wall = obj as THREE.Mesh;
        const heightM = ((wall.userData.wallHeightMm as number | undefined) ?? 2700) * 0.001;
        if (wall.position.y < heightM / 2) wall.position.y = heightM / 2;
      } else if (this.transformMode === "rotate") {
        (obj as THREE.Mesh).rotation.x = 0;
        (obj as THREE.Mesh).rotation.z = 0;
      }
    }
  }

  /** Lock ON: impede interpenetração em X, Y e Z (várias passagens até não haver sobreposição). */
  private applyCollisionConstraint(movingMesh: THREE.Object3D): void {
    const maxIterations = 8;
    for (let iter = 0; iter < maxIterations; iter++) {
      movingMesh.updateMatrixWorld(true);
      const movingBox = new THREE.Box3().setFromObject(movingMesh);
      let anyOverlap = false;
      this.boxes.forEach((entry, boxId) => {
        if (boxId === this.selectedBoxId) return;
        entry.mesh.updateMatrixWorld(true);
        const otherBox = new THREE.Box3().setFromObject(entry.mesh);
        if (!movingBox.intersectsBox(otherBox)) return;
        anyOverlap = true;

        const overlapX = Math.max(0, Math.min(movingBox.max.x, otherBox.max.x) - Math.max(movingBox.min.x, otherBox.min.x));
        const overlapZ = Math.max(0, Math.min(movingBox.max.z, otherBox.max.z) - Math.max(movingBox.min.z, otherBox.min.z));
        const overlapY = Math.max(0, Math.min(movingBox.max.y, otherBox.max.y) - Math.max(movingBox.min.y, otherBox.min.y));
        const minOverlap = Math.min(overlapX, overlapZ, overlapY);
        if (minOverlap <= 0) return;

        const movingCenter = new THREE.Vector3();
        movingBox.getCenter(movingCenter);
        const otherCenter = new THREE.Vector3();
        otherBox.getCenter(otherCenter);

        if (minOverlap === overlapX) {
          const move = movingCenter.x < otherCenter.x ? otherBox.min.x - movingBox.max.x : otherBox.max.x - movingBox.min.x;
          movingMesh.position.x += move;
        } else if (minOverlap === overlapZ) {
          const move = movingCenter.z < otherCenter.z ? otherBox.min.z - movingBox.max.z : otherBox.max.z - movingBox.min.z;
          movingMesh.position.z += move;
        } else {
          const move = movingCenter.y < otherCenter.y ? otherBox.min.y - movingBox.max.y : otherBox.max.y - movingBox.min.y;
          movingMesh.position.y += move;
        }
      });
      if (!anyOverlap) break;
    }
  }

  /** Atualiza o conjunto de caixas que intersectam paredes (para destaque quando lock desativado). */
  private updateBoxesIntersectingWalls(): void {
    this.boxesIntersectingWalls.clear();
    if (this.lockEnabled) return;
    const roomWalls = this.roomBoxWalls.map((w) => w.mesh);
    if (!roomWalls.length) return;
    const wallBox = new THREE.Box3();
    roomWalls.forEach((wall) => {
      wall.updateMatrixWorld(true);
      wallBox.union(new THREE.Box3().setFromObject(wall));
    });
    this.boxes.forEach((entry, boxId) => {
      entry.mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(entry.mesh);
      if (box.intersectsBox(wallBox)) this.boxesIntersectingWalls.add(boxId);
    });
  }

  /** Esconde a parede que está entre a câmera e o centro da sala. */
  private updateWallVisibilityBasedOnCamera(): void {
    if (!this.roomBounds) return;
    const cam = this.cameraManager.camera;
    const centerY = (this.roomBounds.minY + this.roomBounds.maxY) / 2;
    const center = new THREE.Vector3(this.roomBounds.centerX, centerY, this.roomBounds.centerZ);
    const dir = center.clone().sub(cam.position);
    if (dir.lengthSq() < 1e-6) return;
    if (
      this.lastWallHideCamPos.distanceToSquared(cam.position) < 1e-6 &&
      this.lastWallHideDir.distanceToSquared(dir) < 1e-6 &&
      this.lastWallHideManualId === this.manualHiddenWallId
    ) {
      return;
    }
    this.lastWallHideCamPos.copy(cam.position);
    this.lastWallHideDir.copy(dir);
    this.lastWallHideManualId = this.manualHiddenWallId;

    const roomWalls = this.roomBoxWalls.map((w) => w.mesh);
    if (!roomWalls.length) return;
    this.raycaster.set(cam.position, dir.normalize());
    const hits = this.raycaster.intersectObjects(roomWalls, false);
    const hitWall = hits.length ? hits[0].object : null;
    this.roomBoxWalls.forEach((entry) => {
      let visible = entry.mesh !== hitWall;
      if (this.manualHiddenWallId !== null && entry.id === this.manualHiddenWallId) {
        visible = false;
      }
      entry.mesh.visible = visible;
    });
  }

  private getWallIdInFrontOfCamera(): number | null {
    if (!this.roomBounds) return null;
    const cam = this.cameraManager.camera;
    const centerY = (this.roomBounds.minY + this.roomBounds.maxY) / 2;
    const center = new THREE.Vector3(this.roomBounds.centerX, centerY, this.roomBounds.centerZ);
    const dir = center.clone().sub(cam.position);
    if (dir.lengthSq() < 1e-6) return null;
    const roomWalls = this.roomBoxWalls.map((w) => w.mesh);
    if (!roomWalls.length) return null;
    this.raycaster.set(cam.position, dir.normalize());
    const hits = this.raycaster.intersectObjects(roomWalls, false);
    const hitWall = hits.length ? hits[0].object : null;
    if (!hitWall) return null;
    const entry = this.roomBoxWalls.find((w) => w.mesh === hitWall);
    return entry?.id ?? null;
  }

  /** Esconde/mostra uma parede manualmente. Auto-hide continua ativo. */
  setManualWallHidden(active: boolean): void {
    if (!active) {
      this.manualHiddenWallId = null;
      this.roomBoxWalls.forEach((w) => {
        w.mesh.visible = true;
      });
      return;
    }
    const wallId = this.selectedWallIndex ?? this.getWallIdInFrontOfCamera();
    if (wallId === null) return;
    this.manualHiddenWallId = wallId;
    this.roomBoxWalls.forEach((w) => {
      if (w.id === wallId) w.mesh.visible = false;
    });
  }

  getManualWallHidden(): boolean {
    return this.manualHiddenWallId !== null;
  }

  /**
   * Restringe a caixa aos limites da sala.
   * Sempre: nunca sair de [0→width]×[0→depth]. Com lock ON: usar limites internos (inset) para não entrar no muro.
   */
  private applyRoomConstraint(movingMesh: THREE.Object3D, options: { ignoreY?: boolean } = {}): void {
    if (!this.roomBounds) return;
    movingMesh.updateMatrixWorld(true);
    const movingBox = new THREE.Box3().setFromObject(movingMesh);
    const inset = this.lockEnabled ? Viewer.WALL_INNER_INSET_M : 0;
    const off = this.lockEnabled ? Viewer.SNAP_WALL_OFFSET_M : 0;
    const minX = this.roomBounds.minX + inset + off;
    const maxX = this.roomBounds.maxX - inset - off;
    const minZ = this.roomBounds.minZ + inset + off;
    const maxZ = this.roomBounds.maxZ - inset - off;
    const minY = this.roomBounds.minY;
    const maxY = this.roomBounds.maxY;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (movingBox.min.x < minX) dx += minX - movingBox.min.x;
    if (movingBox.max.x > maxX) dx -= movingBox.max.x - maxX;
    if (movingBox.min.z < minZ) dz += minZ - movingBox.min.z;
    if (movingBox.max.z > maxZ) dz -= movingBox.max.z - maxZ;
    if (!options.ignoreY) {
      if (movingBox.min.y < minY) dy += minY - movingBox.min.y;
      if (movingBox.max.y > maxY) dy -= movingBox.max.y - maxY;
    }
    if (dx !== 0 || dy !== 0 || dz !== 0) {
      movingMesh.position.x += dx;
      movingMesh.position.y += dy;
      movingMesh.position.z += dz;
    }
  }

  /** Espessura das paredes (m) do Room Box. */
  private static readonly ROOM_WALL_THICKNESS_M = 0.12;
  /** Recuo (m) do limite interno da parede; com lock ON a caixa não entra no muro. */
  private static readonly WALL_INNER_INSET_M = 0.06;
  /** Tolerância (m) para eliminar gap residual entre costa e parede (1–3 mm). */
  private static readonly SNAP_GAP_TOLERANCE_M = 0.003;
  /** Offset (m) da caixa em relação ao plano da parede para evitar Z-fighting (0.5 cm). */
  private static readonly SNAP_WALL_OFFSET_M = 0.005;
  /** Logs temporários para diagnosticar rotação/snap por parede. */
  private static readonly DEBUG_WALL_ROTATION = !import.meta.env.PROD;
  /** Altura da base do armário inferior (PE) em cm; base da caixa fica a esta altura do piso. */
  private static readonly HEIGHT_BASE_CM = 10;
  /** Altura em cm do piso à base da caixa superior (wall cabinet). */
  private static readonly HEIGHT_UPPER_CM = 150;

  /** Garante rotação sempre múltiplo de 90° (0, π/2, π, -π/2). */
  private static snapRotationTo90(rad: number): number {
    let deg = (rad * 180) / Math.PI;
    deg = Math.round(deg / 90) * 90;
    deg = ((deg % 360) + 360) % 360;
    if (deg === 360) deg = 0;
    return (deg * Math.PI) / 180;
  }

  /** Normaliza ângulo para 0..2π. */
  private static normalizeAngle(rad: number): number {
    const twoPi = Math.PI * 2;
    const normalized = ((rad % twoPi) + twoPi) % twoPi;
    return normalized === twoPi ? 0 : normalized;
  }

  /** Tolerância em graus para identificar rotação 0/90/180/270. */
  private static readonly ROT_DEG_TOLERANCE = 1;

  private getWallNormalFromSide(side: "front" | "right" | "back" | "left"): THREE.Vector3 {
    if (side === "front") return new THREE.Vector3(0, 0, -1);
    if (side === "right") return new THREE.Vector3(-1, 0, 0);
    if (side === "back") return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(1, 0, 0);
  }

  /** Rotação Y (rad) para a costa da caixa (local -Z) ficar alinhada à normal da parede. */
  private getRotationFromNormal(normal: THREE.Vector3): number {
    const nz = normal.z;
    const nx = normal.x;
    if (nz <= -0.99) return 0;           // front: costa em -Z
    if (nx <= -0.99) return Math.PI / 2;  // right: costa em +X
    if (nz >= 0.99) return Math.PI;      // back: costa em +Z
    if (nx >= 0.99) return -Math.PI / 2;  // left: costa em -X
    return 0;
  }

  private getNearestWallNormal(point: { x: number; z: number }): THREE.Vector3 {
    if (!this.roomBounds) return new THREE.Vector3(0, 0, -1);
    const { minX, maxX, minZ, maxZ } = this.roomBounds;
    const candidates = [
      { normal: new THREE.Vector3(0, 0, -1), dist: point.z - minZ },
      { normal: new THREE.Vector3(-1, 0, 0), dist: maxX - point.x },
      { normal: new THREE.Vector3(0, 0, 1), dist: maxZ - point.z },
      { normal: new THREE.Vector3(1, 0, 0), dist: point.x - minX },
    ];
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0].normal;
  }

  /**
   * Caixa segue lógica da sala apenas quando está dentro ou encostada ao perímetro em X/Z.
   * Caixas totalmente fora da sala ficam livres (sem auto-rotate/snap da sala).
   */
  private isMeshInsideOrTouchingRoom(movingMesh: THREE.Object3D, tolerance = 0.02): boolean {
    if (!this.roomBounds) return false;
    movingMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(movingMesh);
    const { minX, maxX, minZ, maxZ } = this.roomBounds;
    return !(
      box.max.x < minX - tolerance ||
      box.min.x > maxX + tolerance ||
      box.max.z < minZ - tolerance ||
      box.min.z > maxZ + tolerance
    );
  }

  private getSnapLimitForNormal(
    normal: THREE.Vector3,
    inset: number
  ): { axis: "x" | "z"; target: number; boxIsMin: boolean } {
    if (!this.roomBounds) return { axis: "z", target: 0, boxIsMin: true };
    const { minX, maxX, minZ, maxZ } = this.roomBounds;
    const off = Viewer.SNAP_WALL_OFFSET_M;
    if (normal.z <= -0.99) return { axis: "z", target: minZ + inset + off, boxIsMin: true };
    if (normal.z >= 0.99) return { axis: "z", target: maxZ - inset - off, boxIsMin: false };
    if (normal.x <= -0.99) return { axis: "x", target: maxX - inset - off, boxIsMin: false };
    return { axis: "x", target: minX + inset + off, boxIsMin: true };
  }

  /**
   * Identifica qual face do AABB é a costa a partir de rotation.y (modo manual).
   * Costa = face traseira da caixa (local -Z); após rotação corresponde a min/max de X ou Z.
   */
  /** Costa = face traseira da caixa (local -Z). Para cada rotação, devolve o eixo/valor dessa face em mundo e o lado da sala (front/right/back/left). */
  private static getCostaFace(
    rotationY_rad: number,
    boxAABB: THREE.Box3
  ): { eixo: "x" | "z"; valor: number; side: "front" | "back" | "left" | "right" } {
    const deg = (Viewer.normalizeAngle(rotationY_rad) * 180) / Math.PI;
    const t = Viewer.ROT_DEG_TOLERANCE;
    if (deg >= 360 - t || deg < t) {
      return { eixo: "z", valor: boxAABB.min.z, side: "front" };
    }
    if (deg >= 90 - t && deg < 90 + t) {
      return { eixo: "x", valor: boxAABB.max.x, side: "right" };
    }
    if (deg >= 180 - t && deg < 180 + t) {
      return { eixo: "z", valor: boxAABB.max.z, side: "back" };
    }
    return { eixo: "x", valor: boxAABB.min.x, side: "left" };
  }

  /**
   * Orienta a caixa pelos lados da sala (piso) e encosta a costa no limite interno.
   * Com autoRotateEnabled: escolhe lado, aplica rotação e snap. Sem: só snap (mantém rotation.y).
   */
  private applyAutoRotateToRoom(
    movingMesh: THREE.Object3D,
    options: { snapPosition?: boolean } = {}
  ): void {
    if (!this.roomBounds) return;
    if (!this.isMeshInsideOrTouchingRoom(movingMesh)) return;

    movingMesh.updateMatrixWorld(true);
    const boxId = (movingMesh as THREE.Object3D & { userData?: { boxId?: string } }).userData?.boxId;
    const entry = boxId ? this.boxes.get(boxId) : null;
    const inset = this.lockEnabled ? Viewer.WALL_INNER_INSET_M : 0;
    const parent = movingMesh.parent;

    if (entry && entry.autoRotateEnabled === false) {
      if ((entry.depth ?? 0) > 0 && options.snapPosition !== false) {
        this.snapCostaToWallCurrentRotation(movingMesh, entry.depth, inset, parent);
      }
      if (this.lockEnabled) {
        movingMesh.updateMatrixWorld(true);
        this.applyInnerBoundsHardStop(movingMesh, parent);
      }
      return;
    }

    const worldCenter = new THREE.Vector3();
    movingMesh.getWorldPosition(worldCenter);
    const pt = { x: worldCenter.x, z: worldCenter.z };
    const normal = this.getNearestWallNormal(pt);

    const finalY = this.getRotationFromNormal(normal);
    (movingMesh as THREE.Object3D & { rotation: { y: number } }).rotation.y = finalY;
    movingMesh.updateMatrixWorld(true);
    if (Viewer.DEBUG_WALL_ROTATION) {
      const boxId = (movingMesh as THREE.Object3D & { userData?: { boxId?: string } }).userData?.boxId;
      const box = new THREE.Box3().setFromObject(movingMesh);
      const costa = Viewer.getCostaFace(finalY, box);
      console.debug("[WallSnap] applyAutoRotateToRoom", {
        boxId,
        normal: { x: normal.x, y: normal.y, z: normal.z },
        finalY,
        costaSide: costa.side,
        costaValue: costa.valor,
      });
    }

    const snapEnabled = (entry?.depth ?? 0) > 0 && options.snapPosition !== false;
    if (snapEnabled) {
      this.snapCostaToWall(movingMesh, normal, inset, parent);
      movingMesh.updateMatrixWorld(true);
      const residual = this.measureSnapResidual(movingMesh, normal, inset);
      if (residual !== 0 && Math.abs(residual) <= Viewer.SNAP_GAP_TOLERANCE_M) {
        this.nudgeCostaBy(movingMesh, normal, residual, parent);
      }
    }
    if (this.lockEnabled) {
      movingMesh.updateMatrixWorld(true);
      this.applyInnerBoundsHardStop(movingMesh, parent);
    }
  }

  /**
   * Encosta a costa na parede correta sem alterar rotation.y (modo manual).
   * Usa getCostaFace(rotation.y, AABB) para identificar a face da costa e encostá-la no limite interno.
   */
  private snapCostaToWallCurrentRotation(
    movingMesh: THREE.Object3D,
    _depth: number,
    inset: number,
    parent: THREE.Object3D | null
  ): void {
    if (!this.roomBounds) return;
    movingMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(movingMesh);
    const rotationY = (movingMesh as THREE.Object3D & { rotation: { y: number } }).rotation.y;
    const { valor, side } = Viewer.getCostaFace(rotationY, box);
    if (Viewer.DEBUG_WALL_ROTATION) {
      const boxId = (movingMesh as THREE.Object3D & { userData?: { boxId?: string } }).userData?.boxId;
      console.debug("[WallSnap] snapCostaToWallCurrentRotation", {
        boxId,
        rotationY,
        costaSide: side,
        costaValue: valor,
      });
    }
    const { axis, target } = this.getSnapLimitForNormal(this.getWallNormalFromSide(side), inset);

    let dx = 0;
    let dz = 0;
    if (axis === "x") dx = target - valor;
    else dz = target - valor;

    if (dx === 0 && dz === 0) return;
    const worldPos = new THREE.Vector3();
    movingMesh.getWorldPosition(worldPos);
    worldPos.x += dx;
    worldPos.z += dz;
    if (parent) {
      parent.worldToLocal(worldPos);
      movingMesh.position.copy(worldPos);
    } else {
      movingMesh.position.copy(worldPos);
    }
  }

  /**
   * Encosta a face da costa (AABB) exatamente no limite interno da parede (Room Box).
   */
  private snapCostaToWall(
    movingMesh: THREE.Object3D,
    normal: THREE.Vector3,
    inset: number,
    parent: THREE.Object3D | null
  ): void {
    if (!this.roomBounds) return;
    movingMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(movingMesh);
    const { axis, target, boxIsMin } = this.getSnapLimitForNormal(normal, inset);
    const faceValue = axis === "x" ? (boxIsMin ? box.min.x : box.max.x) : boxIsMin ? box.min.z : box.max.z;
    const delta = target - faceValue;
    let dx = 0;
    let dz = 0;
    if (axis === "x") dx = delta;
    else dz = delta;
    if (dx === 0 && dz === 0) return;
    const worldPos = new THREE.Vector3();
    movingMesh.getWorldPosition(worldPos);
    worldPos.x += dx;
    worldPos.z += dz;
    if (parent) {
      parent.worldToLocal(worldPos);
      movingMesh.position.copy(worldPos);
    } else {
      movingMesh.position.copy(worldPos);
    }
  }

  /** Mede o gap residual entre a face da costa e o alvo lógico (positivo = folga, negativo = penetração). */
  private measureSnapResidual(
    movingMesh: THREE.Object3D,
    normal: THREE.Vector3,
    inset: number
  ): number {
    if (!this.roomBounds) return 0;
    movingMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(movingMesh);
    const { axis, target, boxIsMin } = this.getSnapLimitForNormal(normal, inset);
    const faceValue = axis === "x" ? (boxIsMin ? box.min.x : box.max.x) : boxIsMin ? box.min.z : box.max.z;
    return target - faceValue;
  }

  /** Desloca a caixa ao longo do eixo da parede lógica para eliminar gap residual. */
  private nudgeCostaBy(
    movingMesh: THREE.Object3D,
    normal: THREE.Vector3,
    residualM: number,
    parent: THREE.Object3D | null
  ): void {
    const { axis } = this.getSnapLimitForNormal(normal, 0);
    const worldPos = new THREE.Vector3();
    movingMesh.getWorldPosition(worldPos);
    if (axis === "x") worldPos.x += residualM;
    else worldPos.z += residualM;
    if (parent) {
      parent.worldToLocal(worldPos);
      movingMesh.position.copy(worldPos);
    } else {
      movingMesh.position.copy(worldPos);
    }
  }

  /**
   * Hard stop: impede que o AABB penetre o limite interno da sala (lock ON).
   * Compara box.min/max com inner limits e aplica o delta exato para remover penetração.
   */
  private applyInnerBoundsHardStop(
    movingMesh: THREE.Object3D,
    parent: THREE.Object3D | null
  ): void {
    if (!this.roomBounds || !this.lockEnabled) return;
    const inset = Viewer.WALL_INNER_INSET_M;
    const off = Viewer.SNAP_WALL_OFFSET_M;
    const innerMinX = this.roomBounds.minX + inset + off;
    const innerMaxX = this.roomBounds.maxX - inset - off;
    const innerMinZ = this.roomBounds.minZ + inset + off;
    const innerMaxZ = this.roomBounds.maxZ - inset - off;

    movingMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(movingMesh);

    let dx = 0;
    let dz = 0;
    if (box.min.x < innerMinX) dx = innerMinX - box.min.x;
    else if (box.max.x > innerMaxX) dx = innerMaxX - box.max.x;
    if (box.min.z < innerMinZ) dz = innerMinZ - box.min.z;
    else if (box.max.z > innerMaxZ) dz = innerMaxZ - box.max.z;

    if (dx === 0 && dz === 0) return;

    const worldPos = new THREE.Vector3();
    movingMesh.getWorldPosition(worldPos);
    worldPos.x += dx;
    worldPos.z += dz;
    if (parent) {
      parent.worldToLocal(worldPos);
      movingMesh.position.copy(worldPos);
    } else {
      movingMesh.position.copy(worldPos);
    }
  }

  private notifyBoxTransform() {
    if (!this.selectedBoxId) return;
    const entry = this.boxes.get(this.selectedBoxId);
    if (!entry) return;
    const { x, y, z } = entry.mesh.position;
    this.onBoxTransform?.(this.selectedBoxId, { x, y, z }, entry.mesh.rotation.y);
  }

  private notifyWallTransform() {
    if (this.selectedWallIndex === null || !this.onWallTransform) return;
    const wall = this.roomBoxWalls.find((w) => w.id === this.selectedWallIndex)?.mesh;
    if (!wall) return;
    const { x, z } = wall.position;
    const rotationDeg = (wall.rotation.y * 180) / Math.PI;
    this.onWallTransform(this.selectedWallIndex, { x, z }, rotationDeg);
  }

  private notifyRoomElementTransform() {
    if (!this.selectedRoomElementId || !this.onRoomElementTransform) return;
    const element = this.roomBuilder.getElementById(this.selectedRoomElementId);
    if (!element || !element.parent) return;
    const wall = element.parent as THREE.Mesh;
    const wallLenMm = (wall.userData.wallLengthMm as number) ?? 4000;
    const wallHeightMm = (wall.userData.wallHeightMm as number) ?? 2800;
    const wallLenM = wallLenMm * 0.001;
    element.updateMatrixWorld(true);
    wall.updateMatrixWorld(true);
    const localPos = new THREE.Vector3();
    element.getWorldPosition(localPos);
    wall.worldToLocal(localPos);
    const cur = element.userData.config as DoorWindowConfig;
    let horizontalOffsetMm = (localPos.x + wallLenM / 2) * 1000 - cur.widthMm / 2;
    let floorOffsetMm = localPos.y * 1000 - cur.heightMm / 2;
    horizontalOffsetMm = Math.max(0, Math.min(wallLenMm - cur.widthMm, horizontalOffsetMm));
    floorOffsetMm = Math.max(0, Math.min(wallHeightMm - cur.heightMm, floorOffsetMm));
    horizontalOffsetMm = snapHorizontalOffset(horizontalOffsetMm, cur.widthMm, wallLenMm, true);
    const config: DoorWindowConfig = {
      ...cur,
      horizontalOffsetMm,
      floorOffsetMm,
    };
    this.onRoomElementTransform(this.selectedRoomElementId, config);
  }

  private applyHighlight(_entry: { mesh: THREE.Object3D }) {
    this.refreshOutlineTarget();
  }

  private loadMaterial(materialName: string) {
    const preset = getMaterialPreset(this.materialSet, materialName);
    if (!preset?.options) return null;
    return createWoodMaterial({}, { ...preset.options });
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
    const intersectsWall = this.boxesIntersectingWalls.has(targetId);
    const colorHex = intersectsWall ? 0xef4444 : (isSelected ? 0x38bdf8 : 0x7dd3fc);
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

  private getWallIdAtPointer(event: { clientX: number; clientY: number }): number | null {
    const roomMeshes = this.roomBoxWalls.map((w) => w.mesh);
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
      const wallId = (current as THREE.Mesh & { userData?: { wallId?: number } }).userData?.wallId;
      if (typeof wallId === "number") return wallId;
      current = current.parent;
    }
    return null;
  }

  private getWallHitAtPointer(_event: { clientX: number; clientY: number }): {
    wallId: number;
    config: DoorWindowConfig;
    type: "door" | "window";
  } | null {
    // Room Box não suporta abertura posicionada por clique.
    return null;
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
      this.updateDimensionsOverlay();
      this.updateWallVisibilityBasedOnCamera();
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

      if (this.wallSelectionOutline && this.wallSelectionOutlineMaterial) {
        const wallEntry = this.selectedWallIndex !== null
          ? this.roomBoxWalls.find((w) => w.id === this.selectedWallIndex)
          : null;
        if (wallEntry) {
          this.wallSelectionOutline.visible = true;
          this.wallSelectionOutline.update(wallEntry.mesh);
        } else {
          this.wallSelectionOutline.visible = false;
        }
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
    if (this.wallSelectionOutline) {
      this.sceneManager.scene.remove(this.wallSelectionOutline);
      this.wallSelectionOutline.geometry.dispose();
      if (this.wallSelectionOutlineMaterial) {
        this.wallSelectionOutlineMaterial.dispose();
      }
      this.wallSelectionOutline = null;
      this.wallSelectionOutlineMaterial = null;
    }
    if (this.dimensionsOverlayLines) {
      this.dimensionsOverlayLines.geometry.dispose();
      (this.dimensionsOverlayLines.material as THREE.Material).dispose();
    }
    if (this.dimensionsOverlayGroup) {
      this.sceneManager.scene.remove(this.dimensionsOverlayGroup);
      this.dimensionsOverlayGroup = null;
      this.dimensionsOverlayLines = null;
    }
    // Limpar todos os caixotes corretamente
    this.clearBoxes();
    this.roomBuilder.clearRoom();

    this.sceneManager.dispose();
    this.rendererManager.dispose();
  }
}
