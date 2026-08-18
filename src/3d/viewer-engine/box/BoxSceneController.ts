import * as THREE from "three";

import { buildBoxLegacy, updateBoxGroup, type BoxOptions } from "../../objects/BoxBuilder";
import type { LoadedWoodMaterial } from "../../materials/WoodMaterial";
import type { ViewerDrillMarkersByPanel } from "../../../core/types";
import { resolveNoBackPanelFromOptions } from "../../../core/box/backPanelFlags";
import { tagBoxGroupWithId } from "@/viewer/core/viewerUtils";
import type { ViewerBoxEntry } from "../types";
import type { ViewerBoxManager } from "./BoxManager";
import {
  isViewerLayoutProxyObject,
  VIEWER_LAYOUT_PROXY_LAYER,
} from "./boxAabbUtils";

type IndexedBoxEntry = {
  index: number;
};

type LayoutBoundsEntry = {
  mesh: THREE.Object3D;
  width: number;
  height: number;
  depth: number;
  cadOnly?: boolean;
  layoutBoundsMesh?: THREE.Mesh;
};

const VIEWER_LAYOUT_BOUNDS_NAME = "viewer-layout-bounds";

type BoxIdentityInput = {
  id: string;
  options?: BoxOptions;
};

type BoxRegistryDeps = {
  boxes: Map<string, ViewerBoxEntry>;
  boxManager: ViewerBoxManager;
};

type BoxMaterialBuildDeps = {
  defaultMaterialName: string;
  loadMaterial: (_materialName: string) => LoadedWoodMaterial | null;
  filterViewerDrillMarkersForMesh: (_markers: ViewerDrillMarkersByPanel) => ViewerDrillMarkersByPanel;
};

type BoxTransformDeps = {
  getFixedYForCabinet: (_entry: {
    height: number;
    cabinetType?: "lower" | "upper";
    pe_cm?: number;
  }) => number;
  applyRotationIfNeeded: (
    _mesh: THREE.Object3D,
    _rotation?: { x?: number; y?: number; z?: number }
  ) => void;
};

type BoxSceneVisualDeps = {
  syncFeetVisualForBox: (_entry: ViewerBoxEntry) => void;
  applyPanelIdsToBox: (
    _root: THREE.Object3D,
    _boxId: string,
    _panelIds: BoxOptions["panelIds"],
    _materialPresetId: string
  ) => void;
  applyPanelVisibilityForObject: (_root: THREE.Object3D) => void;
  applyExplodedViewForObject: (_root: THREE.Object3D) => void;
  syncOrlaForBox: (_boxId: string) => void;
  syncRemateForBox: (_boxId: string) => void;
  syncEdgeOutlines: () => void;
  reapplyDisplayMaterials: () => void;
};

type BoxRoomConstraintDeps = {
  isMeshInsideOrTouchingRoom: (_mesh: THREE.Object3D) => boolean;
  hasRoomBounds: () => boolean;
  getLockEnabled: () => boolean;
  applyRoomConstraint: (_mesh: THREE.Object3D, _options?: { ignoreY?: boolean }) => void;
};

type BoxLayoutCameraDeps = {
  reflowBoxes: () => void;
  updateCameraTarget: () => void;
};

type BoxTargetCameraDeps = BoxLayoutCameraDeps & {
  updateCameraTargetToBox: (_boxId: string, _options?: { onlyMovePositionIfOutOfFrame?: boolean }) => void;
};

type BoxRenderDeps = {
  requestRender: () => void;
};

type InitialBoxBuildResult = {
  opts: BoxOptions;
  box: THREE.Object3D;
  entry: ViewerBoxEntry;
  cadOnly: boolean;
  width: number;
  height: number;
  layoutDepth: number;
  index: number;
  manualPosition: boolean;
  cabinetType: "lower" | "upper" | undefined;
  feetEnabled: boolean;
  feetHeight: number;
  feetOffsetFront: number;
  materialName: string;
};

type InitialBoxBuildParams = BoxIdentityInput & BoxMaterialBuildDeps & {
  nextIndex: number;
  heightBaseCm: number;
};

type AddBoxFlowParams = InitialBoxBuildParams &
  BoxRegistryDeps &
  BoxTransformDeps &
  BoxSceneVisualDeps &
  BoxRoomConstraintDeps &
  BoxTargetCameraDeps & {
  sceneAdd: (_object: THREE.Object3D) => void;
  applyBackgroundMode: () => void;
  ensureBoxesBaseAtFloor: () => void;
};

type RemoveBoxFlowParams = BoxRegistryDeps & BoxLayoutCameraDeps & {
  id: string;
  getSelectedBoxId: () => string | null;
  clearSelectedBox: () => void;
  clearModelsFromBox: (_boxId: string) => void;
  syncEdgeOutlines: () => void;
  deleteRotationCacheForMesh: (_meshUuid: string) => void;
};

type ApplyStructuralUpdateParams = {
  id: string;
  entry: ViewerBoxEntry;
  opts: Partial<BoxOptions>;
  plan: UpdateBoxStructurePlan;
} & BoxMaterialBuildDeps & BoxRenderDeps & {
  deleteRotationCacheForMesh: (_meshUuid: string) => void;
  sceneRootAdd: (_object: THREE.Object3D) => void;
  syncEdgeOutlines: () => void;
  logStructuralRebuild?: (_payload: {
    boxId: string;
    width: number;
    height: number;
    layoutDepth: number;
    carcassDepth: number;
  }) => void;
};

type OnlyTransformUpdateParams = {
  entry: ViewerBoxEntry;
  opts: Partial<BoxOptions>;
  isActiveDragForThisBox: boolean;
  syncEdgeOutlines: () => void;
  shouldUseFeetLock: (_entry: ViewerBoxEntry) => boolean;
} & BoxTransformDeps;

type PostUpdateFlowParams = {
  id: string;
  entry: ViewerBoxEntry;
  opts: Partial<BoxOptions>;
  plan: UpdateBoxStructurePlan;
  defaultMaterialName: string;
} & BoxTransformDeps & BoxSceneVisualDeps & BoxRoomConstraintDeps & BoxTargetCameraDeps & BoxRenderDeps & {
  updateBoxMaterial: (_boxId: string, _materialName: string) => void;
  shouldUseFeetLock: (_entry: ViewerBoxEntry) => boolean;
  applyFloorConstraint: (_mesh: THREE.Object3D) => void;
  applyCatalogModelScale: (_entry: ViewerBoxEntry, _model: THREE.Object3D) => void;
  refreshViewerAttachmentsAfterMeshMutation: () => void;
  updateModelsVerticalPosition: (_entry: { cadModels: Array<{ object: THREE.Object3D }>; height: number }) => void;
  isSelectedBox: (_boxId: string) => boolean;
  notifySelectedBoxChange: (_boxId: string) => void;
};

export type UpdateBoxStructurePlan = {
  onlyTransform: boolean;
  hasStructureOpts: boolean;
  dimensionsChanged: boolean;
  structureChanged: boolean;
  width: number;
  height: number;
  layoutDepth: number;
  carcassDepth: number;
  heightChanged: boolean;
  hasLayerUpdate: boolean;
};

/**
 * Controller interno do domínio de caixas no scene graph.
 * Fase 4.1: contém apenas helpers move-only; a API pública permanece no ViewerCore.
 */
export class BoxSceneController {
  addBox(params: AddBoxFlowParams): boolean {
    if (params.boxes.has(params.id)) return false;
    const initialBox = this.createInitialBox(params);
    const {
      opts,
      box,
      entry,
      cadOnly,
      height,
      manualPosition,
      cabinetType,
      feetEnabled,
      feetHeight,
      materialName,
    } = initialBox;
    const baseY = height / 2;
    // Posição inicial aplicada IMEDIATAMENTE; sem recenter, clamp, colisão nem bbox antes.
    let position =
      manualPosition && opts.position
        ? { x: opts.position.x, y: opts.position.y, z: opts.position.z }
        : cadOnly
          ? { x: 0, y: baseY, z: 0 }
          : (opts.position ?? { x: 0, y: baseY, z: 0 });
    if (cabinetType === "lower" && feetEnabled) {
      position = {
        ...position,
        y: params.getFixedYForCabinet({ height, cabinetType, pe_cm: feetHeight / 10 }),
      };
    }
    box.position.set(position.x, position.y, position.z);
    params.applyRotationIfNeeded(box, {
      x: opts.rotationX,
      y: opts.rotationY,
      z: opts.rotationZ,
    });
    // Registar no BoxManager ANTES de adicionar à cena (getRightmostX e restante lógica usam este mapa).
    params.boxManager.addEntry(params.id, entry);
    const createdEntry = params.boxes.get(params.id);
    if (createdEntry) {
      this.attachLayoutBoundsMesh(createdEntry);
      params.syncFeetVisualForBox(createdEntry);
    }
    params.sceneAdd(box);
    params.applyPanelIdsToBox(box, params.id, opts.panelIds, materialName);
    params.applyPanelVisibilityForObject(box);
    params.applyExplodedViewForObject(box);
    params.syncOrlaForBox(params.id);
    params.syncRemateForBox(params.id);
    tagBoxGroupWithId(box, params.id);
    params.syncEdgeOutlines();
    params.applyBackgroundMode();
    params.reapplyDisplayMaterials();
    if (params.hasRoomBounds() && params.isMeshInsideOrTouchingRoom(box)) {
      // auto-rotate disabled — centralizado no snapping
      // applyAutoRotateToRoom(box, { snapPosition: lockEnabled });
      if (params.getLockEnabled()) params.applyRoomConstraint(box, { ignoreY: manualPosition });
    }
    // Base do box em Y=0 (após exploded view) e câmera no centro do bbox real — só após box totalmente construído.
    params.ensureBoxesBaseAtFloor();
    params.reflowBoxes();
    if (params.boxes.size === 1) {
      params.updateCameraTargetToBox(params.id, { onlyMovePositionIfOutOfFrame: true });
    } else {
      params.updateCameraTarget();
    }
    return true;
  }

  removeBox(params: RemoveBoxFlowParams): boolean {
    const entry = params.boxes.get(params.id);
    if (!entry) return false;
    if (params.getSelectedBoxId() === params.id) {
      params.clearSelectedBox();
    }
    params.clearModelsFromBox(params.id);
    this.disposeBoxMeshFromScene(entry.mesh);
    params.syncEdgeOutlines();
    if (entry.material) {
      entry.material.textures.forEach((texture) => texture.dispose());
    }
    params.boxManager.removeEntry(params.id);
    params.deleteRotationCacheForMesh(entry.mesh.uuid);
    params.reflowBoxes();
    params.updateCameraTarget();
    return true;
  }

  applyOnlyTransformUpdate(params: OnlyTransformUpdateParams): boolean {
    const { entry, opts } = params;
    if (!params.isActiveDragForThisBox) {
      if (entry.manualPosition && !opts.position) {
        // nada a alterar
      } else if (opts.position && !params.shouldUseFeetLock(entry)) {
        entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
      } else if (params.shouldUseFeetLock(entry)) {
        const fixedY = params.getFixedYForCabinet({
          height: entry.height,
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
      }
      params.applyRotationIfNeeded(entry.mesh, {
        x: opts.rotationX,
        y: opts.rotationY,
        z: opts.rotationZ,
      });
    }
    if (opts.costaRotationY !== undefined) {
      (entry.mesh as THREE.Object3D & { userData: { costaRotationY?: number } }).userData.costaRotationY =
        Number.isFinite(opts.costaRotationY) ? opts.costaRotationY : 0;
    }
    if (opts.manualPosition !== undefined) {
      entry.manualPosition = opts.manualPosition;
    }
    if (opts.locked !== undefined) {
      entry.locked = opts.locked === true;
    }
    entry.mesh.updateMatrixWorld(true);
    params.syncEdgeOutlines();
    return true;
  }

  createUpdateBoxStructurePlan(
    entry: ViewerBoxEntry,
    opts: Partial<BoxOptions>
  ): UpdateBoxStructurePlan {
    const onlyTransform =
      opts.position !== undefined ||
      opts.rotationX !== undefined ||
      opts.rotationY !== undefined ||
      opts.rotationZ !== undefined ||
      opts.manualPosition !== undefined ||
      opts.costaRotationY !== undefined;
    const hasStructureOpts =
      opts.width !== undefined ||
      opts.height !== undefined ||
      opts.depth !== undefined ||
      opts.layoutDepthM !== undefined ||
      opts.carcassDepthM !== undefined ||
      opts.size !== undefined ||
      opts.shelves !== undefined ||
      opts.doorLayerItems !== undefined ||
      opts.drawerLayerItems !== undefined ||
      opts.drillMarkersByPanel !== undefined ||
      opts.thickness !== undefined ||
      opts.noBackPanel !== undefined ||
      opts.costaAtiva !== undefined;

    let width = entry.width;
    let height = entry.height;
    let layoutDepth = entry.depth;
    let carcassDepth = entry.carcassDepth ?? layoutDepth;
    const dimensionsChanged =
      opts.width !== undefined ||
      opts.height !== undefined ||
      opts.depth !== undefined ||
      opts.layoutDepthM !== undefined ||
      opts.carcassDepthM !== undefined ||
      opts.size !== undefined ||
      opts.thickness !== undefined;
    const structureChanged =
      dimensionsChanged ||
      opts.shelves !== undefined ||
      opts.doorLayerItems !== undefined ||
      opts.drawerLayerItems !== undefined ||
      opts.drillMarkersByPanel !== undefined ||
      opts.noBackPanel !== undefined ||
      opts.costaAtiva !== undefined;

    if (structureChanged) {
      // Clamp mínimo: evita geometria 0 → avisos WebGL X4008 / divisão por zero.
      width = Math.max(0.001, Number(opts.width ?? opts.size ?? width) || 0.001);
      height = Math.max(0.001, Number(opts.height ?? opts.size ?? height) || 0.001);
      layoutDepth = Math.max(
        0.001,
        Number(opts.layoutDepthM ?? opts.depth ?? opts.size ?? layoutDepth) || 0.001
      );
      carcassDepth = Math.max(
        0.001,
        Number(opts.carcassDepthM ?? opts.depth ?? opts.size ?? layoutDepth) || 0.001
      );
    }

    return {
      onlyTransform,
      hasStructureOpts,
      dimensionsChanged,
      structureChanged,
      width,
      height,
      layoutDepth,
      carcassDepth,
      heightChanged: height !== entry.height,
      hasLayerUpdate:
        opts.doorLayerItems !== undefined ||
        opts.drawerLayerItems !== undefined ||
        opts.drillMarkersByPanel !== undefined,
    };
  }

  applyStructuralUpdate(params: ApplyStructuralUpdateParams): void {
    const { id, entry, opts, plan } = params;
    const { dimensionsChanged, width, height, layoutDepth, carcassDepth, hasLayerUpdate } = plan;

    // Só pular updateBoxGroup para caixa CAD-only quando não há alteração de dimensões nem de portas/gavetas.
    if (entry.cadOnly && !hasLayerUpdate && !dimensionsChanged) {
      if (!entry.manualPosition) {
        entry.mesh.position.y = height / 2;
      }
      return;
    }

    const emptyDrillMarkers: ViewerDrillMarkersByPanel = {
      cima: [],
      fundo: [],
      lateral_esquerda: [],
      lateral_direita: [],
      porta: [],
      frente_fixa: [],
    };
    const drillMarkers: ViewerDrillMarkersByPanel =
      opts.drillMarkersByPanel ?? emptyDrillMarkers;
    const materialName = opts.materialName ?? entry.materialName ?? params.defaultMaterialName;
    const loadedMat = entry.material ?? params.loadMaterial(materialName) ?? params.loadMaterial("mdf_branco");
    const boxOptions: BoxOptions = {
      ...opts,
      width,
      height,
      depth: carcassDepth,
      thickness: opts.thickness ?? 0.019,
      shelves: opts.shelves,
      doorLayerItems: opts.doorLayerItems,
      drawerLayerItems: opts.drawerLayerItems,
      drillMarkersByPanel: params.filterViewerDrillMarkersForMesh(drillMarkers),
      materialName,
    };
    if (loadedMat?.material != null) boxOptions.material = loadedMat.material;

    const canIncrementalUpdate = !dimensionsChanged && !entry.cadOnly;
    if (canIncrementalUpdate) {
      updateBoxGroup(entry.mesh as THREE.Group, boxOptions);
      tagBoxGroupWithId(entry.mesh, id);
      this.applyViewerDrillHoleSceneRules(entry.mesh);
      entry.width = width;
      entry.height = height;
      entry.depth = layoutDepth;
      entry.carcassDepth = carcassDepth;
      if (!entry.material && loadedMat) entry.material = loadedMat;
      params.syncEdgeOutlines();
      params.requestRender();
      return;
    }

    const savedPosition = new THREE.Vector3().setFromMatrixPosition(entry.mesh.matrixWorld);
    const savedQuaternion = new THREE.Quaternion().copy(entry.mesh.quaternion);
    const savedCostaRotationY = (entry.mesh as THREE.Object3D & { userData: { costaRotationY?: number } }).userData?.costaRotationY;

    // Desanexar modelos CAD antes de dispor o mesh (não dispor os GLBs).
    const cadModels = entry.cadModels ? [...entry.cadModels] : [];
    cadModels.forEach((m) => {
      if (m.object.parent) m.object.parent.remove(m.object);
    });

    params.deleteRotationCacheForMesh(entry.mesh.uuid);
    this.disposeBoxMeshFromScene(entry.mesh);

    let newBox: THREE.Object3D;
    if (entry.cadOnly) {
      newBox = new THREE.Group();
      newBox.name = id;
    } else {
      newBox = buildBoxLegacy(boxOptions);
      tagBoxGroupWithId(newBox, id);
      if (!entry.material && loadedMat) entry.material = loadedMat;
    }

    this.prepareBoxRoot(
      newBox,
      id,
      opts.costaRotationY != null && Number.isFinite(opts.costaRotationY)
        ? opts.costaRotationY
        : savedCostaRotationY ?? 0
    );
    newBox.position.copy(savedPosition);
    newBox.quaternion.copy(savedQuaternion);

    entry.mesh = newBox;
    entry.drillMarkersByPanel = drillMarkers;

    params.sceneRootAdd(newBox);
    cadModels.forEach((m) => newBox.add(m.object));

    params.logStructuralRebuild?.({
      boxId: id,
      width,
      height,
      layoutDepth,
      carcassDepth,
    });

    // [CORRIGIDO 2026-03] Forçar rebuild completo do Scene Graph após mesh rebuild (sem alterar transforms ou offsets)
    params.syncEdgeOutlines();
    params.requestRender();
  }

  applyPostUpdateFlow(params: PostUpdateFlowParams): boolean {
    const { id, entry, opts, plan } = params;
    const {
      dimensionsChanged,
      structureChanged,
      width,
      height,
      layoutDepth,
      carcassDepth,
      heightChanged,
    } = plan;
    let indexChanged = false;

    if (opts.index !== undefined && opts.index !== entry.index) {
      entry.index = opts.index;
      indexChanged = true;
    }
    if (opts.materialName && !entry.cadOnly) {
      params.updateBoxMaterial(id, opts.materialName);
      // Sem sync automático de frentes de gaveta — só updateDrawerMaterial (UI).
      params.reapplyDisplayMaterials();
    }
    this.applyEntryOptionFlags(entry, opts);
    if (entry.manualPosition && !opts.position) {
      // Nunca alterar position.x/y/z quando manualPosition sem opts.position explícito.
    } else if (opts.position && !params.shouldUseFeetLock(entry)) {
      entry.mesh.position.set(opts.position.x, opts.position.y, opts.position.z);
    } else if (params.shouldUseFeetLock(entry)) {
      const fixedY = params.getFixedYForCabinet({
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
    if (dimensionsChanged && !entry.manualPosition && !params.shouldUseFeetLock(entry)) {
      entry.mesh.position.y = height / 2;
    }
    params.applyRotationIfNeeded(entry.mesh, {
      x: opts.rotationX,
      y: opts.rotationY,
      z: opts.rotationZ,
    });
    params.applyPanelIdsToBox(
      entry.mesh,
      id,
      opts.panelIds,
      opts.materialName ?? entry.materialName ?? params.defaultMaterialName
    );
    params.applyExplodedViewForObject(entry.mesh);
    if (opts.costaRotationY !== undefined) {
      (entry.mesh as THREE.Object3D & { userData: { costaRotationY?: number } }).userData.costaRotationY =
        Number.isFinite(opts.costaRotationY) ? opts.costaRotationY : 0;
    }
    if (opts.manualPosition !== undefined) {
      entry.manualPosition = opts.manualPosition;
    }
    entry.mesh.updateMatrixWorld();
    entry.mesh.matrixAutoUpdate = true;
    this.applyEntryDimensions(entry, {
      width,
      height,
      layoutDepth,
      carcassDepth,
    });
    this.applyNoBackPanelState(entry, opts);
    if (structureChanged) {
      this.attachLayoutBoundsMesh(entry);
    }
    params.syncFeetVisualForBox(entry);
    tagBoxGroupWithId(entry.mesh, id);
    if (opts.drillMarkersByPanel !== undefined) {
      entry.drillMarkersByPanel = opts.drillMarkersByPanel;
    }
    // Recriar overlays de bordas/furos no mesh reconstruído (structureChanged).
    // applyPanelVisibilityForObject lê entry.drillMarkersByPanel (já atualizado acima)
    // e mesh.userData.boxId (setado por applyPanelIdsToBox). Deve ser chamado aqui,
    // pois updateBox não chama applyPanelVisibilityForObject (diferente de addBox).
    if (structureChanged) {
      params.applyPanelVisibilityForObject(entry.mesh);
    }
    // Sem sync automático de frentes de gaveta após rebuild estrutural.
    params.syncOrlaForBox(id);
    params.syncRemateForBox(id);
    if (params.getLockEnabled()) params.applyFloorConstraint(entry.mesh);
    if (dimensionsChanged && entry.cadOnly) {
      entry.cadModels.forEach((model) => {
        if (model.object.userData?.isCatalogGlb) {
          params.applyCatalogModelScale(entry, model.object);
        }
      });
    }
    const reflowNeeded =
      indexChanged || (dimensionsChanged && entry.cadOnly);
    if (reflowNeeded) {
      params.reflowBoxes();
      if (!structureChanged) params.updateCameraTarget();
    }
    if (structureChanged) {
      params.updateCameraTargetToBox(id, { onlyMovePositionIfOutOfFrame: true });
      params.refreshViewerAttachmentsAfterMeshMutation();
    }
    if (heightChanged && !entry.cadOnly) {
      params.updateModelsVerticalPosition(entry);
    }
    if (params.hasRoomBounds() && params.isMeshInsideOrTouchingRoom(entry.mesh)) {
      // auto-rotate disabled — centralizado no snapping
      // applyAutoRotateToRoom(entry.mesh, { snapPosition: lockEnabled });
      if (params.getLockEnabled()) params.applyRoomConstraint(entry.mesh, { ignoreY: entry.manualPosition });
    }
    if (params.isSelectedBox(id)) {
      params.notifySelectedBoxChange(id);
    }
    params.syncEdgeOutlines();

    // Forçar render imediato após alteração estrutural (rebuild do mesh) para que furações e geometria nova apareçam sem segunda ação.
    if (structureChanged) {
      params.requestRender();
    }
    return true;
  }

  applyEntryOptionFlags(entry: ViewerBoxEntry, opts: Partial<BoxOptions>): void {
    if (opts.cabinetType !== undefined) {
      entry.cabinetType =
        opts.cabinetType === "lower" || opts.cabinetType === "upper"
          ? opts.cabinetType
          : undefined;
    }
    if (opts.pe_cm !== undefined) entry.pe_cm = opts.pe_cm;
    if (opts.feetHeight !== undefined) {
      entry.feetHeight = Math.max(40, opts.feetHeight);
      entry.pe_cm = entry.feetHeight / 10;
    }
    if (opts.feetOffsetFront !== undefined) {
      entry.feetOffsetFront = Math.max(0, opts.feetOffsetFront);
    }
    if (opts.feetEnabled !== undefined) entry.feetEnabled = opts.feetEnabled;
    if (opts.autoRotateEnabled !== undefined) entry.autoRotateEnabled = opts.autoRotateEnabled;
    if (opts.locked !== undefined) entry.locked = opts.locked === true;
  }

  applyEntryDimensions(
    entry: ViewerBoxEntry,
    dims: { width: number; height: number; layoutDepth: number; carcassDepth: number }
  ): void {
    entry.width = dims.width;
    entry.height = dims.height;
    entry.depth = dims.layoutDepth;
    entry.carcassDepth = dims.carcassDepth;
  }

  applyNoBackPanelState(entry: ViewerBoxEntry, opts: Partial<BoxOptions>): void {
    if (opts.noBackPanel !== undefined || opts.costaAtiva !== undefined) {
      entry.noBackPanel = resolveNoBackPanelFromOptions({
        noBackPanel: opts.noBackPanel ?? entry.noBackPanel,
        costaAtiva: opts.costaAtiva,
      });
    }
  }

  createInitialBox(params: InitialBoxBuildParams): InitialBoxBuildResult {
    const { id, defaultMaterialName, nextIndex, heightBaseCm } = params;
    const opts = params.options ?? {};
    const cadOnly = opts.cadOnly === true;
    const { width, height, depth: layoutDepth } = this.getBoxDimensionsFromOptions(opts);
    const index = opts.index ?? nextIndex;
    const manualPosition = opts.manualPosition === true;
    const carcassDepthForEntry = cadOnly
      ? layoutDepth
      : Math.max(0.001, opts.carcassDepthM ?? opts.depth ?? layoutDepth);

    let box: THREE.Object3D;
    let material: LoadedWoodMaterial | null = null;
    const materialName = opts.materialName ?? defaultMaterialName;

    if (cadOnly) {
      box = new THREE.Group();
      box.name = id;
    } else {
      material = params.loadMaterial(materialName) ?? params.loadMaterial("mdf_branco");
      const emptyDrill: ViewerDrillMarkersByPanel = {
        cima: [],
        fundo: [],
        lateral_esquerda: [],
        lateral_direita: [],
        porta: [],
        frente_fixa: [],
      };
      const boxOptions: BoxOptions = {
        ...opts,
        width: opts.width ?? 1,
        height: opts.height ?? 1,
        depth: carcassDepthForEntry,
        thickness: opts.thickness ?? 0.019,
        index: opts.index,
        materialName,
        drillMarkersByPanel: params.filterViewerDrillMarkersForMesh(
          opts.drillMarkersByPanel ?? emptyDrill
        ),
      };
      if (material?.material != null) {
        boxOptions.material = material.material;
      }
      box = buildBoxLegacy(boxOptions);
      tagBoxGroupWithId(box, id);
    }

    this.prepareBoxRoot(
      box,
      id,
      opts.costaRotationY != null && Number.isFinite(opts.costaRotationY) ? opts.costaRotationY : 0
    );

    const cabinetType =
      opts.cabinetType === "lower" || opts.cabinetType === "upper"
        ? opts.cabinetType
        : undefined;
    const feetEnabled = opts.feetEnabled ?? (cabinetType === "lower");
    const feetHeight = Math.max(40, opts.feetHeight ?? ((opts.pe_cm ?? heightBaseCm) * 10));
    const feetOffsetFront = Math.max(0, opts.feetOffsetFront ?? 100);

    return {
      opts,
      box,
      cadOnly,
      width,
      height,
      layoutDepth,
      index,
      manualPosition,
      cabinetType,
      feetEnabled,
      feetHeight,
      feetOffsetFront,
      materialName,
      entry: {
        mesh: box,
        width,
        height,
        carcassDepth: carcassDepthForEntry,
        depth: layoutDepth,
        index,
        cadOnly: cadOnly || undefined,
        manualPosition,
        cabinetType: cabinetType ?? undefined,
        pe_cm: feetHeight / 10,
        feetHeight,
        feetOffsetFront,
        feetEnabled,
        autoRotateEnabled: opts.autoRotateEnabled !== false,
        locked: opts.locked === true,
        cadModels: [],
        material,
        drillMarkersByPanel: opts.drillMarkersByPanel,
        materialName,
        frenteFixaMaterialId:
          typeof opts.frenteFixaMaterialId === "string" && opts.frenteFixaMaterialId.trim()
            ? opts.frenteFixaMaterialId.trim()
            : undefined,
        noBackPanel: resolveNoBackPanelFromOptions(opts),
      },
    };
  }

  getBoxDimensionsFromOptions(options?: BoxOptions): { width: number; height: number; depth: number } {
    const width = Math.max(0.001, options?.width ?? options?.size ?? 1);
    const height = Math.max(0.001, options?.height ?? options?.size ?? 1);
    const depth = Math.max(
      0.001,
      options?.layoutDepthM ?? options?.depth ?? options?.size ?? 1
    );
    return { width, height, depth };
  }

  getNextBoxIndex(boxes: Map<string, IndexedBoxEntry>): number {
    if (boxes.size === 0) return 0;
    let maxIndex = -1;
    boxes.forEach((entry) => {
      if (entry.index > maxIndex) {
        maxIndex = entry.index;
      }
    });
    return maxIndex + 1;
  }

  prepareBoxRoot(root: THREE.Object3D, boxId: string, costaRotationY: number): void {
    root.frustumCulled = false;
    root.matrixAutoUpdate = true;
    root.visible = true;
    root.layers.set(0);
    root.userData.boxId = boxId;
    // Garantir que todos os descendentes estejam na layer 0 para o raycaster detectar clique.
    root.traverse((child) => {
      if (isViewerLayoutProxyObject(child)) {
        child.layers.set(VIEWER_LAYOUT_PROXY_LAYER);
        return;
      }
      child.layers.set(0);
    });
    this.applyViewerDrillHoleSceneRules(root);
    root.userData.costaRotationY = Number.isFinite(costaRotationY) ? costaRotationY : 0;
  }

  /**
   * Objetos marcados como furo CNC auxiliar (malha dedicada): invisíveis e sem raycast.
   * Os furos estruturais em painéis são filtrados antes do CSG via viewerCncDrillFilter.
   */
  applyViewerDrillHoleSceneRules(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (node.userData?.isDrillHole === true) {
        node.visible = false;
        if (node instanceof THREE.Mesh) {
          node.raycast = () => null;
        }
      }
    });
  }

  /**
   * Proxy LxAxP de layout: `visible: false` no render; só `visible: true` temporariamente em
   * `runWithLayoutBoundsProxiesVisible` para bbox de câmara. Material não escreve cor/depth.
   */
  attachLayoutBoundsMesh(entry: LayoutBoundsEntry): void {
    const existing = entry.mesh.getObjectByName(VIEWER_LAYOUT_BOUNDS_NAME);
    if (existing) {
      entry.mesh.remove(existing);
      if (existing instanceof THREE.Mesh) {
        existing.geometry.dispose();
        const mat = existing.material;
        if (!Array.isArray(mat) && mat instanceof THREE.Material) mat.dispose();
      }
    }
    entry.layoutBoundsMesh = undefined;
    if (entry.cadOnly) return;

    const w = Math.max(0.001, entry.width);
    const h = Math.max(0.001, entry.height);
    const d = Math.max(0.001, entry.depth);
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      colorWrite: false,
    });
    const m = new THREE.Mesh(geom, mat);
    m.name = VIEWER_LAYOUT_BOUNDS_NAME;
    m.renderOrder = -999999;
    m.frustumCulled = false;
    m.raycast = () => null;
    m.userData.viewerLayoutBounds = true;
    m.layers.set(VIEWER_LAYOUT_PROXY_LAYER);
    entry.mesh.add(m);
    m.visible = false;
    entry.layoutBoundsMesh = m;
  }

  /** Remove e dispõe geometrias/materiais do mesh da cena (não dispõe entry.material, que é cache). */
  disposeBoxMeshFromScene(mesh: THREE.Object3D): void {
    if (mesh.parent) mesh.parent.remove(mesh);
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    mesh.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.geometry && !disposedGeometries.has(node.geometry)) {
        node.geometry.dispose();
        disposedGeometries.add(node.geometry);
      }
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => {
          if (!disposedMaterials.has(m)) {
            m.dispose();
            disposedMaterials.add(m);
          }
        });
      } else if (node.material && !disposedMaterials.has(node.material)) {
        node.material.dispose();
        disposedMaterials.add(node.material);
      }
    });
  }
}
