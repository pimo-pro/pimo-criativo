import type * as THREE from "three";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { RoomBuilder } from "../room/RoomBuilder";
import type { ViewerState, SelectedDivSep } from "./state/ViewerState";
import type { ViewerBoxEntry } from "./types";
import type { IViewerToolsEngine } from "./tools/ToolsEngineTypes";
import type { GroupGizmo } from "./tools/GroupGizmo";
import type { SelectionOutlineController } from "./overlays/SelectionOutlineController";
import { getTransformGizmoSizeForBox as computeTransformGizmoSizeForBox } from "@/viewer/core/viewerUtils";

export type ViewerCoreToolsRoomWallEntry = {
  id: number;
  mesh: THREE.Mesh;
};

export type ViewerCoreToolsOpsDeps = {
  viewerState: ViewerState;
  boxes: Map<string, ViewerBoxEntry>;
  roomBuilder: RoomBuilder;
  selectionOutline: SelectionOutlineController;
  boxesIntersectingWalls: Set<string>;
  getTransformControls: () => TransformControls | null;
  getTransformControlsHelper: () => THREE.Object3D | null;
  setTransformHelperVisible: (visible: boolean) => void;
  getGroupGizmo: () => GroupGizmo | null;
  getRoomBoxWalls: () => ViewerCoreToolsRoomWallEntry[];
  getDivSepMesh: (selection: SelectedDivSep) => THREE.Object3D | null;
  getHematiMesh: (hematiId: string) => THREE.Object3D | null;
  getRodapeMesh: (rodapeId: string) => THREE.Object3D | null;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
  getRoomUtilityById: (id: string) => THREE.Object3D | null;
  applyTransformControlsMouseGuard: () => void;
  logTransformDiagnostic: (name: string, data?: Record<string, unknown>) => void;
  setOutlineTarget: (mesh: THREE.Object3D | null, opacity: number, colorHex: number) => void;
  clampTransform: () => void;
  resolveMemberMesh: (encodedId: string) => THREE.Object3D | null;
  applyGroupPivotTransform: () => void;
  notifyGroupTransform: () => void;
  clampGroupTransform: () => void;
};

export function getTransformGizmoSizeForBoxImpl(entry: {
  width: number;
  height: number;
  depth: number;
}): number {
  return computeTransformGizmoSizeForBox(entry);
}

export function getToolsEngineApiImpl(deps: ViewerCoreToolsOpsDeps): IViewerToolsEngine {
  return {
    getTransformControls: () => deps.getTransformControls(),
    getTransformControlsHelper: () => deps.getTransformControlsHelper(),
    getCurrentTool: () => deps.viewerState.getCurrentTool(),
    getSelectedBoxId: () => deps.viewerState.getSelectedBox(),
    getSelectedHematiId: () => deps.viewerState.getSelectedHemati(),
    getSelectedRodapeId: () => deps.viewerState.getSelectedRodape(),
    getSelectedRemateId: () => deps.viewerState.getSelectedRemate(),
    getSelectedDivSep: () => deps.viewerState.getSelectedDivSep(),
    getDivSepMesh: (selection) => deps.getDivSepMesh(selection),
    getHematiMesh: (hematiId) => deps.getHematiMesh(hematiId),
    getRodapeMesh: (rodapeId) => deps.getRodapeMesh(rodapeId),
    getRemateMesh: (remateId) => deps.getRemateMesh(remateId),
    getBoxEntry: (id) => deps.boxes.get(id),
    getSelectedWallIndex: () => deps.viewerState.getSelectedWallIndex(),
    getRoomBoxWalls: () => deps.getRoomBoxWalls(),
    getSelectedRoomElementId: () => deps.viewerState.getSelectedRoomElementId(),
    getRoomElementById: (id) => deps.roomBuilder.getElementById(id),
    getSelectedRoomUtilityId: () => deps.viewerState.getSelectedRoomUtilityId(),
    getRoomUtilityById: (id) => deps.getRoomUtilityById(id),
    getTransformGizmoSizeForBox: (entry) => getTransformGizmoSizeForBoxImpl(entry),
    setTransformHelperVisible: (visible) => deps.setTransformHelperVisible(visible),
    applyTransformControlsMouseGuard: () => deps.applyTransformControlsMouseGuard(),
    logTransformDiagnostic: (name, data) => deps.logTransformDiagnostic(name, data),
    getSelectionOutline: () => deps.selectionOutline.getGroup(),
    getSelectionOutlineMaterial: () => deps.selectionOutline.getMaterial(),
    getHoveredBoxId: () => deps.viewerState.getHoveredBox(),
    getHoveredRemateId: () => deps.viewerState.getHoveredRemate(),
    getBoxesIntersectingWalls: () => deps.boxesIntersectingWalls,
    setOutlineTarget: (mesh, opacity, colorHex) => deps.setOutlineTarget(mesh, opacity, colorHex),
    clampTransform: () => deps.clampTransform(),
    getGroupGizmo: () => {
      const groupGizmo = deps.getGroupGizmo();
      if (!groupGizmo) throw new Error("GroupGizmo not initialized");
      return groupGizmo;
    },
    getGroupTransformMemberIds: () => deps.viewerState.getGroupTransformMemberIds(),
    resolveMemberMesh: (encoded) => deps.resolveMemberMesh(encoded),
    applyGroupPivotTransform: () => deps.applyGroupPivotTransform(),
    notifyGroupTransform: () => deps.notifyGroupTransform(),
    clampGroupTransform: () => deps.clampGroupTransform(),
  };
}
