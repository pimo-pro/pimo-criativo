/**
 * Contrato do engine para ViewerTools (TransformControls, outline, clamp).
 */

import type * as THREE from "three";
import type { TransformMode } from "../state";
import type { GroupGizmo } from "./GroupGizmo";

export interface IViewerToolsEngine {
  getTransformControls(): {
    attach(_mesh: THREE.Object3D): void;
    detach(): void;
    setMode(_mode: string): void;
    setSize(_size: number): void;
    setSpace(_space: "local" | "world"): void;
    showX: boolean;
    showY: boolean;
    showZ: boolean;
  } | null;
  getTransformControlsHelper(): THREE.Object3D | null;
  getCurrentTool(): TransformMode;
  getSelectedBoxId(): string | null;
  getSelectedHematiId(): string | null;
  getSelectedRodapeId(): string | null;
  getSelectedRemateId(): string | null;
  getSelectedDivSep(): { boxId: string; kind: "div" | "sep"; itemId: string } | null;
  getDivSepMesh(_selection: { boxId: string; kind: "div" | "sep"; itemId: string }): THREE.Object3D | null;
  getHematiMesh(_hematiId: string): THREE.Object3D | null;
  getRodapeMesh(_rodapeId: string): THREE.Object3D | null;
  getRemateMesh(_remateId: string): THREE.Object3D | null;
  getBoxEntry(_id: string): { mesh: THREE.Object3D; width: number; height: number; depth: number; locked?: boolean } | undefined;
  getSelectedWallIndex(): number | null;
  getRoomBoxWalls(): { id: number; mesh: THREE.Mesh }[];
  getSelectedRoomElementId(): string | null;
  getRoomElementById(_id: string): THREE.Object3D | null;
  getSelectedRoomUtilityId(): string | null;
  getRoomUtilityById(_id: string): THREE.Object3D | null;
  getTransformGizmoSizeForBox(_entry: { width: number; height: number; depth: number }): number;
  setTransformHelperVisible(_visible: boolean): void;
  applyTransformControlsMouseGuard(): void;
  logTransformDiagnostic(_name: string, _data?: Record<string, unknown>): void;
  getSelectionOutline(): THREE.Object3D | null;
  getSelectionOutlineMaterial(): THREE.LineBasicMaterial | null;
  getHoveredBoxId(): string | null;
  getHoveredRemateId(): string | null;
  getBoxesIntersectingWalls(): Set<string>;
  setOutlineTarget(_mesh: THREE.Object3D | null, _opacity: number, _colorHex: number): void;
  /** Chamado pelo ViewerTools após arraste (translate/rotate). Mantido no Core por dependências (collision, snap, room). */
  clampTransform(): void;
  getGroupGizmo(): GroupGizmo;
  getGroupTransformMemberIds(): string[];
  resolveMemberMesh(_encodedId: string): THREE.Object3D | null;
  isRemateRotationAllowed(_remateId: string): boolean;
  isRodapeRotationAllowed(_rodapeId: string): boolean;
  applyGroupPivotTransform(): void;
  notifyGroupTransform(): void;
  clampGroupTransform(): void;
}
