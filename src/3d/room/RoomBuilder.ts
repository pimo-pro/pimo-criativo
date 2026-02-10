import * as THREE from "three";
import type { DoorWindowConfig, RoomConfig } from "./types";

export type RoomElementEntry = {
  type: "door" | "window";
  wallId: number;
  wallUuid: string;
  elementId: string;
  config: DoorWindowConfig;
};

/**
 * Stub temporário: sistema de sala removido para estabilizar o deploy.
 * Mantém apenas a API pública para compatibilidade, sem lógica de sala.
 */
export class RoomBuilder {
  private readonly group = new THREE.Group();

  constructor() {
    this.group.name = "room-disabled";
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getWalls(): THREE.Mesh[] {
    return [];
  }

  getElements(): RoomElementEntry[] {
    return [];
  }

  getElementById(_elementId: string): THREE.Group | null {
    return null;
  }

  getWallByUuid(_wallUuid: string): THREE.Mesh | null {
    return null;
  }

  createRoom(_config: RoomConfig): THREE.Group {
    return this.group;
  }

  updateRoom(_config: RoomConfig): void {
    // no-op
  }

  setWallOutlineVisible(_wallUuid: string, _visible: boolean): void {
    // no-op
  }

  addDoorByIndex(_wallIndex: number, _config: DoorWindowConfig): string {
    return "";
  }

  addWindowByIndex(_wallIndex: number, _config: DoorWindowConfig): string {
    return "";
  }

  addDoor(_wallUuid: string, _config: DoorWindowConfig): string {
    return "";
  }

  addWindow(_wallUuid: string, _config: DoorWindowConfig): string {
    return "";
  }

  updateElementConfig(_elementId: string, _config: DoorWindowConfig): boolean {
    return false;
  }

  removeElement(_elementId: string): boolean {
    return false;
  }

  clearRoom(_disposeGeometries = false): void {
    // no-op
  }
}
