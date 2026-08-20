import * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { keepModelInsideRoom, preventModelWallIntersection } from "../collision/ModelCollision";
import type { DoorWindowConfig } from "../room/types";
import type { RoomBuilder } from "../room/RoomBuilder";
import { historyManager } from "../../core/viewer/historyManager";
import { decodeSelectionId } from "../../core/viewer/selectionIds";
import { applyRemateRotationSnapToMesh } from "../../core/remate/remateRotationSnap";
import { isTampoAngularConfig } from "../../core/remate/tampoAngle";
import { resolveRemateTransformRoot } from "./remate/remateLCompositeVisual";
import type { RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import type { RodapeVisualizer } from "./rodape/RodapeVisualizer";
import type { DivSepVisualBridge } from "./divSep/DivSepVisualBridge";
import {
  clampDivisorLocalX,
  clampSeparadorLocalY,
} from "../../core/divSep/dragCoords";
import type { DivisorItem, SeparadorItem } from "../../core/divSep/types";
import type { SelectedDivSep, ViewerState } from "./state/ViewerState";
import { expandBox3ByObjectExcludingLayoutProxy } from "./box/boxAabbUtils";
import type { ViewerBoxEntry } from "./types";
import type { SnapDebugData } from "../snapping/ModelWallSnap";
import type { TransformConstraints, ClampTransformContext } from "./constraints/TransformConstraints";
import type { SnapEngine, SnapAlignTarget } from "./snapping/SnapEngine";
import type { RemateSmartSnapping } from "./snapping/RemateSmartSnapping";
import type { SmartSnapping } from "./snapping/SmartSnapping";
import type { SmartAlignSnapEngine } from "./snapping/SmartAlignSnapEngine";
import type { ViewerTools } from "./tools";
import type { GroupGizmo } from "./tools/GroupGizmo";
import type { ViewerOverlayCoordinator } from "./overlays/ViewerOverlayCoordinator";
import type { MeasurementEngine } from "./measurement/MeasurementEngine";
import { shouldProcessTransformDragEnd } from "./transforms/transformDragLifecycle";
import { devLogger } from "../../utils/devLogger";
import type { Controls } from "./controls";

export type ViewerCoreTransformRoomWallEntry = {
  id: number;
  mesh: THREE.Mesh;
};

export type ViewerCoreTransformOpsDeps = {
  viewerState: ViewerState;
  boxes: Map<string, ViewerBoxEntry>;
  groupGizmo: GroupGizmo | null;
  constraints: TransformConstraints;
  snapEngine: SnapEngine;
  remateSmartSnapping: RemateSmartSnapping;
  smartSnappingEngine: SmartSnapping;
  smartAlignSnapEngine: SmartAlignSnapEngine;
  viewerTools: ViewerTools;
  overlayCoordinator: ViewerOverlayCoordinator;
  measurementEngine: MeasurementEngine;
  roomBuilder: RoomBuilder;
  boundingBox: THREE.Box3;
  getTransformControls: () => TransformControls | null;
  getControls: () => Controls | null;
  getLockEnabled: () => boolean;
  getShiftKeyHeld: () => boolean;
  getDragStartZForShiftLock: () => number | undefined;
  setDragStartZForShiftLock: (value: number | undefined) => void;
  getIsApplyingTransformConstraints: () => boolean;
  setIsApplyingTransformConstraints: (value: boolean) => void;
  getTransformDragEndStamp: () => number;
  setTransformDragEndStamp: (stamp: number) => void;
  getTransformDiagnosticsEnabled: () => boolean;
  getSelectedDivSep: () => SelectedDivSep | null;
  getDivSepMesh: (selection: SelectedDivSep) => THREE.Object3D | null;
  getDivSepVisualBridge: () => DivSepVisualBridge | null;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
  getRemateVisualBridge: () => RematePieceVisualBridge | null;
  rodapeVisualizer: RodapeVisualizer;
  getRoomBounds: () => ClampTransformContext["roomBounds"];
  getRoomBoxWalls: () => ViewerCoreTransformRoomWallEntry[];
  applyFloorConstraint: (mesh: THREE.Object3D) => void;
  applyRoomConstraint: (obj: THREE.Object3D, options?: { ignoreY?: boolean }) => void;
  isMeshInsideOrTouchingRoom: (obj: THREE.Object3D) => boolean;
  clearSnapState: (obj: THREE.Object3D) => void;
  shouldUseFeetLock: (entry: ViewerBoxEntry) => boolean;
  getFixedYForCabinet: (entry: ViewerBoxEntry) => number;
  updateBoxesIntersectingWalls: () => void;
  setLastSnapDebugData: (data: SnapDebugData | null) => void;
  applyDynamicAlignSnap: (params: SnapAlignTarget) => void;
  applyFinishCollisionConstraint: (
    movingMesh: THREE.Object3D,
    excludeBoxId: string | undefined,
    excludeRemateId?: string,
    excludeRodapeId?: string
  ) => void;
  refreshGizmoAttachment: () => void;
  applyMousePresetToControls: () => void;
  onBoxTransform: ((
    boxId: string,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ) => void) | null;
  notifyRemateTransform: () => void;
  notifyHematiTransform: () => void;
  notifyRodapeTransform: () => void;
  notifyDivSepTransform: () => void;
  notifyWallTransform: () => void;
  notifyRoomElementTransform: () => void;
  notifyRoomUtilityTransform: () => void;
  getRoomUtilityById: (utilityId: string) => THREE.Object3D | null;
  onTransformDragEnd: (() => void) | null;
  flushDeferredBoxStructureUpdates: () => void;
  flushDeferredViewerVisualSyncs: () => void;
  refreshViewerAttachmentsAfterMeshMutation: () => void;
};

export function applyTransformControlsMouseGuardImpl(deps: ViewerCoreTransformOpsDeps): void {
  const controls = deps.getControls()?.controls;
  if (!controls) return;
  deps.applyMousePresetToControls();
}

export function logTransformDiagnosticImpl(
  deps: ViewerCoreTransformOpsDeps,
  event: string,
  payload?: Record<string, unknown>
): void {
  if (!deps.getTransformDiagnosticsEnabled()) return;
  const orbit = deps.getControls()?.controls;
  const target = deps.getTransformControls()?.object ?? null;
  devLogger.debug(`[Viewer][TransformDiag] ${event}`, {
    mode: deps.viewerState.getCurrentTool(),
    dragging: deps.viewerState.getTransformControlsDragging(),
    selectedBoxId: deps.viewerState.getSelectedBox(),
    orbitEnabled: orbit?.enabled ?? null,
    transformAttached: Boolean(target),
    targetUuid: target?.uuid ?? null,
    targetName: target?.name ?? null,
    targetMatrixAutoUpdate: target?.matrixAutoUpdate ?? null,
    targetPosition: target
      ? {
          x: Number(target.position.x.toFixed(4)),
          y: Number(target.position.y.toFixed(4)),
          z: Number(target.position.z.toFixed(4)),
        }
      : null,
    ...(payload ?? {}),
  });
}

export function setTransformModeImpl(
  deps: ViewerCoreTransformOpsDeps,
  mode: "translate" | "rotate" | "scale" | null
): void {
  deps.viewerState.setCurrentTool(mode);
  refreshTransformControlsAttachmentImpl(deps);
  applyTransformControlsMouseGuardImpl(deps);
}

export function refreshTransformControlsAttachmentImpl(deps: ViewerCoreTransformOpsDeps): void {
  deps.refreshGizmoAttachment();
}

export function setTransformAttachmentRefreshSuspendedImpl(_v: boolean): void {
  void _v;
}

export function applyGroupPivotTransformImpl(deps: ViewerCoreTransformOpsDeps): void {
  deps.groupGizmo?.applyPivotTransform();
}

export function applySmartSnapForGroupImpl(
  deps: ViewerCoreTransformOpsDeps,
  _pointerPosition?: { x: number; y: number; z: number }
): boolean {
  if (!deps.groupGizmo?.isActive()) return false;
  if (deps.viewerState.getCurrentTool() !== "translate") return false;
  if (!deps.viewerState.getTransformControlsDragging()) return false;

  const members = deps.groupGizmo.getMembers();
  let primaryBoxId: string | null = null;
  let primaryMesh: THREE.Object3D | null = null;
  for (const member of members) {
    const decoded = decodeSelectionId(member.encodedId);
    if (decoded?.kind !== "box") continue;
    primaryBoxId = decoded.id;
    primaryMesh = member.mesh;
    break;
  }
  if (!primaryBoxId || !primaryMesh) return false;

  const before = primaryMesh.position.clone();
  deps.applyDynamicAlignSnap({
    mesh: primaryMesh,
    entity: { kind: "box", id: primaryBoxId },
    isDragging: true,
    currentTool: "translate",
  });
  const delta = primaryMesh.position.clone().sub(before);
  if (delta.lengthSq() < 1e-10) return false;

  primaryMesh.position.copy(before);
  deps.groupGizmo.getPivot().position.add(delta);
  deps.groupGizmo.applyPivotTransform();
  return true;
}

export function notifyGroupTransformImpl(
  deps: ViewerCoreTransformOpsDeps,
  options?: { recordHistory?: boolean }
): void {
  if (!deps.groupGizmo?.isActive()) return;
  for (const member of deps.groupGizmo.getMembers()) {
    const decoded = decodeSelectionId(member.encodedId);
    if (!decoded) continue;
    if (decoded.kind === "box") {
      const entry = deps.boxes.get(decoded.id);
      if (entry?.locked) continue;
      const { x, y, z } = member.mesh.position;
      const r = member.mesh.rotation;
      deps.onBoxTransform?.(decoded.id, { x, y, z }, { x: r.x, y: r.y, z: r.z });
    } else if (decoded.kind === "remate") {
      deps.viewerState.setSelectedRemate(decoded.id);
      deps.notifyRemateTransform();
    } else if (decoded.kind === "rodape") {
      deps.viewerState.setSelectedRodape(decoded.id);
      deps.notifyRodapeTransform();
    }
  }
  if (options?.recordHistory) {
    historyManager.recordEvent("group.transform", "Transformar grupo");
  }
}

export function clampGroupTransformImpl(deps: ViewerCoreTransformOpsDeps): void {
  if (!deps.groupGizmo?.isActive()) return;
  if (deps.viewerState.getCurrentTool() !== "translate") return;
  if (!deps.viewerState.getTransformControlsDragging()) return;

  applySmartSnapForGroupImpl(deps);

  const members = deps.groupGizmo.getMembers();
  if (members.length === 0) return;

  const groupBoxIds = new Set<string>();
  for (const member of members) {
    const decoded = decodeSelectionId(member.encodedId);
    if (decoded?.kind === "box") groupBoxIds.add(decoded.id);
  }

  if (deps.getLockEnabled()) {
    deps.boundingBox.makeEmpty();
    for (const member of members) {
      member.mesh.updateMatrixWorld(true);
      expandBox3ByObjectExcludingLayoutProxy(deps.boundingBox, member.mesh);
    }
    if (!deps.boundingBox.isEmpty() && deps.boundingBox.min.y < 0) {
      const shiftY = -deps.boundingBox.min.y;
      deps.groupGizmo.getPivot().position.y += shiftY;
      for (const member of members) {
        member.mesh.position.y += shiftY;
      }
    }

    for (const member of members) {
      const decoded = decodeSelectionId(member.encodedId);
      if (decoded?.kind !== "box") continue;
      const entry = deps.boxes.get(decoded.id);
      if (!entry || entry.mesh !== member.mesh) continue;
      deps.applyFloorConstraint(member.mesh);
      deps.constraints.applyCollisionConstraint(member.mesh, deps.boxes, decoded.id, groupBoxIds);
      const roomBounds = deps.getRoomBounds();
      if (roomBounds && deps.isMeshInsideOrTouchingRoom(member.mesh)) {
        const wallsMain = deps
          .getRoomBoxWalls()
          .map((w) => w.mesh)
          .filter((w) => w.userData?.isMainWall === true);
        const allRoomWalls = deps.getRoomBoxWalls().map((w) => w.mesh);
        deps.snapEngine.snapMeshToNearestMainWall(member.mesh, wallsMain);
        preventModelWallIntersection(member.mesh, allRoomWalls);
        keepModelInsideRoom(member.mesh, roomBounds);
        deps.applyRoomConstraint(member.mesh, { ignoreY: entry.manualPosition });
      }
    }
  }

  deps.updateBoxesIntersectingWalls();
}

export function notifyBoxTransformImpl(deps: ViewerCoreTransformOpsDeps): void {
  if (!deps.viewerState.getSelectedBox()) return;
  const entry = deps.boxes.get(deps.viewerState.getSelectedBox());
  if (!entry) return;
  const p = entry.mesh.position;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    console.warn("[sanity] posição inválida em notifyBoxTransform — ignorado");
    return;
  }
  const { x, y, z } = p;
  const r = entry.mesh.rotation;
  deps.onBoxTransform?.(deps.viewerState.getSelectedBox(), { x, y, z }, { x: r.x, y: r.y, z: r.z });
}

export function handleTransformObjectChangeImpl(deps: ViewerCoreTransformOpsDeps): void {
  if (deps.getIsApplyingTransformConstraints()) return;
  deps.setIsApplyingTransformConstraints(true);
  try {
    if (deps.groupGizmo?.isActive()) {
      deps.groupGizmo.applyPivotTransform();
    }
    if (
      deps.viewerState.getTransformControlsDragging() &&
      deps.viewerState.getSelectedBox() &&
      deps.getShiftKeyHeld() &&
      deps.getDragStartZForShiftLock() !== undefined
    ) {
      const obj = deps.getTransformControls()!.object;
      if (obj && "position" in obj) (obj as THREE.Object3D).position.z = deps.getDragStartZForShiftLock()!;
    }
    deps.viewerTools.applyCurrentTool();
    deps.measurementEngine.onRulerMovementTick("transform");
    if (deps.groupGizmo?.isActive()) {
      notifyGroupTransformImpl(deps);
    } else if (deps.viewerState.getSelectedRemate()) {
      deps.notifyRemateTransform();
    } else {
      notifyBoxTransformImpl(deps);
    }
    logTransformDiagnosticImpl(deps, "drag(objectChange)");
  } finally {
    deps.setIsApplyingTransformConstraints(false);
  }
}

export function finishTransformDragImpl(
  deps: ViewerCoreTransformOpsDeps,
  _source: "mouseUp" | "dragging-changed"
): void {
  const stamp = performance.now();
  if (!shouldProcessTransformDragEnd(deps.getTransformDragEndStamp(), stamp)) return;
  deps.setTransformDragEndStamp(stamp);
  deps.setDragStartZForShiftLock(undefined);
  deps.viewerState.setTransformControlsDragging(false);
  deps.overlayCoordinator.clearTransientOverlays();
  deps.smartSnappingEngine.onDragEnd();
  deps.smartAlignSnapEngine.onDragEnd();
  deps.remateSmartSnapping.onDragEnd();
  deps.viewerState.setSuppressNextCanvasClick(true);
  if (deps.groupGizmo?.isActive()) {
    notifyGroupTransformImpl(deps, { recordHistory: true });
  }
  deps.viewerTools.restoreTransformGizmoPivot();
  deps.viewerTools.applyCurrentTool();
  notifyBoxTransformImpl(deps);
  deps.notifyRemateTransform();
  deps.notifyHematiTransform();
  deps.notifyRodapeTransform();
  deps.notifyDivSepTransform();
  deps.notifyWallTransform();
  deps.notifyRoomElementTransform();
  deps.notifyRoomUtilityTransform();
  historyManager.endDragSession();
  deps.onTransformDragEnd?.();
  deps.flushDeferredBoxStructureUpdates();
  deps.flushDeferredViewerVisualSyncs();
  deps.refreshViewerAttachmentsAfterMeshMutation();
}

export function getClampTransformContextImpl(deps: ViewerCoreTransformOpsDeps): ClampTransformContext {
  return {
    transformControls: deps.getTransformControls(),
    selectedBoxId: deps.viewerState.getSelectedBox(),
    selectedWallIndex: deps.viewerState.getSelectedWallIndex(),
    boxes: deps.boxes,
    currentTool: deps.viewerState.getCurrentTool(),
    lockEnabled: deps.getLockEnabled(),
    roomBounds: deps.getRoomBounds(),
    roomBoxWalls: deps.getRoomBoxWalls(),
    applyFloorConstraint: (obj) => deps.applyFloorConstraint(obj),
    applyRoomConstraint: (obj, options) => deps.applyRoomConstraint(obj, options),
    isMeshInsideOrTouchingRoom: (obj) => deps.isMeshInsideOrTouchingRoom(obj),
    clearSnapState: (obj) => deps.clearSnapState(obj),
    shouldUseFeetLock: (entry) => deps.shouldUseFeetLock(entry),
    getFixedYForCabinet: (entry) => deps.getFixedYForCabinet(entry),
    updateBoxesIntersectingWalls: () => deps.updateBoxesIntersectingWalls(),
    setLastSnapDebugData: (data) => {
      deps.setLastSnapDebugData(data);
    },
    snapMeshToNearestMainWall: (mesh, walls) => deps.snapEngine.snapMeshToNearestMainWall(mesh, walls),
  };
}

export function clampSelectedWallChildTransformImpl(deps: ViewerCoreTransformOpsDeps): void {
  const selectedId = deps.viewerState.getSelectedRoomElementId() ?? deps.viewerState.getSelectedRoomUtilityId();
  if (!selectedId) return;
  const object =
    deps.viewerState.getSelectedRoomElementId()
      ? deps.roomBuilder.getElementById(selectedId)
      : deps.getRoomUtilityById(selectedId);
  if (!object || !(object.parent instanceof THREE.Mesh)) return;
  const wall = object.parent as THREE.Mesh;
  const wallLenMm = (wall.userData.wallLengthMm as number | undefined) ?? 1000;
  const wallHeightMm = (wall.userData.wallHeightMm as number | undefined) ?? 2600;
  const wallLenM = wallLenMm / 1000;
  const wallHeightM = wallHeightMm / 1000;
  object.position.z = ((wall.userData.wallThicknessM as number | undefined) ?? 0.12) / 2 + 0.04;
  const widthMm =
    deps.viewerState.getSelectedRoomElementId()
      ? ((object.userData.config as DoorWindowConfig | undefined)?.widthMm ?? 0)
      : 0;
  const heightMm =
    deps.viewerState.getSelectedRoomElementId()
      ? ((object.userData.config as DoorWindowConfig | undefined)?.heightMm ?? 0)
      : 0;
  const minX = -wallLenM / 2 + widthMm / 2000;
  const maxX = wallLenM / 2 - widthMm / 2000;
  const minY = -wallHeightM / 2 + heightMm / 2000;
  const maxY = wallHeightM / 2 - heightMm / 2000;
  object.position.x = THREE.MathUtils.clamp(object.position.x, minX, maxX);
  object.position.y = THREE.MathUtils.clamp(object.position.y, minY, maxY);
}

export function clampTransformImpl(deps: ViewerCoreTransformOpsDeps): void {
  if (deps.groupGizmo?.isActive()) {
    clampGroupTransformImpl(deps);
    return;
  }
  if (deps.viewerState.getSelectedRoomElementId() || deps.viewerState.getSelectedRoomUtilityId()) {
    clampSelectedWallChildTransformImpl(deps);
    return;
  }

  const selectedRemateId = deps.viewerState.getSelectedRemate();
  const isDragging = deps.viewerState.getTransformControlsDragging();
  const currentTool = deps.viewerState.getCurrentTool();

  const selectedDivSep = deps.getSelectedDivSep();
  if (selectedDivSep) {
    const mesh = deps.getDivSepMesh(selectedDivSep);
    const obj = deps.getTransformControls()?.object;
    if (isDragging && mesh && obj === mesh && currentTool === "translate") {
      const entry = deps.boxes.get(selectedDivSep.boxId);
      const ctx = deps.getDivSepVisualBridge()?.getDivSepDragContext(
        selectedDivSep.boxId,
        selectedDivSep.kind,
        selectedDivSep.itemId
      );
      if (entry && ctx) {
        const dragStart = mesh.userData.divSepDragStart as
          | { x: number; y: number; z: number }
          | undefined;
        if (selectedDivSep.kind === "sep") {
          mesh.position.x = dragStart?.x ?? mesh.position.x;
          mesh.position.z = dragStart?.z ?? mesh.position.z;
          mesh.position.y = clampSeparadorLocalY(
            mesh.position.y,
            entry.height,
            ctx.box,
            ctx.item as SeparadorItem
          );
        } else {
          mesh.position.y = dragStart?.y ?? mesh.position.y;
          mesh.position.z = dragStart?.z ?? mesh.position.z;
          mesh.position.x = clampDivisorLocalX(
            mesh.position.x,
            entry.width,
            ctx.box,
            ctx.item as DivisorItem
          );
        }
      }
    }
    return;
  }

  if (selectedRemateId) {
    const rawMesh = deps.getRemateMesh(selectedRemateId);
    const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
    const obj = deps.getTransformControls()?.object;
    if (isDragging && mesh && obj === mesh) {
      const piece = deps.getRemateVisualBridge()?.listRematePieces().find((r) => r.id === selectedRemateId);
      const angular = isTampoAngularConfig(piece?.angleConfig, piece?.height);
      const boxId = piece?.parentBoxId ?? (mesh.userData.boxId as string | undefined);
      const entry = boxId ? deps.boxes.get(boxId) : undefined;

      const snapTarget = mesh as THREE.Mesh;
      const isLCimaComposite = mesh.userData?.isRemateLComposite === true;

      if (currentTool === "translate" && entry && piece && boxId && !isLCimaComposite && !angular) {
        const cfg = deps.getRemateVisualBridge()?.getBoxConfig(boxId);
        if (cfg) {
          deps.remateSmartSnapping.applyDuringTranslate({
            mesh: snapTarget,
            boxEntry: entry,
            boxConfig: cfg,
          });
        }
      } else if (currentTool === "translate" && piece && (!boxId || angular) && !isLCimaComposite) {
        deps.remateSmartSnapping.applyStandaloneGridSnap(snapTarget);
      } else if (currentTool === "rotate" && !isLCimaComposite && !angular) {
        applyRemateRotationSnapToMesh(snapTarget, entry?.mesh ?? null);
      }

      if (currentTool === "translate" && !isLCimaComposite && !angular) {
        deps.applyDynamicAlignSnap({
          mesh: snapTarget,
          entity: { kind: "remate", id: selectedRemateId, parentBoxId: boxId },
          isDragging,
          currentTool,
        });
      }

      if (currentTool === "translate" && mesh && obj === mesh && !angular) {
        const collisionBoxId = piece?.parentBoxId ?? (mesh.userData.boxId as string | undefined);
        deps.applyFinishCollisionConstraint(mesh, collisionBoxId, selectedRemateId);
      }
    }
    return;
  }

  if (deps.viewerState.getSelectedHemati()) {
    return;
  }

  const selectedRodapeId = deps.viewerState.getSelectedRodape();
  if (selectedRodapeId) {
    const mesh = deps.rodapeVisualizer.getMeshByRodapeId(selectedRodapeId);
    const obj = deps.getTransformControls()?.object;
    if (isDragging && mesh && obj === mesh && currentTool === "translate") {
      const boxId = mesh.userData.boxId as string | undefined;
      deps.applyDynamicAlignSnap({
        mesh,
        entity: { kind: "rodape", id: selectedRodapeId, parentBoxId: boxId },
        isDragging,
        currentTool,
      });
      deps.applyFinishCollisionConstraint(mesh, boxId, undefined, selectedRodapeId);
    }
    return;
  }

  const selectedBoxId = deps.viewerState.getSelectedBox();
  if (selectedBoxId && isDragging && currentTool === "translate") {
    const entry = deps.boxes.get(selectedBoxId);
    const obj = deps.getTransformControls()?.object;
    if (entry && obj === entry.mesh) {
      deps.snapEngine.applyBoxTranslatePipeline({
        align: {
          mesh: entry.mesh,
          entity: { kind: "box", id: selectedBoxId },
          isDragging,
          currentTool,
        },
        clampCtx: getClampTransformContextImpl(deps),
      });
      return;
    }
  }

  deps.constraints.clampTransform(getClampTransformContextImpl(deps));
}
