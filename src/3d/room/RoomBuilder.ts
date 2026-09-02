/**
 * pimo-room v4 — RoomBuilder: portas/janelas + cutouts CSG nas paredes.
 */
import * as THREE from "three";
import type { DoorWindowConfig, RoomConfig } from "./types";
import { DoorElement } from "./elements/DoorElement";
import { WindowElement } from "./elements/WindowElement";
import { placeOpeningGroupOnWall } from "./openingPlacement";
import { refreshWallOpeningCutouts } from "./wallGeometryCsg";

export type RoomElementEntry = {
  type: "door" | "window";
  wallId: number;
  wallUuid: string;
  elementId: string;
  config: DoorWindowConfig;
};

function disposeOpeningObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    }
  });
}

/**
 * Constrói portas/janelas como filhos das meshes das paredes do RoomManager.
 * Aplica cutouts CSG (`three-csg-ts`) na geometria da parede hospedeira.
 */
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

  getElementById(elementId: string): THREE.Group | null {
    for (const wall of this.getWallMeshes()) {
      for (const ch of wall.children) {
        if (ch instanceof THREE.Group && ch.userData?.elementId === elementId) {
          return ch;
        }
      }
    }
    return null;
  }

  getWallByUuid(wallUuid: string): THREE.Mesh | null {
    return this.getWallMeshes().find((m) => m.uuid === wallUuid) ?? null;
  }

  createRoom(_config: RoomConfig): THREE.Group {
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

  addDoorByIndex(wallIndex: number, config: DoorWindowConfig, elementId?: string): string {
    return this.addOpening(wallIndex, config, "door", elementId);
  }

  addWindowByIndex(wallIndex: number, config: DoorWindowConfig, elementId?: string): string {
    return this.addOpening(wallIndex, config, "window", elementId);
  }

  private addOpening(
    wallIndex: number,
    config: DoorWindowConfig,
    kind: "door" | "window",
    elementId?: string
  ): string {
    const walls = this.getWallMeshes();
    const wall = walls[wallIndex];
    if (!wall) return "";
    const id =
      elementId?.trim() ||
      `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (elementId) this.removeElement(elementId);
    const cfg: DoorWindowConfig = { ...config };
    const group =
      kind === "door" ? DoorElement.create(cfg, id) : WindowElement.create(cfg, id);
    placeOpeningGroupOnWall(group, wall, cfg);
    wall.add(group);
    refreshWallOpeningCutouts(wall);
    this.elements.push({
      type: kind,
      wallId: wallIndex,
      wallUuid: wall.uuid,
      elementId: id,
      config: { ...(group.userData.config as DoorWindowConfig) },
    });
    return id;
  }

  addDoor(wallUuid: string, config: DoorWindowConfig, elementId?: string): string {
    const walls = this.getWallMeshes();
    const idx = walls.findIndex((m) => m.uuid === wallUuid);
    if (idx < 0) return "";
    return this.addDoorByIndex(idx, config, elementId);
  }

  addWindow(wallUuid: string, config: DoorWindowConfig, elementId?: string): string {
    const walls = this.getWallMeshes();
    const idx = walls.findIndex((m) => m.uuid === wallUuid);
    if (idx < 0) return "";
    return this.addWindowByIndex(idx, config, elementId);
  }

  updateElementConfig(elementId: string, config: DoorWindowConfig): boolean {
    const group = this.getElementById(elementId);
    if (!group || !(group.parent instanceof THREE.Mesh)) return false;
    const wall = group.parent as THREE.Mesh;
    const wallIndex = this.getWallMeshes().findIndex((m) => m === wall);
    const kind = group.userData?.elementType as "door" | "window" | undefined;
    const cfg: DoorWindowConfig = { ...config };
    if (kind === "window") {
      WindowElement.updateConfig(group, cfg);
    } else {
      DoorElement.updateConfig(group, cfg);
    }
    placeOpeningGroupOnWall(group, wall, cfg);
    refreshWallOpeningCutouts(wall);
    const entry = this.elements.find((e) => e.elementId === elementId);
    if (entry) {
      entry.config = { ...(group.userData.config as DoorWindowConfig) };
      entry.wallId = wallIndex >= 0 ? wallIndex : entry.wallId;
    }
    return true;
  }

  removeElement(elementId: string): boolean {
    const group = this.getElementById(elementId);
    if (!group?.parent) return false;
    const wall = group.parent instanceof THREE.Mesh ? group.parent : null;
    group.parent.remove(group);
    disposeOpeningObject(group);
    const i = this.elements.findIndex((e) => e.elementId === elementId);
    if (i >= 0) this.elements.splice(i, 1);
    if (wall) refreshWallOpeningCutouts(wall);
    return true;
  }

  /** Alterna abertura (swing/slide) — estado só em sessão (não persiste no SSOT). */
  toggleElementOpen(elementId: string, animate = true): boolean | null {
    const group = this.getElementById(elementId);
    if (!group) return null;
    const kind = group.userData?.elementType as "door" | "window" | undefined;
    if (kind === "window") return WindowElement.toggleOpen(group, animate);
    return DoorElement.toggleOpen(group, animate);
  }

  clearRoom(disposeGeometries = false): void {
    for (const wall of this.getWallMeshes()) {
      const toRemove: THREE.Object3D[] = [];
      for (const ch of wall.children) {
        if (ch instanceof THREE.Group && typeof ch.userData?.elementId === "string") {
          toRemove.push(ch);
        }
      }
      for (const obj of toRemove) {
        wall.remove(obj);
        if (disposeGeometries) disposeOpeningObject(obj);
      }
      refreshWallOpeningCutouts(wall);
    }
    this.elements.length = 0;
  }
}
