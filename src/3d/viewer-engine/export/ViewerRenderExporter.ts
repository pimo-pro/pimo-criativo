import * as THREE from "three";
import type { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import type { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { applyLogoPiPhotoWatermark } from "../../../utils/watermark";
import { createCabinetSilhouetteLines, disposeSilhouetteObject } from "../../../core/viewer/photoModeSilhouette";
import type {
  ViewerCameraPreset,
  ViewerRenderFormat,
  ViewerRenderBackground,
  ViewerRenderMode,
  ViewerRenderOptions,
  ViewerRenderResult,
} from "../../../context/projectTypes";
import type { ViewerBoxEntry } from "../types";
import { runWithAllLayoutBoundsProxiesVisible } from "../box/boxAabbUtils";
import {
  CAPTURE_MAIN_BLOOM,
  CAPTURE_SHOWCASE_BLOOM,
  PHOTO_CAPTURE_LIGHT,
  VIEWER_RENDER_SIZE_MAP,
  clampExportDimension,
  resolveExportRenderSize,
} from "./renderExportQuality";

type LightState = {
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.Light;
  ambient: THREE.Light;
  rimLight: THREE.Light;
  hemisphere?: THREE.Light;
};

type ViewerRenderExporterDeps = {
  getBoxes: () => Map<string, ViewerBoxEntry>;
  getRenderer: () => THREE.WebGLRenderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.PerspectiveCamera;
  getControls: () => { target: THREE.Vector3; update: () => void } | null;
  getLights: () => LightState;
  getGroundVisible: () => boolean;
  setGroundVisible: (_visible: boolean) => void;
  getGridVisible: () => boolean;
  setGridVisible: (_visible: boolean) => void;
  getRoomGroup: () => THREE.Group;
  getRoomWalls: () => Array<{ mesh: THREE.Mesh }>;
  getSelectionOutline: () => THREE.Object3D | null;
  getWallSelectionOutline: () => THREE.BoxHelper | null;
  getDimensionsOverlayGroup: () => THREE.Group | null;
  getWallGizmoGroup: () => THREE.Group | null;
  ensureShowcaseComposer: () => void;
  ensureMainComposer: () => void;
  getShowcaseComposer: () => EffectComposer | null;
  getMainComposer: () => EffectComposer | null;
  getShowcaseBloomPass: () => UnrealBloomPass | null;
  getMainBloomPass: () => UnrealBloomPass | null;
  getBokehPass?: () => BokehPass | null;
  setComposerExportSize?: (_width: number, _height: number, _pixelRatio?: number) => void;
  updateShowcaseComposerSize: () => void;
  updateMainComposerSize: () => void;
  updateCanvasSize: () => void;
};

type BloomSnapshot = { strength: number; radius: number; threshold: number };

type MaterialSnapshot = {
  material: THREE.MeshStandardMaterial;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
};

function snapshotBloom(pass: UnrealBloomPass | null): BloomSnapshot | null {
  if (!pass) return null;
  return { strength: pass.strength, radius: pass.radius, threshold: pass.threshold };
}

function restoreBloom(pass: UnrealBloomPass | null, snap: BloomSnapshot | null): void {
  if (!pass || !snap) return;
  pass.strength = snap.strength;
  pass.radius = snap.radius;
  pass.threshold = snap.threshold;
}

function applyBloomPreset(pass: UnrealBloomPass | null, preset: { strength: number; radius: number; threshold: number }): void {
  if (!pass) return;
  pass.strength = preset.strength;
  pass.radius = preset.radius;
  pass.threshold = preset.threshold;
}

function boostMaterialsForCapture(scene: THREE.Scene): MaterialSnapshot[] {
  const snaps: MaterialSnapshot[] = [];
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    list.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      snaps.push({
        material,
        roughness: material.roughness,
        metalness: material.metalness,
        envMapIntensity: material.envMapIntensity,
      });
      material.roughness = Math.max(0.14, material.roughness * 0.9);
      material.metalness = Math.min(0.45, material.metalness * 1.04);
      material.envMapIntensity = Math.min(1.28, Math.max(material.envMapIntensity, 0.88) * 1.12);
      material.needsUpdate = true;
    });
  });
  return snaps;
}

function restoreMaterials(snaps: MaterialSnapshot[]): void {
  snaps.forEach((snap) => {
    snap.material.roughness = snap.roughness;
    snap.material.metalness = snap.metalness;
    snap.material.envMapIntensity = snap.envMapIntensity;
    snap.material.needsUpdate = true;
  });
}

function copyRendererToCanvas(renderer: THREE.WebGLRenderer, destW: number, destH: number): HTMLCanvasElement | null {
  const snapCanvas = renderer.domElement;
  const srcW = Math.max(1, snapCanvas.width || destW);
  const srcH = Math.max(1, snapCanvas.height || destH);
  const offscreen = document.createElement("canvas");
  offscreen.width = destW;
  offscreen.height = destH;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(snapCanvas, 0, 0, srcW, srcH, 0, 0, destW, destH);
  return offscreen;
}

export class ViewerRenderExporter {
  private readonly deps: ViewerRenderExporterDeps;

  constructor(deps: ViewerRenderExporterDeps) {
    this.deps = deps;
  }

  async renderScene(options: ViewerRenderOptions): Promise<ViewerRenderResult | null> {
    const rendererForSize = this.deps.getRenderer();
    let width: number;
    let height: number;
    if (options.size === "viewport") {
      const el = rendererForSize.domElement;
      const pr = Math.max(0.5, rendererForSize.getPixelRatio() || 1);
      let cw = el.clientWidth;
      let ch = el.clientHeight;
      if (cw < 2 || ch < 2) {
        cw = Math.round((el.width || 960) / pr);
        ch = Math.round((el.height || 540) / pr);
      }
      width = clampExportDimension(cw, 1920);
      height = clampExportDimension(ch, 1080);
    } else {
      const tuple = VIEWER_RENDER_SIZE_MAP[options.size] ?? VIEWER_RENDER_SIZE_MAP.medium;
      width = tuple[0];
      height = tuple[1];
    }
    const lineExport = Boolean(options.lineDrawingExport);
    const lineBg = options.lineDrawingBackground ?? "white";
    const effectiveBackground: ViewerRenderBackground = lineExport
      ? lineBg === "transparent"
        ? "transparent"
        : "white"
      : options.background;
    const effectiveMode: ViewerRenderMode = lineExport ? "lines" : options.mode;
    const preset: ViewerCameraPreset = options.preset ?? "current";
    const applyWatermark = options.watermark ?? false;
    const format: ViewerRenderFormat = options.format ?? "png";
    const isolatedProject = effectiveBackground === "project-transparent";
    const transparentBackground = effectiveBackground === "transparent" || isolatedProject;
    const advancedRealism = Boolean(options.advancedRealism && effectiveMode !== "lines");
    const qualityBase = Math.max(0.1, Math.min(options.quality ?? 0.92, 1));
    const quality = format === "jpg" ? (advancedRealism ? Math.max(qualityBase, 0.97) : qualityBase) : 1;
    const shadowBase = THREE.MathUtils.clamp(options.shadowIntensity ?? 1, 0, 1);
    const shadowFactor = advancedRealism ? Math.max(shadowBase, 0.86) : shadowBase;
    const { renderWidth, renderHeight } = resolveExportRenderSize(width, height, advancedRealism);
    const renderer = rendererForSize;
    const scene = this.deps.getScene();
    const camera = this.deps.getCamera();
    const controls = this.deps.getControls();
    const boxes = this.deps.getBoxes();
    const lights = this.deps.getLights();

    const originalCameraPosition = camera.position.clone();
    const originalCameraQuaternion = camera.quaternion.clone();
    const originalCameraZoom = camera.zoom;
    const originalControlsTarget = controls ? controls.target.clone() : null;

    const originalLightState = {
      key: lights.keyLight.intensity,
      fill: lights.fillLight.intensity,
      ambient: lights.ambient.intensity,
      rim: lights.rimLight.intensity,
      hemisphere: lights.hemisphere?.intensity ?? 0,
      castShadow: lights.keyLight.castShadow,
      shadowRadius: lights.keyLight.shadow.radius,
      shadowBias: lights.keyLight.shadow.bias,
    };
    const originalRendererState = {
      toneMappingExposure: renderer.toneMappingExposure,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowType: renderer.shadowMap.type,
    };

    const originalGroundVisible = this.deps.getGroundVisible();
    const originalGridVisible = this.deps.getGridVisible();
    const roomGroup = this.deps.getRoomGroup();
    const originalRoomBuilderVisible = roomGroup.visible;
    const roomWalls = this.deps.getRoomWalls();
    const originalRoomWallVisibility = roomWalls.map((wall) => ({
      mesh: wall.mesh,
      visible: wall.mesh.visible,
    }));
    const selectionOutline = this.deps.getSelectionOutline();
    const wallSelectionOutline = this.deps.getWallSelectionOutline();
    const dimensionsOverlayGroup = this.deps.getDimensionsOverlayGroup();
    const wallGizmoGroup = this.deps.getWallGizmoGroup();
    const originalOverlayVisibility = {
      selectionOutline: selectionOutline?.visible ?? false,
      wallSelectionOutline: wallSelectionOutline?.visible ?? false,
      dimensionsOverlay: dimensionsOverlayGroup?.visible ?? false,
      wallGizmo: wallGizmoGroup?.visible ?? false,
    };

    const applyPresetCamera = () => {
      if (preset === "current") return;
      if (boxes.size === 0) return;

      const boundingBox = new THREE.Box3();
      const centerVec = new THREE.Vector3();
      const sizeVec = new THREE.Vector3();
      const roots = Array.from(boxes.values()).map((e) => e.mesh);
      runWithAllLayoutBoundsProxiesVisible(roots, () => {
        boundingBox.makeEmpty();
        boxes.forEach((entry) => {
          boundingBox.expandByObject(entry.mesh);
        });
      });
      if (boundingBox.isEmpty()) return;
      boundingBox.getCenter(centerVec);
      boundingBox.getSize(sizeVec);
      const center = centerVec.clone();
      const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 1);
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
      const eased = 0.55 + shadowFactor * 0.45;
      if (advancedRealism) {
        lights.keyLight.intensity = originalLightState.key * (eased * PHOTO_CAPTURE_LIGHT.keyMul);
        lights.fillLight.intensity = originalLightState.fill * (PHOTO_CAPTURE_LIGHT.fillBase + shadowFactor * PHOTO_CAPTURE_LIGHT.fillSpan);
        lights.ambient.intensity = originalLightState.ambient * (PHOTO_CAPTURE_LIGHT.ambientBase + shadowFactor * PHOTO_CAPTURE_LIGHT.ambientSpan);
        lights.rimLight.intensity = originalLightState.rim * (PHOTO_CAPTURE_LIGHT.rimBase + shadowFactor * PHOTO_CAPTURE_LIGHT.rimSpan);
        if (lights.hemisphere) {
          lights.hemisphere.intensity = originalLightState.hemisphere * PHOTO_CAPTURE_LIGHT.hemisphereMul;
        }
        lights.keyLight.castShadow = true;
        lights.keyLight.shadow.radius = Math.max(4, originalLightState.shadowRadius * 1.6);
        lights.keyLight.shadow.bias = -0.0001;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMappingExposure = Math.max(originalRendererState.toneMappingExposure, PHOTO_CAPTURE_LIGHT.exposure);
      } else {
        lights.keyLight.intensity = originalLightState.key * (eased * 1.12);
        lights.fillLight.intensity = originalLightState.fill * (0.75 + shadowFactor * 0.4);
        lights.ambient.intensity = originalLightState.ambient * (0.85 + shadowFactor * 0.25);
        lights.rimLight.intensity = originalLightState.rim * (0.65 + shadowFactor * 0.5);
        lights.keyLight.castShadow = shadowFactor > 0.15 ? originalLightState.castShadow : false;
        lights.keyLight.shadow.radius = Math.max(
          3,
          originalLightState.shadowRadius * (0.7 + shadowFactor * 0.6)
        );
        renderer.toneMappingExposure = Math.max(originalRendererState.toneMappingExposure, 1.12);
      }
    };

    const applyIsolatedProjectMode = () => {
      if (!isolatedProject) return;
      this.deps.setGroundVisible(false);
      this.deps.setGridVisible(false);
      roomGroup.visible = false;
      roomWalls.forEach((wall) => {
        wall.mesh.visible = false;
      });
      if (selectionOutline) selectionOutline.visible = false;
      if (wallSelectionOutline) wallSelectionOutline.visible = false;
      if (dimensionsOverlayGroup) dimensionsOverlayGroup.visible = false;
      if (wallGizmoGroup) wallGizmoGroup.visible = false;
      renderer.shadowMap.enabled = false;
    };

    applyPresetCamera();
    applyShadowIntensity();
    applyIsolatedProjectMode();

    const prevPixelRatio = renderer.getPixelRatio();
    const prevRenderTarget = renderer.getRenderTarget();
    const prevRendererSize = renderer.getSize(new THREE.Vector2());
    const prevClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const prevClearAlpha = renderer.getClearAlpha();
    const prevBackground = scene.background;
    const prevEnvironment = scene.environment;
    const bokehPass = this.deps.getBokehPass?.() ?? null;
    const prevBokehEnabled = bokehPass?.enabled ?? false;
    const showcaseBloomSnap = snapshotBloom(this.deps.getShowcaseBloomPass());
    const mainBloomSnap = snapshotBloom(this.deps.getMainBloomPass());
    let materialSnaps: MaterialSnapshot[] = [];

    const renderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      depthBuffer: true,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
    });

    const silhouetteLines: THREE.LineSegments[] = [];
    const meshVisibilityRestore: Array<{ mesh: THREE.Object3D; visible: boolean }> = [];

    try {
      renderer.setPixelRatio(1);

      if (transparentBackground) {
        renderer.setClearColor(0x000000, 0);
        scene.background = null;
      } else if (effectiveBackground === "white") {
        renderer.setClearColor(0xffffff, 1);
        scene.background = new THREE.Color(0xffffff);
      }

      if (effectiveMode === "lines") {
        scene.environment = null;
        boxes.forEach((entry) => {
          meshVisibilityRestore.push({ mesh: entry.mesh, visible: entry.mesh.visible });
          const sil = createCabinetSilhouetteLines(entry.mesh);
          entry.mesh.visible = false;
          if (sil) {
            scene.add(sil);
            silhouetteLines.push(sil);
          }
        });
      } else if (advancedRealism) {
        materialSnaps = boostMaterialsForCapture(scene);
      }

      let exportCanvas: HTMLCanvasElement;
      const canUseLiveComposer = effectiveMode === "pbr" && !transparentBackground;
      if (canUseLiveComposer) {
        renderer.setRenderTarget(null);
        renderer.setSize(renderWidth, renderHeight, false);
        camera.aspect = renderWidth / Math.max(1, renderHeight);
        camera.updateProjectionMatrix();
        this.deps.setComposerExportSize?.(renderWidth, renderHeight, 1);
        if (bokehPass) bokehPass.enabled = false;

        if (advancedRealism) {
          this.deps.ensureShowcaseComposer();
          applyBloomPreset(this.deps.getShowcaseBloomPass(), CAPTURE_SHOWCASE_BLOOM);
          if (bokehPass) bokehPass.enabled = false;
          this.deps.setComposerExportSize?.(renderWidth, renderHeight, 1);
          this.deps.getShowcaseComposer()?.render();
        } else {
          this.deps.ensureMainComposer();
          applyBloomPreset(this.deps.getMainBloomPass(), CAPTURE_MAIN_BLOOM);
          this.deps.setComposerExportSize?.(renderWidth, renderHeight, 1);
          this.deps.getMainComposer()?.render();
        }

        const copied = copyRendererToCanvas(renderer, renderWidth, renderHeight);
        if (!copied) return null;
        exportCanvas = copied;
      } else {
        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);

        const buffer = new Uint8Array(renderWidth * renderHeight * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, renderWidth, renderHeight, buffer);

        const canvas = document.createElement("canvas");
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        const context = canvas.getContext("2d");
        if (!context) return null;
        const imageData = context.createImageData(renderWidth, renderHeight);
        for (let y = 0; y < renderHeight; y++) {
          const srcOffset = (renderHeight - y - 1) * renderWidth * 4;
          const dstOffset = y * renderWidth * 4;
          imageData.data.set(buffer.subarray(srcOffset, srcOffset + renderWidth * 4), dstOffset);
        }
        context.putImageData(imageData, 0, 0);
        exportCanvas = canvas;
      }

      const keepNativeSupersample =
        options.size === "large" || options.size === "4k" || options.size === "viewport";
      if (!keepNativeSupersample && (renderWidth !== width || renderHeight !== height)) {
        const downscaled = document.createElement("canvas");
        downscaled.width = width;
        downscaled.height = height;
        const downscaledContext = downscaled.getContext("2d");
        if (downscaledContext) {
          downscaledContext.imageSmoothingEnabled = true;
          downscaledContext.imageSmoothingQuality = "high";
          downscaledContext.drawImage(exportCanvas, 0, 0, width, height);
          exportCanvas = downscaled;
        }
      }

      if (applyWatermark) {
        await applyLogoPiPhotoWatermark(exportCanvas, {
          opacity: 0.75,
          position: "bottom-right",
          widthPercent: 0.08,
        });
      }

      const dataUrl =
        format === "jpg"
          ? exportCanvas.toDataURL("image/jpeg", quality)
          : exportCanvas.toDataURL("image/png", 1);
      return { dataUrl, width: exportCanvas.width, height: exportCanvas.height };
    } finally {
      restoreMaterials(materialSnaps);
      restoreBloom(this.deps.getShowcaseBloomPass(), showcaseBloomSnap);
      restoreBloom(this.deps.getMainBloomPass(), mainBloomSnap);
      if (bokehPass) bokehPass.enabled = prevBokehEnabled;
      camera.position.copy(originalCameraPosition);
      camera.quaternion.copy(originalCameraQuaternion);
      camera.zoom = originalCameraZoom;
      camera.updateProjectionMatrix();
      if (controls && originalControlsTarget) {
        controls.target.copy(originalControlsTarget);
        controls.update();
      }
      lights.keyLight.intensity = originalLightState.key;
      lights.fillLight.intensity = originalLightState.fill;
      lights.ambient.intensity = originalLightState.ambient;
      lights.rimLight.intensity = originalLightState.rim;
      if (lights.hemisphere) lights.hemisphere.intensity = originalLightState.hemisphere;
      lights.keyLight.castShadow = originalLightState.castShadow;
      lights.keyLight.shadow.radius = originalLightState.shadowRadius;
      lights.keyLight.shadow.bias = originalLightState.shadowBias;
      renderer.toneMappingExposure = originalRendererState.toneMappingExposure;
      renderer.shadowMap.enabled = originalRendererState.shadowEnabled;
      renderer.shadowMap.type = originalRendererState.shadowType;
      this.deps.setGroundVisible(originalGroundVisible);
      this.deps.setGridVisible(originalGridVisible);
      roomGroup.visible = originalRoomBuilderVisible;
      originalRoomWallVisibility.forEach(({ mesh, visible }) => {
        mesh.visible = visible;
      });
      if (selectionOutline) selectionOutline.visible = originalOverlayVisibility.selectionOutline;
      if (wallSelectionOutline) wallSelectionOutline.visible = originalOverlayVisibility.wallSelectionOutline;
      if (dimensionsOverlayGroup) dimensionsOverlayGroup.visible = originalOverlayVisibility.dimensionsOverlay;
      if (wallGizmoGroup) wallGizmoGroup.visible = originalOverlayVisibility.wallGizmo;
      silhouetteLines.forEach((sil) => {
        scene.remove(sil);
        disposeSilhouetteObject(sil);
      });
      meshVisibilityRestore.forEach(({ mesh, visible }) => {
        mesh.visible = visible;
      });
      renderer.setRenderTarget(prevRenderTarget);
      renderer.setSize(prevRendererSize.x, prevRendererSize.y, false);
      renderer.setPixelRatio(prevPixelRatio);
      renderer.setClearColor(prevClearColor, prevClearAlpha);
      scene.background = prevBackground;
      scene.environment = prevEnvironment;
      this.deps.updateCanvasSize();
      renderTarget.dispose();
    }
  }
}
