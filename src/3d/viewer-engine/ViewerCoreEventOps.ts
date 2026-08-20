import * as THREE from "three";
import type { DoorWindowConfig } from "../room/types";
import type { ProjectRoomUtility } from "./room/roomEngineTypes";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { WallGizmo } from "../gizmos/WallGizmo";
import type { HighlightManager } from "./highlight";
import type { ViewerState, SelectedDivSep } from "./state/ViewerState";
import type { Controls } from "./controls";
import {
  applyCameraNavigationLock,
  getMouseInputMapping,
  getPointerActionForButton,
  shouldBlockPointerDownForSelection,
  type MouseInputPreset,
} from "./controls/MouseInputMapper";
import type { PointerPickingFacade } from "./input/PointerPickingFacade";
import type { InternalSelectionState } from "./selection";
import type { IViewerEventEngine, RoomElementHit } from "./events/EventEngineTypes";
import { encodeSelectionIdFromLayerHit } from "../../core/viewer/selectionHitEncoding";
import type { MouseMenuTarget } from "../../ui/context-menu/ContextMenuEngine";
import type { IndustrialDesignWorkspaceMode } from "./modes/IndustrialDesignWorkspaceMode";
import type { RendererManager } from "./renderer";
import type { CameraManager } from "./camera";

export type ViewerCoreEventRoomWallEntry = {
  id: number;
  mesh: THREE.Mesh;
};

export type ViewerCoreEventOpsDeps = {
  viewerState: ViewerState;
  rendererManager: RendererManager;
  cameraManager: CameraManager;
  pointerPicking: PointerPickingFacade;
  pointer: THREE.Vector2;
  raycaster: THREE.Raycaster;
  getHighlightManager: () => HighlightManager | null;
  roomBuilder: RoomBuilder;
  getRoomBoxWalls: () => ViewerCoreEventRoomWallEntry[];
  getWallGizmo: () => WallGizmo | null;
  getControls: () => Controls | null;
  getMouseInputPreset: () => MouseInputPreset;
  industrialDesignMode: IndustrialDesignWorkspaceMode;
  setSelectedBox: (id: string | null, options?: { preserveGroupMembers?: boolean }) => void;
  setHoveredBox: (id: string | null) => void;
  setHoveredRemate: (id: string | null) => void;
  selectHemati: (id: string | null) => void;
  selectRodape: (id: string | null) => void;
  selectRemate: (id: string | null) => void;
  selectDivSep: (selection: SelectedDivSep | null) => void;
  getDivSepHitAtPointer: (event: { clientX: number; clientY: number }) => SelectedDivSep | null;
  getHematiIdAtPointer: (event: { clientX: number; clientY: number }) => string | null;
  getRodapeIdAtPointer: (event: { clientX: number; clientY: number }) => string | null;
  getRemateIdAtPointer: (event: { clientX: number; clientY: number }) => string | null;
  getPointerSelectionEncodedId: (event: { clientX: number; clientY: number }) => string | null;
  getInternalSelectionHit: (event: { clientX: number; clientY: number }) => InternalSelectionState | null;
  setInternalSelection: (selection: InternalSelectionState | null) => void;
  getContextMenuLayerHit: (event: { clientX: number; clientY: number }) => MouseMenuTarget | null;
  refreshTransformControlsAttachment: () => void;
  setTransformAttachmentRefreshSuspended: (v: boolean) => void;
  refreshOutlineTarget: () => void;
  logTransformDiagnostic: (name: string, data?: Record<string, unknown>) => void;
  onRoomElementSelected: ((data: RoomElementHit | null) => void) | null;
  onRoomUtilitySelected: ((
    data: { utilityId: string; wallId: number; config: ProjectRoomUtility } | null
  ) => void) | null;
  onWallSelected: ((wallId: number | null) => void) | null;
  onBoxSelected: ((id: string | null) => void) | null;
  onMultiSelectToggle: ((encodedId: string) => void) | null;
  onRemateSelected: ((remateId: string | null) => void) | null;
  onRoomElementPlaced: ((
    wallId: number,
    config: DoorWindowConfig,
    type: "door" | "window"
  ) => void) | null;
  onDoorLayerDoubleClick: ((boxId: string, doorLayerId: string) => void) | null;
  onDrawerLayerDoubleClick: ((boxId: string, drawerLayerId: string) => void) | null;
  onDrawerLayerClick: ((boxId: string, drawerLayerId: string) => void) | null;
  onBoxDoubleClick: ((boxId: string) => void) | null;
  setShiftKeyHeld: (held: boolean) => void;
};

export function handleShiftKeyDownImpl(deps: ViewerCoreEventOpsDeps, e: KeyboardEvent): void {
  if (e.key === "Shift") deps.setShiftKeyHeld(true);
}

export function handleShiftKeyUpImpl(deps: ViewerCoreEventOpsDeps, e: KeyboardEvent): void {
  if (e.key === "Shift") deps.setShiftKeyHeld(false);
}

export function getHighlightIntersectsImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): THREE.Intersection[] {
  return deps.pointerPicking.getHighlightIntersects(event);
}

export function getBoxIdAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): string | null {
  return deps.pointerPicking.getBoxIdAtPointer(event);
}

export function getBoxIdByMeshImpl(deps: ViewerCoreEventOpsDeps, mesh: THREE.Object3D): string | null {
  return deps.pointerPicking.getBoxIdByMesh(mesh);
}

export function getDoorHitAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): { boxId: string; doorLayerId: string } | null {
  return deps.pointerPicking.getDoorHitAtPointer(event);
}

export function getDrawerHitAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): { boxId: string; drawerLayerId: string } | null {
  return deps.pointerPicking.getDrawerHitAtPointer(event);
}

export function getBoxBodyHitAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): { boxId: string } | null {
  return deps.pointerPicking.getBoxBodyHitAtPointer(event);
}

export function getWallIdAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): number | null {
  return deps.pointerPicking.getWallIdAtPointer(event);
}

export function getWallHitAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): {
  wallId: number;
  config: DoorWindowConfig;
  type: "door" | "window";
} | null {
  return deps.pointerPicking.getWallHitAtPointer(event);
}

export function getRoomElementAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): {
  elementId: string;
  wallId: number;
  type: "door" | "window";
  config: DoorWindowConfig;
} | null {
  return deps.pointerPicking.getRoomElementAtPointer(event);
}

export function getRoomUtilityAtPointerImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): {
  utilityId: string;
  wallId: number;
  config: ProjectRoomUtility;
} | null {
  return deps.pointerPicking.getRoomUtilityAtPointer({
    event,
    canvas: deps.rendererManager.renderer.domElement,
    pointer: deps.pointer,
    raycaster: deps.raycaster,
    camera: deps.cameraManager.camera,
    roomBoxWalls: deps.getRoomBoxWalls(),
  });
}

export function getTransformGizmoIntersectionsImpl(
  deps: ViewerCoreEventOpsDeps,
  event: { clientX: number; clientY: number }
): number {
  return deps.pointerPicking.getTransformGizmoIntersections(event);
}

export function getEventEngineApiImpl(deps: ViewerCoreEventOpsDeps): IViewerEventEngine {
  return {
    getCanvas: () => deps.rendererManager.renderer.domElement,
    getTransformControlsDragging: () => deps.viewerState.getTransformControlsDragging(),
    getSuppressNextCanvasClick: () => deps.viewerState.getSuppressNextCanvasClick(),
    setSuppressNextCanvasClick: (v) => {
      deps.viewerState.setSuppressNextCanvasClick(v);
    },
    getHighlightEnabled: () => deps.viewerState.getHighlightEnabled(),
    getHighlightManager: () => deps.getHighlightManager(),
    getHighlightIntersects: (e) => getHighlightIntersectsImpl(deps, e),
    getBoxIdByMesh: (mesh) => getBoxIdByMeshImpl(deps, mesh),
    setSelectedBox: (id, options) => deps.setSelectedBox(id, options),
    setHoveredBox: (id) => deps.setHoveredBox(id),
    setHoveredRemate: (id) => deps.setHoveredRemate(id),
    getOnRoomElementSelected: () => deps.onRoomElementSelected,
    getOnRoomUtilitySelected: () => deps.onRoomUtilitySelected,
    getOnWallSelected: () => deps.onWallSelected,
    getOnBoxSelected: () => deps.onBoxSelected,
    getOnMultiSelectToggle: () => deps.onMultiSelectToggle,
    getOnRemateSelected: () => deps.onRemateSelected,
    getPlacementMode: () => deps.viewerState.getPlacementMode(),
    getOnRoomElementPlaced: () => deps.onRoomElementPlaced,
    getWallHitAtPointer: (e) => getWallHitAtPointerImpl(deps, e),
    getRoomBuilder: () => deps.roomBuilder,
    setPlacementMode: (mode) => deps.viewerState.setPlacementMode(mode),
    getBoxIdAtPointer: (e) => getBoxIdAtPointerImpl(deps, e),
    getHematiIdAtPointer: (e) => deps.getHematiIdAtPointer(e),
    getRodapeIdAtPointer: (e) => deps.getRodapeIdAtPointer(e),
    getRemateIdAtPointer: (e) => deps.getRemateIdAtPointer(e),
    getDivSepHitAtPointer: (e) => deps.getDivSepHitAtPointer(e),
    selectHemati: (id) => deps.selectHemati(id),
    selectRodape: (id) => deps.selectRodape(id),
    selectRemate: (id) => deps.selectRemate(id),
    selectDivSep: (hit) => deps.selectDivSep(hit),
    getSelectedBoxId: () => deps.viewerState.getSelectedBox(),
    getSelectedRemateId: () => deps.viewerState.getSelectedRemate(),
    getSelectedDivSep: () => deps.viewerState.getSelectedDivSep(),
    getRoomElementAtPointer: (e) => getRoomElementAtPointerImpl(deps, e),
    getSelectedWallIndex: () => deps.viewerState.getSelectedWallIndex(),
    setSelectedWallIndex: (v) => {
      deps.viewerState.setSelectedWallIndex(v);
    },
    getSelectedRoomElementId: () => deps.viewerState.getSelectedRoomElementId(),
    setSelectedRoomElementId: (v) => {
      deps.viewerState.setSelectedRoomElementId(v);
    },
    getSelectedRoomUtilityId: () => deps.viewerState.getSelectedRoomUtilityId(),
    setSelectedRoomUtilityId: (v) => {
      deps.viewerState.setSelectedRoomUtilityId(v);
    },
    getRoomUtilityAtPointer: (e) => getRoomUtilityAtPointerImpl(deps, e),
    refreshTransformControlsAttachment: () => deps.refreshTransformControlsAttachment(),
    setTransformAttachmentRefreshSuspended: (v) => deps.setTransformAttachmentRefreshSuspended(v),
    refreshOutlineTarget: () => deps.refreshOutlineTarget(),
    getRoomBoxWalls: () => deps.getRoomBoxWalls(),
    getWallGizmo: () => deps.getWallGizmo(),
    getWallEditMode: () => deps.viewerState.getWallEditMode(),
    getWallIdAtPointer: (e) => getWallIdAtPointerImpl(deps, e),
    logTransformDiagnostic: (name, data) => deps.logTransformDiagnostic(name, data),
    getTransformGizmoIntersections: (e) => getTransformGizmoIntersectionsImpl(deps, e),
    getWallGizmoDragging: () => deps.viewerState.getWallGizmoDragging(),
    setWallGizmoDragging: (v) => {
      deps.viewerState.setWallGizmoDragging(v);
    },
    getDoorHitAtPointer: (e) => getDoorHitAtPointerImpl(deps, e),
    getDrawerHitAtPointer: (e) => getDrawerHitAtPointerImpl(deps, e),
    getBoxBodyHitAtPointer: (e) => getBoxBodyHitAtPointerImpl(deps, e),
    getLayerSelectionHitAtPointer: (e) => deps.getContextMenuLayerHit(e),
    encodeLayerHitToSelectionId: (hit) => encodeSelectionIdFromLayerHit(hit),
    getPointerSelectionEncodedId: (e) => deps.getPointerSelectionEncodedId(e),
    getOnDoorLayerDoubleClick: () => deps.onDoorLayerDoubleClick,
    getOnDrawerLayerDoubleClick: () => deps.onDrawerLayerDoubleClick,
    getOnDrawerLayerClick: () => deps.onDrawerLayerClick,
    getOnBoxDoubleClick: () => deps.onBoxDoubleClick,
    getPointerActionForButton: (button) => {
      const mapping = getMouseInputMapping(deps.getMouseInputPreset());
      return getPointerActionForButton(mapping, button);
    },
    shouldBlockPointerDownForSelection: (button) => {
      const mapping = getMouseInputMapping(deps.getMouseInputPreset());
      return shouldBlockPointerDownForSelection(mapping, button);
    },
    setCameraControlsEnabled: (enabled) => {
      const controls = deps.getControls()?.controls;
      if (controls) {
        applyCameraNavigationLock(controls, enabled);
      }
    },
    getInternalSelectionEnabled: () => deps.viewerState.getInternalSelectionEnabled(),
    getInternalSelectionHit: (e) => deps.getInternalSelectionHit(e),
    setInternalSelection: (selection) => deps.setInternalSelection(selection),
    getPointerWorldHit: (event) => {
      const hit = deps.pointerPicking.getPointerWorldHit(event);
      return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
    },
    setTransformGizmoAnchor: (point) => deps.viewerState.setTransformGizmoAnchor(point),
    getIndustrialDesignWorkspaceEnabled: () => deps.industrialDesignMode.isEnabled(),
    handleIndustrialDesignPointerClick: (event) => deps.industrialDesignMode.handlePointerClick(event),
  };
}
