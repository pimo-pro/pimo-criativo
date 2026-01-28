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
import { buildBox, updateBoxGeometry } from "../objects/BoxBuilder";
import type { BoxOptions } from "../objects/BoxBuilder";
import type { EnvironmentOptions } from "./Environment";

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
};

export class Viewer {
  private sceneManager: SceneManager;
  private cameraManager: CameraManager;
  private rendererManager: RendererManager;
  private lights: Lights;
  private controls: Controls | null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private envMap: THREE.Texture | null = null;
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private boxes = new Map<
    string,
    {
      mesh: THREE.Mesh;
      width: number;
      height: number;
      depth: number;
      index: number;
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
  private onBoxSelected: ((id: string | null) => void) | null = null;

  constructor(private container: HTMLElement, private options: ViewerOptions = {}) {
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
    this.lights = new Lights(this.sceneManager.scene, options.lights);

    this.materialSet = mergeMaterialSet(defaultMaterialSet);
    this.addBox(this.mainBoxId, { ...options.box, materialName: "mdf" });

    this.controls = options.enableControls === false
      ? null
      : new Controls(this.cameraManager.camera, this.rendererManager.renderer.domElement, options.controls);

    this.rendererManager.renderer.domElement.addEventListener("click", this.handleCanvasClick);

    this.handleResize();
    this.start();
    this.attachResizeObserver();
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
    entry.mesh.material = nextMaterial.material;
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
    this.cameraManager.setTarget(0, 1, 0);
  }

  addBox(id: string, options: BoxOptions = {}): boolean {
    if (this.boxes.has(id)) return false;
    const materialName = options.materialName ?? this.defaultMaterialName;
    const material = this.loadMaterial(materialName);
    const box = buildBox({ ...options, material: material?.material });
    const { width, height, depth } = this.getBoxDimensions(options);
    const index = options.index ?? this.getNextBoxIndex();
    const position = options.position ?? { x: 0, y: height / 2, z: 0 };
    box.position.set(position.x, position.y, position.z);
    box.name = id;
    this.sceneManager.add(box);
    this.boxes.set(id, {
      mesh: box,
      width,
      height,
      depth,
      index,
      cadModels: [],
      highlight: null,
      material,
    });
    this.reflowBoxes();
    return true;
  }

  updateBox(id: string, options: Partial<BoxOptions>): boolean {
    const entry = this.boxes.get(id);
    if (!entry) return false;
    if (
      (options.size !== undefined && (!Number.isFinite(options.size) || options.size <= 0)) ||
      (options.width !== undefined && (!Number.isFinite(options.width) || options.width <= 0)) ||
      (options.height !== undefined && (!Number.isFinite(options.height) || options.height <= 0)) ||
      (options.depth !== undefined && (!Number.isFinite(options.depth) || options.depth <= 0))
    ) {
      return false;
    }
    if (
      options.position &&
      (!Number.isFinite(options.position.x) ||
        !Number.isFinite(options.position.y) ||
        !Number.isFinite(options.position.z))
    ) {
      return false;
    }
    if (options.index !== undefined && (!Number.isFinite(options.index) || options.index < 0)) {
      return false;
    }
    let width = entry.width;
    let height = entry.height;
    let depth = entry.depth;
    let widthChanged = false;
    let heightChanged = false;
    let indexChanged = false;
    if (
      options.width !== undefined ||
      options.height !== undefined ||
      options.depth !== undefined ||
      options.size !== undefined
    ) {
      const updated = updateBoxGeometry(entry.mesh, options);
      width = updated.width;
      height = updated.height;
      depth = updated.depth;
      widthChanged = width !== entry.width;
      heightChanged = height !== entry.height;
    }
    if (options.index !== undefined && options.index !== entry.index) {
      entry.index = options.index;
      indexChanged = true;
    }
    if (options.materialName) {
      this.updateBoxMaterial(id, options.materialName);
    }
    if (options.position) {
      entry.mesh.position.set(options.position.x, options.position.y, options.position.z);
    } else {
      entry.mesh.position.y = height / 2;
    }
    entry.mesh.updateMatrixWorld();
    entry.width = width;
    entry.height = height;
    entry.depth = depth;
    if (widthChanged || indexChanged) {
      this.reflowBoxes();
    }
    if (heightChanged) {
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
    entry.mesh.geometry.dispose();
    if (Array.isArray(entry.mesh.material)) {
      entry.mesh.material.forEach((material) => material.dispose());
    } else {
      entry.mesh.material.dispose();
    }
    if (entry.material) {
      entry.material.textures.forEach((texture) => texture.dispose());
    }
    this.boxes.delete(id);
    this.reflowBoxes();
    return true;
  }

  clearBoxes(): void {
    Array.from(this.boxes.keys()).forEach((id) => this.removeBox(id));
  }

  setOnBoxSelected(callback: (id: string | null) => void): void {
    this.onBoxSelected = callback;
  }

  selectBox(id: string | null): void {
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
        object.position.set(0, entry.height / 2, 0);
        entry.mesh.add(object);
        entry.cadModels.push({ id, object, path: modelPath });
      })
      .catch(() => {
        // Falha silenciosa conforme especificado
      });

    return true;
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

  setBoxGap(gap: number) {
    this.boxGap = Math.max(0, gap);
    this.reflowBoxes();
  }

  reflowBoxes() {
    let cursorX = 0;
    const ordered = Array.from(this.boxes.values()).sort((a, b) => a.index - b.index);
    ordered.forEach((entry) => {
      entry.mesh.position.set(cursorX + entry.width / 2, entry.height / 2, 0);
      entry.mesh.updateMatrixWorld();
      cursorX += entry.width + this.boxGap;
    });
  }

  private getBoxHeight(options?: BoxOptions) {
    if (!options) return 1;
    if (options.height !== undefined) return Math.max(0.001, options.height);
    if (options.size !== undefined) return Math.max(0.001, options.size);
    if (options.width !== undefined || options.depth !== undefined) {
      return Math.max(0.001, options.width ?? options.depth ?? 1);
    }
    return 1;
  }

  private getBoxDimensions(options?: BoxOptions) {
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
    const match = path.toLowerCase().match(/\.(glb|gltf|obj|stl)$/);
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
    const targets = Array.from(this.boxes.values()).map((entry) => entry.mesh);
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) {
      this.setSelectedBox(null);
      return;
    }
    const hitMesh = hits[0].object;
    const id = this.getBoxIdByMesh(hitMesh);
    this.setSelectedBox(id);
  };

  private getBoxIdByMesh(mesh: THREE.Object3D) {
    for (const [id, entry] of this.boxes.entries()) {
      if (entry.mesh === mesh) return id;
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
    if (id) {
      const entry = this.boxes.get(id);
      if (entry) {
        this.applyHighlight(entry);
      }
    }
    this.onBoxSelected?.(id);
  }

  private applyHighlight(entry: {
    mesh: THREE.Mesh;
    highlight: { emissive: THREE.Color; emissiveIntensity: number } | null;
  }) {
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

  private removeHighlight(entry: {
    mesh: THREE.Mesh;
    highlight: { emissive: THREE.Color; emissiveIntensity: number } | null;
  }) {
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
    entry.highlight = null;
  }

  private loadMaterial(materialName: string) {
    const preset: MaterialPreset | undefined = this.materialSet[materialName];
    if (!preset) return null;
    const anisotropy = this.rendererManager.renderer.capabilities.getMaxAnisotropy();
    const loader = new THREE.TextureLoader();
    return createWoodMaterial(preset.maps, { ...preset.options, anisotropy }, loader);
  }

  private attachResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  private handleResize() {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.rendererManager.setSize(width, height);
    this.cameraManager.setSize(width, height);
  }

  private start() {
    const animate = () => {
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
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.rendererManager.renderer.domElement.removeEventListener("click", this.handleCanvasClick);
    if (this.envMap) {
      this.envMap.dispose();
    }
    this.pmremGenerator?.dispose();
    this.clearBoxes();
    this.sceneManager.dispose();
    this.rendererManager.dispose();
  }
}
