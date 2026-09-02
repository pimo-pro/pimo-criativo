/**
 * pimo-room v4 — RoomManager: sala única, paredes principais/extra, lock e visibilidade.
 * Piso visual: ViewerCore.rebuildRoomFloorAndCeiling — não criar mesh de piso aqui.
 */
import * as THREE from "three";
import { Room, DEFAULT_ROOM_WIDTH, DEFAULT_ROOM_DEPTH, DEFAULT_ROOM_HEIGHT } from "./Room";
import type { RoomNumWalls } from "./WallFactory";
import {
  createMainWalls,
  createExtraWall,
  positionMainWalls,
  getWallThicknessM,
  setWallThicknessM,
} from "./WallFactory";
import { computeDynamicRoomBounds } from "./roomDynamicBounds";

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
};

export type WallEntryForViewer = {
  id: number;
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
};

/**
 * Interface mínima que o Viewer deve implementar para integração com o RoomManager.
 * Evita dependência circular Viewer -> RoomManager -> Viewer.
 */
export interface IRoomManagerViewer {
  setRoomFromManager(
    _walls: WallEntryForViewer[],
    _bounds: RoomBounds,
    _group: THREE.Group
  ): void;
  clearRoomFromManager(): void;
}

/**
 * Gestor da sala única: dimensões, paredes principais/extra, lock e visibilidade.
 * Piso visual: ViewerCore.rebuildRoomFloorAndCeiling (Room 2.0) — não criar mesh de piso aqui.
 */
export class RoomManager {
  room: Room | null = null;
  wallsMain: THREE.Mesh[] = [];
  wallsExtra: THREE.Mesh[] = [];
  /** Grupo que contém as paredes; adicionado à cena pelo Viewer. */
  group: THREE.Group;
  locked = false;
  private _visible = true;
  private nextExtraWallId = 4;
  private viewer: IRoomManagerViewer;

  constructor(viewer: IRoomManagerViewer) {
    this.viewer = viewer;
    this.group = new THREE.Group();
    this.group.name = "roomManager";
  }

  createRoom(
    width = DEFAULT_ROOM_WIDTH,
    depth = DEFAULT_ROOM_DEPTH,
    height = DEFAULT_ROOM_HEIGHT,
    numWalls: RoomNumWalls = 4,
    wallThicknessM?: number
  ): void {
    this.removeRoom();
    if (wallThicknessM != null) setWallThicknessM(wallThicknessM);
    this.room = new Room(width, depth, height, -width / 2, -depth / 2);
    this.wallsMain = createMainWalls(this.room, numWalls, wallThicknessM ?? getWallThicknessM());
    this.wallsExtra = [];
    this.nextExtraWallId = numWalls >= 4 ? 4 : 3;
    this.group.clear();

    this.wallsMain.forEach((mesh) => this.group.add(mesh));
    this.syncBoundsToViewer();
  }

  removeRoom(): void {
    this.viewer.clearRoomFromManager();

    [...this.wallsMain, ...this.wallsExtra].forEach((w) => {
      w.geometry.dispose();
      if (!Array.isArray(w.material)) (w.material as THREE.Material).dispose();
    });
    this.wallsMain = [];
    this.wallsExtra = [];

    this.group.clear();
    this.room = null;
  }

  setDimensions(width: number, depth: number, height: number): void {
    if (!this.room) return;
    this.room.width = Math.max(0.1, width);
    this.room.depth = Math.max(0.1, depth);
    this.room.height = Math.max(0.1, height);
    positionMainWalls(this.room, this.wallsMain);
    this.syncBoundsToViewer();
  }

  addExtraWall(): THREE.Mesh {
    const id = this.nextExtraWallId++;
    const wall = createExtraWall(id);
    this.wallsExtra.push(wall);
    this.group.add(wall);
    this.syncBoundsToViewer();
    return wall;
  }

  updateWallFromConfig(config: {
    id: number;
    lengthM: number;
    heightM: number;
    thicknessM: number;
    position: { x: number; y?: number; z: number };
    rotationDeg: number;
  }): boolean {
    const entry = this.getWallsForViewer().find((wall) => wall.id === config.id);
    const wall = entry?.mesh;
    if (!wall) return false;
    wall.geometry.dispose();
    wall.geometry = new THREE.BoxGeometry(config.lengthM, config.heightM, config.thicknessM);
    wall.position.set(
      config.position.x,
      config.position.y ?? config.heightM / 2,
      config.position.z
    );
    wall.rotation.y = (config.rotationDeg * Math.PI) / 180;
    wall.userData.wallLengthMm = config.lengthM * 1000;
    wall.userData.wallHeightMm = config.heightM * 1000;
    wall.userData.wallThicknessM = config.thicknessM;
    this.syncBoundsToViewer();
    return true;
  }

  addWallFromConfig(config: {
    id: number;
    lengthM: number;
    heightM: number;
    thicknessM: number;
    position: { x: number; y?: number; z: number };
    rotationDeg: number;
    isMainWall?: boolean;
  }): THREE.Mesh {
    const wall = createExtraWall(config.id, {
      lengthM: config.lengthM,
      heightM: config.heightM,
      thicknessM: config.thicknessM,
      isMainWall: config.isMainWall,
    });
    wall.position.set(
      config.position.x,
      config.position.y ?? config.heightM / 2,
      config.position.z
    );
    wall.rotation.y = (config.rotationDeg * Math.PI) / 180;
    wall.userData.wallId = config.id;
    wall.userData.wallLengthMm = config.lengthM * 1000;
    wall.userData.wallHeightMm = config.heightM * 1000;
    wall.userData.wallThicknessM = config.thicknessM;
    this.wallsExtra.push(wall);
    this.group.add(wall);
    this.nextExtraWallId = Math.max(this.nextExtraWallId, config.id + 1);
    this.syncBoundsToViewer();
    return wall;
  }

  setLocked(flag: boolean): void {
    this.locked = flag;
  }

  getBounds(): RoomBounds | null {
    if (!this.room) return null;
    return computeDynamicRoomBounds(this.room, [...this.wallsMain, ...this.wallsExtra]);
  }

  /** Propaga bounds dinâmicos ao ViewerCore (piso, snapping, constraints). */
  private syncBoundsToViewer(): void {
    const bounds = this.getBounds();
    if (!bounds) return;
    this.viewer.setRoomFromManager(this.getWallsForViewer(), bounds, this.group);
  }

  /** Recalcula bounds dinâmicos (paredes extras) e atualiza piso/snapping no viewer. */
  refreshDynamicBounds(): void {
    this.syncBoundsToViewer();
  }

  getWallsForViewer(): WallEntryForViewer[] {
    const main = this.wallsMain.map((mesh, i) => ({
      id: i,
      normal: (mesh.userData.wallNormal as THREE.Vector3).clone(),
      mesh,
    }));
    const extra = this.wallsExtra.map((mesh) => ({
      id: mesh.userData.wallId as number,
      normal: (mesh.userData.wallNormal as THREE.Vector3).clone(),
      mesh,
    }));
    return [...main, ...extra];
  }

  /**
   * Chamado quando uma parede principal é movida/rotacionada (ex.: pelo gizmo).
   * Se locked, recalcula o retângulo a partir da parede movida e reposiciona as 4 principais.
   */
  onMainWallTransformed(
    wallIndex: number,
    position: { x: number; z: number },
    _rotationDeg: number
  ): void {
    if (!this.room || !this.locked || wallIndex < 0 || wallIndex >= this.wallsMain.length) return;

    const t = getWallThicknessM();
    const { minX, maxX, minZ, maxZ } = this.room;

    switch (wallIndex) {
      case 0: {
        const newMinZ = position.z + t / 2;
        if (newMinZ >= maxZ - 0.2) return;
        this.room.originZ = newMinZ;
        this.room.depth = maxZ - newMinZ;
        break;
      }
      case 1: {
        const newMaxX = position.x - t / 2;
        if (newMaxX <= minX + 0.2) return;
        this.room.width = newMaxX - minX;
        break;
      }
      case 2: {
        const newMaxZ = position.z - t / 2;
        if (newMaxZ <= minZ + 0.2) return;
        this.room.depth = newMaxZ - minZ;
        this.room.originZ = minZ;
        break;
      }
      case 3: {
        const newMinX = position.x + t / 2;
        if (newMinX >= maxX - 0.2) return;
        this.room.originX = newMinX;
        this.room.width = maxX - newMinX;
        break;
      }
    }

    positionMainWalls(this.room, this.wallsMain);
    this.syncBoundsToViewer();
  }

  hideRoom(): void {
    this._visible = false;
    this.group.visible = false;
  }

  showRoom(): void {
    this._visible = true;
    this.group.visible = true;
  }

  get visible(): boolean {
    return this._visible;
  }

  updateCamera(): void {
    this.syncBoundsToViewer();
  }
}
