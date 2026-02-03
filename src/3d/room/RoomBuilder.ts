/**
 * RoomBuilder — cria paredes para visualização de sala no Viewer.
 * Paredes não entram em cutlist, preços ou produção.
 * Material cinza claro; recebem sombra e luz normalmente.
 */

import * as THREE from "three";
import type { RoomConfig, WallConfig, DoorWindowConfig } from "./types";
import { DEFAULT_WALL_THICKNESS_MM } from "./types";
import { DoorElement } from "./elements/DoorElement";
import { WindowElement } from "./elements/WindowElement";

const WALL_COLOR = 0xd1d5db;
const WALL_MM_TO_M = 1 / 1000;

export type RoomElementEntry = {
  type: "door" | "window";
  wallId: number;
  elementId: string;
  config: DoorWindowConfig;
};

export class RoomBuilder {
  private readonly group = new THREE.Group();
  private readonly walls: THREE.Mesh[] = [];
  private elementCounter = 0;
  private readonly elements: RoomElementEntry[] = [];
  private wallLengths: number[] = [];
  private wallHeights: number[] = [];

  constructor() {
    this.group.name = "room";
    this.group.userData.isRoom = true;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  createWall(config: WallConfig, thicknessMm: number): THREE.Mesh {
    const lengthM = Math.max(0.01, config.lengthMm * WALL_MM_TO_M);
    const heightM = Math.max(0.01, config.heightMm * WALL_MM_TO_M);
    const thicknessM = Math.max(0.01, thicknessMm * WALL_MM_TO_M);

    const geometry = new THREE.BoxGeometry(lengthM, heightM, thicknessM);
    const material = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.75,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isRoomWall = true;
    return mesh;
  }

  createRoom(config: RoomConfig): THREE.Group {
    this.clearRoom(false);
    const thicknessMm = config.thicknessMm ?? DEFAULT_WALL_THICKNESS_MM;
    const thicknessM = thicknessMm * WALL_MM_TO_M;
    const halfThick = thicknessM / 2;

    const walls = config.walls.slice(0, config.numWalls);
    const n = walls.length;

    if (n === 0) return this.group;

    const L0 = walls[0].lengthMm * WALL_MM_TO_M;
    const L1 = (walls[1]?.lengthMm ?? walls[0].lengthMm) * WALL_MM_TO_M;
    const L2 = (walls[2]?.lengthMm ?? L0) * WALL_MM_TO_M;
    const L3 = (walls[3]?.lengthMm ?? L1) * WALL_MM_TO_M;

    const width = n >= 2 ? Math.max(L0, L2) : L0;
    const depth = n >= 2 ? Math.max(L1, L3) : L0;

    const halfW = width / 2;
    const halfD = depth / 2;

    const specs: Array<{ wall: WallConfig; x: number; y: number; z: number; rotY: number }> = [];

    if (n >= 1) {
      specs.push({ wall: walls[0], x: 0, y: walls[0].heightMm * WALL_MM_TO_M / 2, z: -halfD + halfThick, rotY: 0 });
    }
    if (n >= 2) {
      specs.push({ wall: walls[1], x: halfW - halfThick, y: walls[1].heightMm * WALL_MM_TO_M / 2, z: 0, rotY: Math.PI / 2 });
    }
    if (n >= 3) {
      specs.push({ wall: walls[2], x: 0, y: walls[2].heightMm * WALL_MM_TO_M / 2, z: halfD - halfThick, rotY: 0 });
    }
    if (n >= 4) {
      specs.push({ wall: walls[3], x: -halfW + halfThick, y: walls[3].heightMm * WALL_MM_TO_M / 2, z: 0, rotY: Math.PI / 2 });
    }

    this.wallLengths = [];
    this.wallHeights = [];
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const mesh = this.createWall(s.wall, thicknessMm);
      mesh.position.set(s.x, s.y, s.z);
      mesh.rotation.y = s.rotY;
      mesh.userData.wallId = i;
      mesh.userData.wallLengthMm = s.wall.lengthMm;
      mesh.userData.wallHeightMm = s.wall.heightMm;
      mesh.userData.wallThicknessM = thicknessM;
      this.group.add(mesh);
      this.walls.push(mesh);
      this.wallLengths.push(s.wall.lengthMm);
      this.wallHeights.push(s.wall.heightMm);
    }

    this.restoreElements();
    return this.group;
  }

  private placeElementOnWall(
    element: THREE.Group,
    _wallId: number,
    config: DoorWindowConfig,
    wall: THREE.Mesh
  ): void {
    const wallLenM = (wall.userData.wallLengthMm as number) * WALL_MM_TO_M;
    const thicknessM = (wall.userData.wallThicknessM as number) ?? 0.12;

    const xLocal =
      -wallLenM / 2 +
      (config.horizontalOffsetMm + config.widthMm / 2) * WALL_MM_TO_M;
    const yLocal =
      (config.floorOffsetMm + config.heightMm / 2) * WALL_MM_TO_M;
    const zLocal = thicknessM / 2 + 0.002;

    element.position.set(xLocal, yLocal, zLocal);
    element.rotation.set(0, 0, 0);
    wall.add(element);
  }

  addDoor(wallId: number, config: DoorWindowConfig): string {
    const wall = this.walls[wallId];
    if (!wall) return "";
    const id = `door-${++this.elementCounter}-${Date.now()}`;
    const element = DoorElement.create(config, id);
    this.placeElementOnWall(element, wallId, config, wall);
    this.elements.push({ type: "door", wallId, elementId: id, config: { ...config } });
    return id;
  }

  addWindow(wallId: number, config: DoorWindowConfig): string {
    const wall = this.walls[wallId];
    if (!wall) return "";
    const id = `window-${++this.elementCounter}-${Date.now()}`;
    const element = WindowElement.create(config, id);
    this.placeElementOnWall(element, wallId, config, wall);
    this.elements.push({ type: "window", wallId, elementId: id, config: { ...config } });
    return id;
  }

  updateElementConfig(
    elementId: string,
    config: DoorWindowConfig
  ): boolean {
    const entry = this.elements.find((e) => e.elementId === elementId);
    if (!entry) return false;
    entry.config = { ...config };
    const wall = this.walls[entry.wallId];
    if (!wall) return false;
    const child = wall.children.find(
      (c) => (c.userData.elementId as string) === elementId
    );
    if (!(child instanceof THREE.Group)) return false;
    if (entry.type === "door") {
      DoorElement.updateConfig(child, config);
    } else {
      WindowElement.updateConfig(child, config);
    }
    this.placeElementOnWall(child, entry.wallId, config, wall);
    return true;
  }

  private restoreElements(): void {
    for (const entry of this.elements) {
      const wall = this.walls[entry.wallId];
      if (!wall) continue;
      const element =
        entry.type === "door"
          ? DoorElement.create(entry.config, entry.elementId)
          : WindowElement.create(entry.config, entry.elementId);
      this.placeElementOnWall(element, entry.wallId, entry.config, wall);
    }
  }

  getWalls(): THREE.Mesh[] {
    return [...this.walls];
  }

  getElements(): RoomElementEntry[] {
    return [...this.elements];
  }

  clearRoom(clearElements = true): void {
    for (const wall of this.walls) {
      wall.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== wall) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.group.remove(wall);
      wall.geometry.dispose();
      if (Array.isArray(wall.material)) {
        wall.material.forEach((m) => m.dispose());
      } else {
        wall.material.dispose();
      }
    }
    this.walls.length = 0;
    if (clearElements) {
      this.elements.length = 0;
    }
  }
}
