import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
import { createWoodMaterial } from "../materials/WoodMaterial";
import { defaultMaterialSet, mergeMaterialSet } from "../materials/MaterialLibrary";
import type { MaterialPreset, MaterialSet } from "../materials/MaterialLibrary";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { updateBoxGeometry, updateBoxGroup, buildBoxLegacy } from "../objects/BoxBuilder";
import type { BoxOptions } from "../objects/BoxBuilder";
import type { EnvironmentOptions } from "./Environment";

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
      highlight: {
        emissive: THREE.Color;
        emissiveIntensity: number;
      } | null;
      material: { material: THREE.MeshStandardMaterial; textures: THREE.Texture[] } | null;
    }
  >();
  private mainBoxId = "main";
  private materialSet: MaterialSet;
  private defaultMaterialName = "carvalho";
  private boxGap = 0;
  private modelCounter = 0;
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

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    if (!container) {
      throw new Error("Viewer: container is required");
    }
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
    new Lights(this.sceneManager.scene, options.lights);

    this.materialSet = mergeMaterialSet(defaultMaterialSet);
    if (!options.skipInitialBox) {
      this.addBox(this.mainBoxId, { ...options.box, materialName: "mdf" });
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

    this.start();
    window.addEventListener("resize", this.updateCanvasSize);
  }

  loadHDRI(url: string, options?: { setBackground?: boolean }) {
    if (!this.pmremGenerator) {
      this.pmremGenerator = new THREE.PMREMGenerator(this.rendererManager.renderer);
    }
    const loader = new RGBELoader();
    loader.load(url, (texture) => {
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
      entry.highlight = null;
      this.applyHighlight(entry);
    }
    if (entry.material) {
      entry.material.material.dispose();
      entry.material.textures.forEach((texture) => texture.dispose());
    }
    entry.material = nextMaterial;
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
    let material: { material: THREE.MeshStandardMaterial; textures: THREE.Texture[] } | null = null;

    if (cadOnly) {
      // Caixa só CAD: grupo vazio; o GLB é a própria caixa (sem geometria paramétrica)
      box = new THREE.Group();
      box.name = id;
    } else {
      const materialName = opts.materialName ?? this.defaultMaterialName;
      material = this.loadMaterial(materialName);
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
      highlight: null,
      material,
    });
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
      entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
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

    this.loadModelObject(modelPath, extension)
      .then((object) => {
        entry.mesh.add(object);
        object.traverse((child) => {
          child.userData.boxId = boxId;
        });
        if (entry.cadOnly) {
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
      const loader = new GLTFLoader();
      return loader.loadAsync(path).then((gltf) => gltf.scene);
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
    if (!hits.length) {
      this.setSelectedBox(null);
      return;
    }
    const hitMesh = hits[0].object;
    const id = this.getBoxIdByMesh(hitMesh);
    this.setSelectedBox(id);
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
    if (this.selectedBoxId) {
      const previous = this.boxes.get(this.selectedBoxId);
      if (previous) {
        this.removeHighlight(previous);
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
        this.applyHighlight(entry);
      }
    }
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

  private applyHighlight(entry: {
    mesh: THREE.Object3D;
    highlight: { emissive: THREE.Color; emissiveIntensity: number } | null;
  }) {
    // Aplicar highlight a todos os painéis do caixote
    if (entry.mesh instanceof THREE.Group) {
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material;
          if (Array.isArray(material)) return;
          if (
            material instanceof THREE.MeshStandardMaterial ||
            material instanceof THREE.MeshPhysicalMaterial
          ) {
            if (!entry.highlight) {
              entry.highlight = {
                emissive: material.emissive.clone(),
                emissiveIntensity: material.emissiveIntensity,
              };
            }
            material.emissive = new THREE.Color("#38bdf8");
            material.emissiveIntensity = 0.6;
          }
        }
      });
    } else if (entry.mesh instanceof THREE.Mesh) {
      const material = entry.mesh.material;
      if (Array.isArray(material)) return;
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial
      ) {
        if (!entry.highlight) {
          entry.highlight = {
            emissive: material.emissive.clone(),
            emissiveIntensity: material.emissiveIntensity,
          };
        }
        material.emissive = new THREE.Color("#38bdf8");
        material.emissiveIntensity = 0.6;
      }
    }
  }

  private removeHighlight(entry: {
    mesh: THREE.Object3D;
    highlight: { emissive: THREE.Color; emissiveIntensity: number } | null;
  }) {
    // Remover highlight de todos os painéis do caixote
    if (entry.mesh instanceof THREE.Group) {
      entry.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material;
          if (Array.isArray(material)) return;
          if (
            material instanceof THREE.MeshStandardMaterial ||
            material instanceof THREE.MeshPhysicalMaterial
          ) {
            if (entry.highlight) {
              material.emissive.copy(entry.highlight.emissive);
              material.emissiveIntensity = entry.highlight.emissiveIntensity;
            }
          }
        }
      });
    } else if (entry.mesh instanceof THREE.Mesh) {
      const material = entry.mesh.material;
      if (Array.isArray(material)) return;
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial
      ) {
        if (entry.highlight) {
          material.emissive.copy(entry.highlight.emissive);
          material.emissiveIntensity = entry.highlight.emissiveIntensity;
        }
      }
    }
    entry.highlight = null;
  }

  private loadMaterial(materialName: string) {
    const preset: MaterialPreset | undefined = this.materialSet[materialName];
    if (!preset) return null;
    const anisotropy = this.rendererManager.renderer.capabilities.getMaxAnisotropy();
    const loader = new THREE.TextureLoader();
    return createWoodMaterial(preset.maps, { ...preset.options, anisotropy }, loader);
  }


  private updateCanvasSize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth ?? 1;
    const h = this.container.clientHeight ?? 1;
    this.rendererManager.renderer.setSize(w, h);
    this.cameraManager.camera.aspect = w / h;
    this.cameraManager.camera.updateProjectionMatrix();
  };

  private start() {
    const animate = () => {
      if (this.container && !this._initialCanvasSizeDone) {
        this.updateCanvasSize();
        this._initialCanvasSizeDone = true;
      }
      this.controls?.update();
      this.rendererManager.render(this.sceneManager.scene, this.cameraManager.camera);
      this.rafId = requestAnimationFrame(animate);
    };
    this.rafId = requestAnimationFrame(animate);
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener("resize", this.updateCanvasSize);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    if (this.transformControls) {
      this.transformControls.detach();
      if (this.transformControlsHelper) {
        this.sceneManager.scene.remove(this.transformControlsHelper);
        this.transformControlsHelper = null;
      }
      this.transformControls.dispose();
    }
    this.rendererManager.renderer.domElement.removeEventListener("click", this.handleCanvasClick);
    if (this.envMap) {
      this.envMap.dispose();
    }
    this.pmremGenerator?.dispose();
    
    // Limpar todos os caixotes corretamente
    this.clearBoxes();
    
    this.sceneManager.dispose();
    this.rendererManager.dispose();
  }
}
