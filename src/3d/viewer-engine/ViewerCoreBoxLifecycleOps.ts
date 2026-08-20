import * as THREE from "three";
import type { BoxPanelIds } from "../../core/types";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import type { LoadedWoodMaterial } from "../materials/WoodMaterial";
import type { BoxOptions } from "../objects/BoxBuilder";
import { filterViewerDrillMarkersForMesh } from "./drill/viewerCncDrillFilter";
import type { BoxEngine } from "./box/BoxEngine";
import type { ViewerBoxManager } from "./box";
import type { BoxSceneController } from "./box/BoxSceneController";
import type { MeasurementEngine } from "./measurement/MeasurementEngine";
import type { ViewerState } from "./state";
import type { ViewerBoxEntry } from "./types";
import { devLogger } from "../../utils/devLogger";

export type ViewerCoreBoxLifecycleOpsDeps = {
  boxes: Map<string, ViewerBoxEntry>;
  boxManager: ViewerBoxManager;
  boxSceneController: BoxSceneController;
  ensureBoxEngine: () => BoxEngine;
  viewerState: ViewerState;
  defaultMaterialName: string;
  pendingBoxStructureUpdates: Map<string, Partial<BoxOptions>>;
  pendingMaterialSyncContext: Map<
    string,
    { drawerLayerItems?: DrawerLayerItem[]; frenteFixaMaterialId?: string | null }
  >;
  appliedRotationByMeshUuid: Map<string, number>;
  selectedBoxChangeListeners: Set<(_id: string | null) => void>;
  measurementEngine: MeasurementEngine;
  loadMaterial: (materialName: string) => LoadedWoodMaterial | null;
  shouldUseFeetLock: (entry: {
    cabinetType?: "lower" | "upper";
    feetEnabled?: boolean;
  }) => boolean;
  getFixedYForCabinet: (entry: {
    height: number;
    cabinetType?: "lower" | "upper";
    pe_cm?: number;
  }) => number;
  applyRotationIfNeeded: (
    mesh: THREE.Object3D | null | undefined,
    rotation?: { x?: number; y?: number; z?: number }
  ) => void;
  syncEdgeOutlines: () => void;
  requestRender: () => void;
  sceneRootAdd: (object: THREE.Object3D) => void;
  updateBoxMaterial: (boxId: string, materialName: string) => void;
  reapplyDisplayMaterials: () => void;
  applyPanelIdsToBox: (
    root: THREE.Object3D,
    boxId: string,
    panelIds?: Partial<BoxPanelIds> | null,
    materialPresetId?: string
  ) => void;
  applyExplodedViewForObject: (root: THREE.Object3D) => void;
  syncFeetVisualForBox: (entry: ViewerBoxEntry) => void;
  applyPanelVisibilityForObject: (root: THREE.Object3D) => void;
  syncOrlaForBox: (boxId: string) => void;
  syncRemateVisuals: () => void;
  getLockEnabled: () => boolean;
  applyFloorConstraint: (mesh: THREE.Object3D) => void;
  applyCatalogModelScale: (
    entry: { width: number; height: number; depth: number },
    model: THREE.Object3D
  ) => void;
  reflowBoxes: () => void;
  updateCameraTarget: () => void;
  updateCameraTargetToBox: (
    boxId: string,
    cameraOptions?: { onlyMovePositionIfOutOfFrame?: boolean }
  ) => void;
  refreshViewerAttachmentsAfterMeshMutation: () => void;
  updateModelsVerticalPosition: (entry: {
    cadModels: Array<{ object: THREE.Object3D }>;
    height: number;
  }) => void;
  hasRoomBounds: () => boolean;
  isMeshInsideOrTouchingRoom: (mesh: THREE.Object3D) => boolean;
  applyRoomConstraint: (mesh: THREE.Object3D, roomOptions?: { ignoreY?: boolean }) => void;
  setSelectedBox: (id: string | null) => void;
  clearModelsFromBox: (boxId: string) => void;
};

export function updateBoxImpl(
  deps: ViewerCoreBoxLifecycleOpsDeps,
  id: string,
  options: Partial<BoxOptions> = {}
): boolean {
  const entry = deps.boxes.get(id);
  const opts = options ?? {};
  const hasDimOpts =
    opts.width !== undefined ||
    opts.height !== undefined ||
    opts.depth !== undefined ||
    opts.size !== undefined ||
    opts.layoutDepthM !== undefined ||
    opts.carcassDepthM !== undefined;
  if (import.meta.env.DEV && hasDimOpts) {
    devLogger.debug("[ViewerCore.updateBox] chamado com dimensões", {
      id,
      entry: !!entry,
      width: opts.width,
      height: opts.height,
      depth: opts.depth,
      layoutDepthM: opts.layoutDepthM,
      carcassDepthM: opts.carcassDepthM,
    });
  }
  if (!entry) return false;
  if ("frenteFixaMaterialId" in opts) {
    const v =
      typeof opts.frenteFixaMaterialId === "string" ? opts.frenteFixaMaterialId.trim() : "";
    entry.frenteFixaMaterialId = v || undefined;
  }
  if (
    (opts.size !== undefined && (!Number.isFinite(opts.size) || opts.size <= 0)) ||
    (opts.width !== undefined && (!Number.isFinite(opts.width) || opts.width <= 0)) ||
    (opts.height !== undefined && (!Number.isFinite(opts.height) || opts.height <= 0)) ||
    (opts.depth !== undefined && (!Number.isFinite(opts.depth) || opts.depth <= 0)) ||
    (opts.layoutDepthM !== undefined &&
      (!Number.isFinite(opts.layoutDepthM) || opts.layoutDepthM <= 0)) ||
    (opts.carcassDepthM !== undefined &&
      (!Number.isFinite(opts.carcassDepthM) || opts.carcassDepthM <= 0))
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

  // Atualização apenas de posição/rotação (ex.: após drag ou sync do projeto). Não fazer rebuild (updateBoxGroup/createDoorObject).
  const structurePlan = deps.ensureBoxEngine().createUpdateBoxStructurePlan(entry, opts);
  const { onlyTransform, hasStructureOpts } = structurePlan;
  if (onlyTransform && !hasStructureOpts) {
    if (import.meta.env.DEV) {
      devLogger.debug("[DOOR-MAT] ViewerCore.updateBox ramo onlyTransform — NÃO chama updateBoxGroup", { boxId: id, onlyTransform: true, hasStructureOpts: false });
    }
    // Defesa: ignorar updates externos de posição/rotação enquanto o drag estiver activo
    // para esta caixa. O Fix principal está em objectChange (notifyBoxTransform removido
    // durante drag), mas este guard protege contra qualquer outro caminho que chame updateBox.
    const isActiveDragForThisBox =
      deps.viewerState.getTransformControlsDragging() &&
      deps.viewerState.getSelectedBox() === id;
    return deps.ensureBoxEngine().applyOnlyTransformUpdate({
      entry,
      opts,
      isActiveDragForThisBox,
      shouldUseFeetLock: (boxEntry) => deps.shouldUseFeetLock(boxEntry),
      getFixedYForCabinet: (boxEntry) => deps.getFixedYForCabinet(boxEntry),
      applyRotationIfNeeded: (mesh, rotation) => deps.applyRotationIfNeeded(mesh, rotation),
      syncEdgeOutlines: () => deps.syncEdgeOutlines(),
    });
  }

  const { dimensionsChanged, structureChanged } = structurePlan;
  if (structureChanged && deps.viewerState.getTransformControlsDragging()) {
    deps.pendingBoxStructureUpdates.set(id, {
      ...(deps.pendingBoxStructureUpdates.get(id) ?? {}),
      ...opts,
    });
    return true;
  }
  if (structureChanged) {
    deps.ensureBoxEngine().applyStructuralUpdate({
      id,
      entry,
      opts,
      plan: structurePlan,
      defaultMaterialName: deps.defaultMaterialName,
      loadMaterial: (materialName) => deps.loadMaterial(materialName),
      filterViewerDrillMarkersForMesh,
      deleteRotationCacheForMesh: (meshUuid) => deps.appliedRotationByMeshUuid.delete(meshUuid),
      sceneRootAdd: (object) => deps.sceneRootAdd(object),
      syncEdgeOutlines: () => deps.syncEdgeOutlines(),
      requestRender: () => deps.requestRender(),
      logStructuralRebuild: import.meta.env.DEV && dimensionsChanged
        ? (payload) => devLogger.debug("[ViewerCore.updateBox] mesh reconstruído (estrutura alterada)", payload)
        : undefined,
    });
  }
  if (opts.materialName) {
    deps.pendingMaterialSyncContext.set(id, {
      drawerLayerItems: opts.drawerLayerItems,
      // Só string explícita = override. undefined/vazio = preservar (nunca null→corpo).
      frenteFixaMaterialId:
        typeof opts.frenteFixaMaterialId === "string" && opts.frenteFixaMaterialId.trim()
          ? opts.frenteFixaMaterialId.trim()
          : undefined,
    });
  }
  try {
    return deps.boxSceneController.applyPostUpdateFlow({
      id,
      entry,
      opts,
      plan: structurePlan,
      defaultMaterialName: deps.defaultMaterialName,
      updateBoxMaterial: (boxId, materialName) => deps.updateBoxMaterial(boxId, materialName),
      reapplyDisplayMaterials: () => deps.reapplyDisplayMaterials(),
      shouldUseFeetLock: (boxEntry) => deps.shouldUseFeetLock(boxEntry),
      getFixedYForCabinet: (boxEntry) => deps.getFixedYForCabinet(boxEntry),
      applyRotationIfNeeded: (mesh, rotation) => deps.applyRotationIfNeeded(mesh, rotation),
      applyPanelIdsToBox: (root, boxId, panelIds, materialPresetId) =>
        deps.applyPanelIdsToBox(root, boxId, panelIds, materialPresetId),
      applyExplodedViewForObject: (root) => deps.applyExplodedViewForObject(root),
      syncFeetVisualForBox: (boxEntry) => deps.syncFeetVisualForBox(boxEntry),
      applyPanelVisibilityForObject: (root) => deps.applyPanelVisibilityForObject(root),
      syncOrlaForBox: (boxId) => deps.syncOrlaForBox(boxId),
      syncRemateVisuals: () => deps.syncRemateVisuals(),
      getLockEnabled: () => deps.getLockEnabled(),
      applyFloorConstraint: (mesh) => deps.applyFloorConstraint(mesh),
      applyCatalogModelScale: (boxEntry, model) => deps.applyCatalogModelScale(boxEntry, model),
      reflowBoxes: () => deps.reflowBoxes(),
      updateCameraTarget: () => deps.updateCameraTarget(),
      updateCameraTargetToBox: (boxId, cameraOptions) =>
        deps.updateCameraTargetToBox(boxId, cameraOptions),
      refreshViewerAttachmentsAfterMeshMutation: () => deps.refreshViewerAttachmentsAfterMeshMutation(),
      updateModelsVerticalPosition: (boxEntry) => deps.updateModelsVerticalPosition(boxEntry),
      hasRoomBounds: () => deps.hasRoomBounds(),
      isMeshInsideOrTouchingRoom: (mesh) => deps.isMeshInsideOrTouchingRoom(mesh),
      applyRoomConstraint: (mesh, roomOptions) => deps.applyRoomConstraint(mesh, roomOptions),
      isSelectedBox: (boxId) => boxId === deps.viewerState.getSelectedBox(),
      notifySelectedBoxChange: (boxId) => {
        deps.selectedBoxChangeListeners.forEach((cb) => {
          try {
            cb(boxId);
          } catch {
            /* ignore */
          }
        });
      },
      syncEdgeOutlines: () => deps.syncEdgeOutlines(),
      requestRender: () => deps.requestRender(),
    });
  } finally {
    deps.pendingMaterialSyncContext.delete(id);
  }
}

export function removeBoxImpl(deps: ViewerCoreBoxLifecycleOpsDeps, id: string): boolean {
  const removed = deps.boxSceneController.removeBox({
    id,
    boxes: deps.boxes,
    boxManager: deps.boxManager,
    getSelectedBoxId: () => deps.viewerState.getSelectedBox(),
    clearSelectedBox: () => deps.setSelectedBox(null),
    clearModelsFromBox: (boxId) => deps.clearModelsFromBox(boxId),
    syncEdgeOutlines: () => deps.syncEdgeOutlines(),
    deleteRotationCacheForMesh: (meshUuid) => deps.appliedRotationByMeshUuid.delete(meshUuid),
    reflowBoxes: () => deps.reflowBoxes(),
    updateCameraTarget: () => deps.updateCameraTarget(),
  });
  if (removed) deps.measurementEngine.onSceneContentChanged();
  return removed;
}

export function clearBoxesImpl(deps: ViewerCoreBoxLifecycleOpsDeps): void {
  Array.from(deps.boxes.keys()).forEach((id) => removeBoxImpl(deps, id));
  deps.measurementEngine.onSceneContentChanged();
}
