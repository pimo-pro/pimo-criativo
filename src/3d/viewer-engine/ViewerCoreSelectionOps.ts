import * as THREE from "three";
import { decodeSelectionId } from "../../core/viewer/selectionIds";
import { devLogger } from "../../utils/devLogger";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { EdgeOutlineBoxEntry, EdgeOutlineSystem } from "../outline";
import type { HighlightManager } from "./highlight";
import type { InternalSelectionOutline, InternalSelectionState } from "./selection";
import { cloneInternalSelectionState } from "./selection";
import type { MultiOutlineTarget, MultiSelectionOutline } from "./selection/MultiSelectionOutline";
import type { SelectionOutlineController } from "./overlays/SelectionOutlineController";
import type { WallSelectionOutlineController } from "./overlays/WallSelectionOutlineController";
import type { RodapeVisualBridge, RodapeVisualizer } from "./rodape/RodapeVisualizer";
import type { RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import type { SceneManager } from "./scene/SceneManager";
import type { ViewerState } from "./state/ViewerState";
import type { ViewerBoxEntry } from "./types";
import { isObjectInScreenRect } from "./utils/screenSelection";
import type { ViewerCoreRoomWallEntry } from "./ViewerCoreRoomGeometry";

export type ViewerCoreSelectionOpsDeps = {
  viewerState: ViewerState;
  getHighlightManager: () => HighlightManager | null;
  updateOutline: () => void;
  selectionOutline: SelectionOutlineController;
  getMultiSelectionOutline: () => MultiSelectionOutline | null;
  wallSelectionOutline: WallSelectionOutlineController;
  getEdgeOutlineSystem: () => EdgeOutlineSystem | null;
  getInternalSelectionOutline: () => InternalSelectionOutline | null;
  sceneManager: SceneManager;
  boxes: Map<string, ViewerBoxEntry>;
  getRoomBoxWalls: () => ViewerCoreRoomWallEntry[];
  getCamera: () => THREE.Camera;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
  getRemateVisualBridge: () => RematePieceVisualBridge | null;
  getRodapeVisualBridge: () => RodapeVisualBridge | null;
  rodapeVisualizer: RodapeVisualizer;
  wallGizmo: WallGizmo | null;
  refreshTransformControlsAttachment: () => void;
  onWallSelected: ((wallId: number | null) => void) | null;
  onBoxSelected: ((id: string | null) => void) | null;
  selectedBoxChangeListeners: Set<(id: string | null) => void>;
  onMeasurementSelectionChanged: (boxId: string | null) => void;
  onInternalSurfaceSelected: ((hit: InternalSelectionState) => void) | null;
  onInternalEdgeSelected: ((hit: InternalSelectionState) => void) | null;
  onInternalPointSelected: ((hit: InternalSelectionState) => void) | null;
  applyPanelVisibilityForAllBoxes: () => void;
  isObjectAttachedToScene: (object: THREE.Object3D) => boolean;
};

export function setHighlightEnabledImpl(deps: ViewerCoreSelectionOpsDeps, enabled: boolean): void {
  deps.viewerState.setHighlightEnabled(Boolean(enabled));
  deps.getHighlightManager()?.setEnabled(deps.viewerState.getHighlightEnabled());
  refreshOutlineTargetImpl(deps);
  deps.applyPanelVisibilityForAllBoxes();
}

export function refreshOutlineTargetImpl(deps: ViewerCoreSelectionOpsDeps): void {
  deps.updateOutline();
}

export function setOutlineTargetImpl(
  deps: ViewerCoreSelectionOpsDeps,
  mesh: THREE.Object3D | null,
  opacity: number,
  colorHex: number
): void {
  deps.selectionOutline.setTarget(mesh, opacity, colorHex);
}

export function setHoveredBoxImpl(deps: ViewerCoreSelectionOpsDeps, id: string | null): void {
  if (deps.viewerState.getHoveredBox() === id) return;
  deps.viewerState.setHoveredBox(id);
  if (id != null) deps.viewerState.setHoveredRemate(null);
  refreshOutlineTargetImpl(deps);
}

export function setHoveredRemateImpl(deps: ViewerCoreSelectionOpsDeps, id: string | null): void {
  if (deps.viewerState.getHoveredRemate() === id) return;
  deps.viewerState.setHoveredRemate(id);
  if (id != null) deps.viewerState.setHoveredBox(null);
  refreshOutlineTargetImpl(deps);
}

export function resolveMultiOutlineTargetImpl(
  deps: ViewerCoreSelectionOpsDeps,
  encoded: string
): MultiOutlineTarget | null {
  const decoded = decodeSelectionId(encoded);
  if (!decoded) return null;

  if (decoded.kind === "box") {
    const entry = deps.boxes.get(decoded.id);
    if (!entry) return null;
    return {
      mesh: entry.mesh,
      layoutDims: {
        w: Math.max(0.001, entry.width),
        h: Math.max(0.001, entry.height),
        d: Math.max(0.001, entry.carcassDepth ?? entry.depth),
      },
    };
  }

  if (decoded.kind === "remate") {
    const mesh = deps.getRemateMesh(decoded.id);
    return mesh ? { mesh } : null;
  }

  if (decoded.kind === "rodape") {
    const mesh = deps.rodapeVisualizer.getMeshByRodapeId(decoded.id);
    return mesh ? { mesh } : null;
  }

  if (decoded.kind === "door") {
    for (const entry of deps.boxes.values()) {
      const doorGroup = entry.mesh.children.find((c) => c.name === `door-layer-${decoded.id}`);
      if (doorGroup) return { mesh: doorGroup };
    }
    return null;
  }

  if (decoded.kind === "drawer") {
    for (const entry of deps.boxes.values()) {
      const drawerGroup = entry.mesh.children.find((c) => c.name === `drawer-layer-${decoded.id}`);
      if (drawerGroup) return { mesh: drawerGroup };
    }
    return null;
  }

  return null;
}

export function resolveMemberMeshImpl(deps: ViewerCoreSelectionOpsDeps, encoded: string): THREE.Object3D | null {
  return resolveMultiOutlineTargetImpl(deps, encoded)?.mesh ?? null;
}

export function getSelectionIdsInScreenRectImpl(
  deps: ViewerCoreSelectionOpsDeps,
  rect: { left: number; top: number; right: number; bottom: number },
  canvas: HTMLCanvasElement
): string[] {
  const canvasRect = canvas.getBoundingClientRect();
  const selectionRect = {
    left: Math.min(rect.left, rect.right),
    top: Math.min(rect.top, rect.bottom),
    right: Math.max(rect.left, rect.right),
    bottom: Math.max(rect.top, rect.bottom),
  };
  const camera = deps.getCamera();
  const ids: string[] = [];

  deps.boxes.forEach((entry, boxId) => {
    entry.mesh.updateMatrixWorld(true);
    if (isObjectInScreenRect(entry.mesh, selectionRect, camera, canvasRect)) {
      ids.push(`box:${boxId}`);
    }
  });

  const rematePieces = deps.getRemateVisualBridge()?.listRematePieces() ?? [];
  for (const piece of rematePieces) {
    const mesh = deps.getRemateMesh(piece.id);
    if (!mesh) continue;
    mesh.updateMatrixWorld(true);
    if (isObjectInScreenRect(mesh, selectionRect, camera, canvasRect)) {
      ids.push(`remate:${piece.id}`);
    }
  }

  const rodapes = (deps.getRodapeVisualBridge()?.listBoxRodapeConfigs() ?? []).flatMap((c) => c.rodapes);
  for (const rodape of rodapes) {
    const mesh = deps.rodapeVisualizer.getMeshByRodapeId(rodape.id);
    if (!mesh) continue;
    mesh.updateMatrixWorld(true);
    if (isObjectInScreenRect(mesh, selectionRect, camera, canvasRect)) {
      ids.push(`rodape:${rodape.id}`);
    }
  }

  return ids;
}

export function getEdgeOutlineBoxesMapImpl(
  deps: ViewerCoreSelectionOpsDeps
): ReadonlyMap<string, EdgeOutlineBoxEntry> {
  const map = new Map<string, EdgeOutlineBoxEntry>();
  deps.boxes.forEach((entry, id) => {
    map.set(id, {
      mesh: entry.mesh,
      width: entry.width,
      height: entry.height,
      carcassDepth: entry.carcassDepth,
      depth: entry.depth,
      cadOnly: entry.cadOnly,
    });
  });
  return map;
}

export function syncEdgeOutlineRootImpl(deps: ViewerCoreSelectionOpsDeps): void {
  deps.getEdgeOutlineSystem()?.syncRoot(deps.sceneManager.root, getEdgeOutlineBoxesMapImpl(deps));
}

export function setSelectedBoxImpl(
  deps: ViewerCoreSelectionOpsDeps,
  id: string | null,
  options?: { preserveGroupMembers?: boolean }
): void {
  if (import.meta.env.DEV) {
    devLogger.debug("[SELECTION][ViewerCore] setSelectedBox:entrada", {
      nextBoxId: id,
      currentSelectionBefore: deps.viewerState.getSelectedBox(),
      callerStack:
        id == null
          ? new Error("[SELECTION] setSelectedBox(null) trace").stack
          : undefined,
    });
  }
  if (deps.viewerState.getSelectedBox() === id) {
    if (import.meta.env.DEV) {
      devLogger.debug("[SELECTION][ViewerCore] setSelectedBox:sem-mudanca", {
        sameBoxId: id,
      });
      devLogger.debug("[SELECTION][ViewerCore] onBoxSelected:emit", {
        boxId: id,
        reason: "same-selection-short-circuit",
      });
    }
    deps.onBoxSelected?.(id);
    return;
  }
  deps.viewerState.setSelectedBox(id);
  deps.viewerState.setSelectedRemate(null);
  deps.viewerState.setSelectedDivSep(null);
  deps.viewerState.setSelectedWallIndex(null);
  deps.viewerState.setSelectedRoomElementId(null);
  if (!options?.preserveGroupMembers) {
    deps.viewerState.clearGroupTransformMemberIds();
  }
  deps.refreshTransformControlsAttachment();
  refreshOutlineTargetImpl(deps);
  if (import.meta.env.DEV) {
    devLogger.debug("[SELECTION][ViewerCore] setSelectedBox:apos-update-state", {
      nextBoxId: id,
      currentSelectionAfter: deps.viewerState.getSelectedBox(),
    });
    devLogger.debug("[SELECTION][ViewerCore] onBoxSelected:emit", {
      boxId: id,
    });
  }
  deps.onBoxSelected?.(id);
  deps.selectedBoxChangeListeners.forEach((cb) => {
    try {
      cb(id);
    } catch {
      /* ignore */
    }
  });
  if (id == null) {
    deps.onMeasurementSelectionChanged(null);
    setInternalSelectionImpl(deps, null);
    return;
  }
  deps.onMeasurementSelectionChanged(id);
}

export function selectWallByIndexImpl(deps: ViewerCoreSelectionOpsDeps, index: number | null): void {
  deps.viewerState.setSelectedWallIndex(
    index !== null && deps.getRoomBoxWalls().some((w) => w.id === index) ? index : null
  );
  const wallGizmo = deps.wallGizmo;
  if (wallGizmo) {
    if (deps.viewerState.getWallEditMode() && deps.viewerState.getSelectedWallIndex() !== null) {
      const wall = deps
        .getRoomBoxWalls()
        .find((w) => w.id === deps.viewerState.getSelectedWallIndex())?.mesh;
      if (wall) wallGizmo.attach(wall);
    } else {
      wallGizmo.detach();
    }
  }
  deps.refreshTransformControlsAttachment();
  refreshOutlineTargetImpl(deps);
  deps.onWallSelected?.(deps.viewerState.getSelectedWallIndex());
}

export function selectRoomElementByIdImpl(deps: ViewerCoreSelectionOpsDeps, elementId: string | null): void {
  deps.viewerState.setSelectedRoomElementId(elementId);
  if (elementId) deps.viewerState.setSelectedRoomUtilityId(null);
  deps.refreshTransformControlsAttachment();
  refreshOutlineTargetImpl(deps);
}

export function selectRoomUtilityByIdImpl(deps: ViewerCoreSelectionOpsDeps, utilityId: string | null): void {
  deps.viewerState.setSelectedRoomUtilityId(utilityId);
  if (utilityId) deps.viewerState.setSelectedRoomElementId(null);
  deps.refreshTransformControlsAttachment();
  refreshOutlineTargetImpl(deps);
}

export function setInternalSelectionImpl(
  deps: ViewerCoreSelectionOpsDeps,
  selection: InternalSelectionState | null
): void {
  const prev = deps.viewerState.getInternalSelection();
  const next = selection ? cloneInternalSelectionState(selection) : null;
  const same =
    prev?.type === next?.type &&
    prev?.boxId === next?.boxId &&
    prev?.faceId === next?.faceId &&
    prev?.edgeId === next?.edgeId &&
    prev?.pointId === next?.pointId;
  if (same) return;

  deps.viewerState.setInternalSelection(next);
  deps
    .getInternalSelectionOutline()
    ?.sync(next, (boxId) => deps.boxes.get(boxId)?.mesh ?? null);

  if (!next) return;
  if (next.type === "internal-face") deps.onInternalSurfaceSelected?.(next);
  else if (next.type === "internal-edge") deps.onInternalEdgeSelected?.(next);
  else if (next.type === "internal-point") deps.onInternalPointSelected?.(next);
}

export function sanitizeSelectionOutlineStaleTargetImpl(deps: ViewerCoreSelectionOpsDeps): void {
  deps.selectionOutline.sanitizeStaleTarget((object) => deps.isObjectAttachedToScene(object));
}

export function updateSelectionOverlaysFrameImpl(deps: ViewerCoreSelectionOpsDeps): void {
  deps.selectionOutline.updateFrame();
  deps.getMultiSelectionOutline()?.updateMatrices();
  deps.getHighlightManager()?.update();
  deps.getEdgeOutlineSystem()?.update();

  const selectedWallIndex = deps.viewerState.getSelectedWallIndex();
  const wallEntry =
    selectedWallIndex !== null
      ? deps.getRoomBoxWalls().find((w) => w.id === selectedWallIndex)
      : null;
  deps.wallSelectionOutline.update(wallEntry ? { mesh: wallEntry.mesh } : null);
}

export function disposeSelectionSystemsImpl(deps: ViewerCoreSelectionOpsDeps): void {
  deps.selectionOutline.dispose();
  deps.getMultiSelectionOutline()?.dispose(deps.sceneManager.scene);
  deps.wallSelectionOutline.dispose();
  const highlightManager = deps.getHighlightManager();
  if (highlightManager) {
    highlightManager.dispose();
  }
  const edgeOutlineSystem = deps.getEdgeOutlineSystem();
  if (edgeOutlineSystem) {
    edgeOutlineSystem.dispose();
  }
  const internalSelectionOutline = deps.getInternalSelectionOutline();
  if (internalSelectionOutline) {
    internalSelectionOutline.dispose();
  }
}
