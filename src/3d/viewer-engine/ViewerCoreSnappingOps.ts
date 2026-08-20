import * as THREE from "three";
import { clearSnapUserData } from "@/viewer/core/viewerUtils";
import { mmToM } from "../../utils/units";
import { resolveRemateTransformRoot } from "./remate/remateLCompositeVisual";
import type { RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import type { RodapeVisualizer, RodapeVisualBridge } from "./rodape/RodapeVisualizer";
import type { ViewerBoxEntry } from "./types";
import type { ViewerCoreRoomBounds } from "./ViewerCoreRoomUtils";
import type { SnapEngine, SnapAlignTarget } from "./snapping/SnapEngine";
import type { SmartSnapping } from "./snapping/SmartSnapping";
import type { SmartAlignSnapEngine } from "./snapping/SmartAlignSnapEngine";
import type { SmartAlignOverlayFacade } from "./snapping/smartAlignOverlayFacade";
import type { RoomOpeningLike } from "./snapping/smartSnappingTypes";
import {
  DEFAULT_UNIFIED_CAPTURE_MM,
  DEFAULT_UNIFIED_MAGNET,
  type SmartAlignSnapContext,
  type SmartSnapEntity,
} from "./snapping/smartAlignSnapTypes";
import { getEntityWorldBoxAabb } from "./snapping/smartAlignSnapAabb";

export type ViewerCoreSnappingOpsDeps = {
  boxes: Map<string, ViewerBoxEntry>;
  snapEngine: SnapEngine;
  smartSnappingEngine: SmartSnapping;
  smartAlignSnapEngine: SmartAlignSnapEngine;
  smartAlignOverlay: SmartAlignOverlayFacade;
  getEnableSmartAlignSnap: () => boolean;
  getRoomBounds: () => ViewerCoreRoomBounds | null;
  getRoomOpeningsForSnapping: () => RoomOpeningLike[];
  getRemateVisualBridge: () => RematePieceVisualBridge | null;
  getRodapeVisualBridge: () => RodapeVisualBridge | null;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
  rodapeVisualizer: RodapeVisualizer;
};

export function clearSnapStateImpl(object: THREE.Object3D): void {
  clearSnapUserData(object);
}

export function clearSmartAlignSnapOverlayImpl(deps: ViewerCoreSnappingOpsDeps): void {
  deps.smartAlignOverlay.clear();
}

export function applyDynamicAlignSnapImpl(
  deps: ViewerCoreSnappingOpsDeps,
  params: SnapAlignTarget
): void {
  deps.snapEngine.applyDuringTranslate(params);
}

export function collectAllSnapEntitiesImpl(deps: ViewerCoreSnappingOpsDeps): SmartSnapEntity[] {
  const entities: SmartSnapEntity[] = [];
  deps.boxes.forEach((entry, id) => {
    entities.push({ kind: "box", id, mesh: entry.mesh as THREE.Mesh });
  });
  for (const piece of deps.getRemateVisualBridge()?.listRematePieces() ?? []) {
    const raw = deps.getRemateMesh(piece.id);
    const mesh = resolveRemateTransformRoot(raw) ?? raw;
    if (!mesh || !(mesh instanceof THREE.Mesh)) continue;
    entities.push({
      kind: "remate",
      id: piece.id,
      mesh,
      parentBoxId: piece.parentBoxId,
    });
  }
  for (const cfg of deps.getRodapeVisualBridge()?.listBoxRodapeConfigs() ?? []) {
    for (const rodape of cfg.rodapes) {
      const mesh = deps.rodapeVisualizer.getMeshByRodapeId(rodape.id);
      if (!mesh || !(mesh instanceof THREE.Mesh)) continue;
      entities.push({
        kind: "rodape",
        id: rodape.id,
        mesh,
        parentBoxId: cfg.boxId,
      });
    }
  }
  return entities;
}

export function buildSmartAlignSnapContextForDragImpl(
  deps: ViewerCoreSnappingOpsDeps
): SmartAlignSnapContext {
  return {
    boxes: deps.boxes,
    captureRadiusM: mmToM(DEFAULT_UNIFIED_CAPTURE_MM),
    magnetStrength: DEFAULT_UNIFIED_MAGNET,
    rematePieces: deps.getRemateVisualBridge()?.listRematePieces() ?? [],
    rodapes: (deps.getRodapeVisualBridge()?.listBoxRodapeConfigs() ?? []).flatMap((c) => c.rodapes),
    getBoxConfig: (boxId) => deps.getRemateVisualBridge()?.getBoxConfig(boxId) ?? null,
    getWorldAabb: (mesh) => getEntityWorldBoxAabb(mesh, "box"),
    roomBounds: deps.getRoomBounds(),
    roomBoundsFull: deps.getRoomBounds(),
    roomOpenings: deps.getRoomOpeningsForSnapping(),
    wallOffsetMm: deps.smartSnappingEngine.getWallOffset(),
    explicitModeActive: false,
    allEntities: collectAllSnapEntitiesImpl(deps),
  };
}

export function syncSmartAlignSnapOverlayFromEngineImpl(deps: ViewerCoreSnappingOpsDeps): void {
  if (!deps.getEnableSmartAlignSnap()) return;
  const state = deps.smartAlignSnapEngine.getOverlayState();
  if (state.visible) {
    deps.smartAlignOverlay.setState(state);
  } else {
    clearSmartAlignSnapOverlayImpl(deps);
  }
}

export function buildDisabledSmartSnapContextImpl(
  deps: ViewerCoreSnappingOpsDeps
): SmartAlignSnapContext {
  return {
    boxes: deps.boxes,
    captureRadiusM: 0,
    magnetStrength: 0,
    rematePieces: [],
    rodapes: [],
    getBoxConfig: () => null,
    getWorldAabb: (mesh) => {
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      return { min: box.min.clone(), max: box.max.clone(), center: box.getCenter(new THREE.Vector3()) };
    },
    roomBounds: null,
    roomBoundsFull: deps.getRoomBounds(),
    roomOpenings: [],
    wallOffsetMm: deps.smartSnappingEngine.getWallOffset(),
    explicitModeActive: false,
    allEntities: [],
  };
}
