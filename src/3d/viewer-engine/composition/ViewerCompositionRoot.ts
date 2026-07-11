import type * as THREE from "three";

import { CameraManager } from "../camera";
import { Controls } from "../controls";
import { HighlightManager } from "../highlight";
import { Lights } from "../lighting";
import { DisplayMaterialController } from "../materials/displayMaterialController";
import {
  createMaterialPipelineFacade,
  type MaterialPipelineFacade,
} from "../materials/materialPipelineFacade";
import { UltraMaterialController } from "../materials/ultraMaterialController";
import { SelectionOutlineController } from "../overlays/SelectionOutlineController";
import { WallSelectionOutlineController } from "../overlays/WallSelectionOutlineController";
import { RendererManager } from "../renderer";
import { SceneManager } from "../scene";
import { InternalSelectionOutline } from "../selection";
import { MultiSelectionOutline } from "../selection/MultiSelectionOutline";
import type { ViewerBoxEntry } from "../types";
import type { ViewerOptions } from "@/viewer/core/viewerTypes";

export type ViewerLightIntensities = {
  ambient: number;
  hemisphere: number;
  key: number;
  fill: number;
  rim: number;
};

export type ViewerFoundation = {
  sceneManager: SceneManager;
  cameraManager: CameraManager;
  rendererManager: RendererManager;
  lights: Lights;
  defaultGroundSize: number;
  defaultPixelRatio: number;
  baseToneMappingExposure: number;
  baseLightIntensities: ViewerLightIntensities;
};

export type ViewerDisplayFacade = {
  get shadowIntensity(): number;
  set shadowIntensity(_value: number);
};

export type ViewerSelectionSystems = {
  selectionOutline: SelectionOutlineController;
  wallSelectionOutline: WallSelectionOutlineController;
  highlightManager: HighlightManager;
  internalSelectionOutline: InternalSelectionOutline;
  multiSelectionOutline: MultiSelectionOutline;
};

export type ViewerMaterialSystems = {
  materialPipeline: MaterialPipelineFacade;
  displayMaterials: DisplayMaterialController;
  ultraMaterials: UltraMaterialController;
};

export function createViewerFoundation(
  container: HTMLElement,
  options: ViewerOptions,
  isMobile: boolean
): ViewerFoundation {
  const background = options.background ?? options.scene?.background;
  const sceneManager = new SceneManager({
    background,
    environment: options.environment,
  });
  const defaultGroundSize = options.environment?.groundSize ?? 20;
  const cameraManager = new CameraManager(options.camera);
  const rendererManager = new RendererManager(container, {
    ...options.renderer,
    clearColor: background,
  });
  const shadowMapSize = isMobile ? 1024 : (options.lights?.shadowMapSize ?? 4096);
  const lights = new Lights(sceneManager.scene, {
    ...options.lights,
    shadowMapSize,
  });

  return {
    sceneManager,
    cameraManager,
    rendererManager,
    lights,
    defaultGroundSize,
    defaultPixelRatio: rendererManager.renderer.getPixelRatio(),
    baseToneMappingExposure: rendererManager.renderer.toneMappingExposure,
    baseLightIntensities: {
      ambient: lights.ambient.intensity,
      hemisphere: lights.hemisphere.intensity,
      key: lights.keyLight.intensity,
      fill: lights.fillLight.intensity,
      rim: lights.rimLight.intensity,
    },
  };
}

export function createViewerDisplayFacade(deps: {
  getShadowIntensity: () => number;
  updateShadowIntensity: (_value: number) => void;
}): ViewerDisplayFacade {
  return {
    get shadowIntensity() {
      return deps.getShadowIntensity();
    },
    set shadowIntensity(value: number) {
      deps.updateShadowIntensity(value);
    },
  };
}

export function createViewerControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  options: ViewerOptions
): Controls | null {
  return options.enableControls === false
    ? null
    : new Controls(camera, domElement, options.controls);
}

export function createViewerSelectionSystems(deps: {
  scene: THREE.Scene;
  getBoxes: () => Map<string, ViewerBoxEntry>;
}): ViewerSelectionSystems {
  return {
    selectionOutline: new SelectionOutlineController({
      scene: deps.scene,
      getBoxes: deps.getBoxes,
    }),
    wallSelectionOutline: new WallSelectionOutlineController(deps.scene),
    highlightManager: new HighlightManager(deps.scene),
    internalSelectionOutline: new InternalSelectionOutline(deps.scene),
    multiSelectionOutline: new MultiSelectionOutline(deps.scene),
  };
}

export function createViewerMaterialSystems(): ViewerMaterialSystems {
  return {
    materialPipeline: createMaterialPipelineFacade(),
    displayMaterials: new DisplayMaterialController(),
    ultraMaterials: new UltraMaterialController(),
  };
}
