/**
 * STUB no-op — sistema Sala removido (feature/sala-rebuild-opensource).
 * Mantém a superfície importada pelo ViewerCore / ViewerCore*Ops.
 */
import * as THREE from "three";
import type { DoorWindowConfig, RoomConfig } from "./types";

export type RoomElementEntry = {
  type: "door" | "window";
  wallId: number;
  wallUuid: string;
  elementId: string;
  config: DoorWindowConfig;
};

export class RoomBuilder {
  private readonly group = new THREE.Group();
  private readonly elements: RoomElementEntry[] = [];
  private readonly getWallMeshes: () => THREE.Mesh[];

  constructor(getWallMeshes: () => THREE.Mesh[]) {
    this.group.name = "roomBuilder";
    this.getWallMeshes = getWallMeshes;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getWalls(): THREE.Mesh[] {
    return this.getWallMeshes();
  }

  getElements(): RoomElementEntry[] {
    return [...this.elements];
  }

  getElementById(_elementId: string): THREE.Group | null {
    void _elementId;
    return null;
  }

  getWallByUuid(wallUuid: string): THREE.Mesh | null {
    return this.getWallMeshes().find((m) => m.uuid === wallUuid) ?? null;
  }

  createRoom(_config: RoomConfig): THREE.Group {
    void _config;
    this.clearRoom(false);
    return this.group;
  }

  updateRoom(_config: RoomConfig): void {
    void _config;
  }

  setWallOutlineVisible(_wallUuid: string, _visible: boolean): void {
    void _wallUuid;
    void _visible;
  }

  addDoorByIndex(_wallIndex: number, _config: DoorWindowConfig, _elementId?: string): string {
    void _wallIndex;
    void _config;
    void _elementId;
    return "";
  }

  addWindowByIndex(_wallIndex: number, _config: DoorWindowConfig, _elementId?: string): string {
    void _wallIndex;
    void _config;
    void _elementId;
    return "";
  }

  addDoor(_wallUuid: string, _config: DoorWindowConfig, _elementId?: string): string {
    void _wallUuid;
    void _config;
    void _elementId;
    return "";
  }

  addWindow(_wallUuid: string, _config: DoorWindowConfig, _elementId?: string): string {
    void _wallUuid;
    void _config;
    void _elementId;
    return "";
  }

  updateElementConfig(_elementId: string, _config: DoorWindowConfig): boolean {
    void _elementId;
    void _config;
    return false;
  }

  removeElement(_elementId: string): boolean {
    void _elementId;
    return false;
  }

  clearRoom(_disposeGeometries = false): void {
    void _disposeGeometries;
    this.elements.length = 0;
  }
}
