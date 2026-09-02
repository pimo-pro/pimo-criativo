/**
 * Tipos para o EventsManager: contrato entre ViewerCore e o gestor de eventos.
 * Permite extrair a lógica de eventos sem expor toda a API do ViewerCore.
 */

import type * as THREE from "three";
import type { DoorWindowConfig } from "../../room/types";
import type { ProjectRoomUtility } from "../room/roomEngineTypes";
import type { MouseButtonAction } from "../controls/MouseInputMapper";
import type { InternalSelectionState } from "../selection/internalSelectionTypes";
import type { MouseMenuTarget } from "../../../ui/context-menu/ContextMenuEngine";

export type RoomElementHit = {
  elementId: string;
  wallId: number;
  type: "door" | "window";
  config: DoorWindowConfig;
};

export type WallHit = {
  wallId: number;
  config: DoorWindowConfig;
  type: "door" | "window";
};

export interface IViewerEventEngine {
  getCanvas(): HTMLCanvasElement;
  getTransformControlsDragging(): boolean;
  getSuppressNextCanvasClick(): boolean;
  setSuppressNextCanvasClick(_v: boolean): void;
  getHighlightEnabled(): boolean;
  getHighlightManager(): {
    setSelected(_mesh: THREE.Mesh | null): void;
    setHovered(_mesh: THREE.Mesh | null): void;
    getSelectableMeshFromIntersects(_hits: THREE.Intersection[]): THREE.Mesh | null;
  } | null;
  getHighlightIntersects(_event: { clientX: number; clientY: number }): THREE.Intersection[];
  getBoxIdByMesh(_mesh: THREE.Object3D): string | null;
  setSelectedBox(_id: string | null, _options?: { preserveGroupMembers?: boolean }): void;
  setHoveredBox(_id: string | null): void;
  setHoveredRemate(_id: string | null): void;
  getOnRoomElementSelected(): ((_data: RoomElementHit | null) => void) | null;
  getOnRoomUtilitySelected(): ((_data: { utilityId: string; wallId: number; config: ProjectRoomUtility } | null) => void) | null;
  getOnWallSelected(): ((_wallId: number | null) => void) | null;
  getOnBoxSelected(): ((_id: string | null) => void) | null;
  getOnMultiSelectToggle(): ((_encodedId: string) => void) | null;
  getOnRemateSelected(): ((_remateId: string | null) => void) | null;
  getPlacementMode(): "door" | "window" | null;
  getOnRoomElementPlaced(): ((_wallId: number, _config: DoorWindowConfig, _type: "door" | "window") => void) | null;
  getWallHitAtPointer(_event: { clientX: number; clientY: number }): WallHit | null;
  getRoomBuilder(): {
    addDoorByIndex(_wallIndex: number, _config: DoorWindowConfig): string;
    addWindowByIndex(_wallIndex: number, _config: DoorWindowConfig): string;
    toggleElementOpen?(_elementId: string, _animate?: boolean): boolean | null;
    getGroup(): THREE.Group;
  };
  setPlacementMode(_mode: "door" | "window" | null): void;
  getBoxIdAtPointer(_event: { clientX: number; clientY: number }): string | null;
  getHematiIdAtPointer(_event: { clientX: number; clientY: number }): string | null;
  getRodapeIdAtPointer(_event: { clientX: number; clientY: number }): string | null;
  getRemateIdAtPointer(_event: { clientX: number; clientY: number }): string | null;
  getDivSepHitAtPointer(_event: { clientX: number; clientY: number }): {
    boxId: string;
    kind: "div" | "sep";
    itemId: string;
  } | null;
  selectHemati(_hematiId: string | null): void;
  selectRodape(_rodapeId: string | null): void;
  selectRemate(_remateId: string | null): void;
  selectDivSep(_selection: { boxId: string; kind: "div" | "sep"; itemId: string } | null): void;
  getSelectedBoxId(): string | null;
  getSelectedRemateId(): string | null;
  getSelectedDivSep(): { boxId: string; kind: "div" | "sep"; itemId: string } | null;
  getRoomElementAtPointer(_event: { clientX: number; clientY: number }): RoomElementHit | null;
  getSelectedWallIndex(): number | null;
  setSelectedWallIndex(_v: number | null): void;
  getSelectedRoomElementId(): string | null;
  setSelectedRoomElementId(_v: string | null): void;
  getSelectedRoomUtilityId(): string | null;
  setSelectedRoomUtilityId(_v: string | null): void;
  getRoomUtilityAtPointer(_event: { clientX: number; clientY: number }): { utilityId: string; wallId: number; config: ProjectRoomUtility } | null;
  refreshTransformControlsAttachment(): void;
  refreshOutlineTarget(): void;
  getRoomBoxWalls(): { id: number; mesh: THREE.Mesh }[];
  getWallGizmo(): {
    onPointerDown(_x: number, _y: number): boolean;
    onPointerMove(_x: number, _y: number): void;
    onPointerUp(): void;
    detach(): void;
    attach(_wall: THREE.Mesh): void;
  } | null;
  getWallEditMode(): boolean;
  getWallIdAtPointer(_event: { clientX: number; clientY: number }): number | null;
  logTransformDiagnostic(_name: string, _data?: Record<string, unknown>): void;
  getTransformGizmoIntersections(_event: { clientX: number; clientY: number }): number;
  getWallGizmoDragging(): boolean;
  setWallGizmoDragging(_v: boolean): void;
  getDoorHitAtPointer(_event: { clientX: number; clientY: number }): { boxId: string; doorLayerId: string } | null;
  getDrawerHitAtPointer(_event: { clientX: number; clientY: number }): { boxId: string; drawerLayerId: string } | null;
  getBoxBodyHitAtPointer(_event: { clientX: number; clientY: number }): { boxId: string } | null;
  getOnDoorLayerDoubleClick(): ((_boxId: string, _doorLayerId: string) => void) | null;
  getOnDrawerLayerDoubleClick(): ((_boxId: string, _drawerLayerId: string) => void) | null;
  getOnDrawerLayerClick(): ((_boxId: string, _drawerLayerId: string) => void) | null;
  getOnBoxDoubleClick(): ((_boxId: string) => void) | null;
  getPointerActionForButton(_button: number): MouseButtonAction | null;
  shouldBlockPointerDownForSelection(_button: number): boolean;
  /** Desliga orbit/pan enquanto um gizmo está a ser arrastado. O zoom da roda permanece activo. */
  setCameraControlsEnabled(_enabled: boolean): void;
  getInternalSelectionEnabled(): boolean;
  getInternalSelectionHit(_event: { clientX: number; clientY: number }): InternalSelectionState | null;
  setInternalSelection(_selection: InternalSelectionState | null): void;
  getPointerWorldHit(_event: { clientX: number; clientY: number }): { x: number; y: number; z: number } | null;
  setTransformGizmoAnchor(_point: { x: number; y: number; z: number } | null): void;
  getLayerSelectionHitAtPointer(_event: { clientX: number; clientY: number }): MouseMenuTarget | null;
  encodeLayerHitToSelectionId(_hit: MouseMenuTarget | null): string | null;
  getPointerSelectionEncodedId(_event: { clientX: number; clientY: number }): string | null;
  getIndustrialDesignWorkspaceEnabled(): boolean;
  handleIndustrialDesignPointerClick(_event: { clientX: number; clientY: number }): boolean;
}
