/**
 * RoomMeshEngine — gestor de meshes de sala do path vNext.
 * API compatível com RoomManager (paridade funcional/visual).
 * Usa builders em src/pimo-room/mesh/ em vez de WallFactory directo.
 * Piso/tecto continuam no ViewerCore (rebuildRoomFloorAndCeiling) via floor/ceiling builders.
 */
import * as THREE from "three";
import {
  DEFAULT_ROOM_DEPTH,
  DEFAULT_ROOM_HEIGHT,
  DEFAULT_ROOM_WIDTH,
} from "../../3d/room/Room";
import { computeDynamicRoomBounds } from "../../3d/room/roomDynamicBounds";
import { rebuildZoneOverlayGroup } from "../../3d/room/zoneOverlay";
import type { ProjectRoomZone } from "../../3d/viewer-engine/room/roomEngineTypes";
import type { IRoomManagerViewer, RoomBounds, WallEntryForViewer } from "../../3d/room/RoomManager";
import {
  Room,
  buildExtraWallMesh,
  buildWallGeometry,
  getWallThicknessM,
  refreshWallMiters,
  repositionMainWallMeshes,
  setWallThicknessM,
  wallMeshBuilder,
  type RoomNumWalls,
} from "./wallMeshBuilder";

export type { RoomBounds, WallEntryForViewer, IRoomManagerViewer };

/**
 * Motor de mesh vNext — substituto estrutural do RoomManager no path flag ON.
 */
export class RoomMeshEngine {
  room: Room | null = null;
  wallsMain: THREE.Mesh[] = [];
  wallsExtra: THREE.Mesh[] = [];
  group: THREE.Group;
  locked = false;
  private _visible = true;
  private nextExtraWallId = 4;
  private viewer: IRoomManagerViewer;
  private zoneOverlay: THREE.Group | null = null;

  constructor(viewer: IRoomManagerViewer) {
    this.viewer = viewer;
    this.group = new THREE.Group();
    this.group.name = "roomMeshEngine";
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
    this.wallsMain = wallMeshBuilder(this.room, numWalls, wallThicknessM ?? getWallThicknessM());
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
    this.clearZoneOverlay();
    this.group.clear();
    this.room = null;
  }

  setZones(zones: ProjectRoomZone[] | null | undefined): void {
    this.zoneOverlay = rebuildZoneOverlayGroup(this.zoneOverlay, zones);
    if (!this.zoneOverlay.parent && this.group) {
      this.group.add(this.zoneOverlay);
    }
  }

  clearZoneOverlay(): void {
    if (!this.zoneOverlay) return;
    this.group.remove(this.zoneOverlay);
    rebuildZoneOverlayGroup(this.zoneOverlay, []);
    this.zoneOverlay = null;
  }

  setDimensions(width: number, depth: number, height: number): void {
    if (!this.room) return;
    this.room.width = Math.max(0.1, width);
    this.room.depth = Math.max(0.1, depth);
    this.room.height = Math.max(0.1, height);
    repositionMainWallMeshes(this.room, this.wallsMain);
    this.syncBoundsToViewer();
  }

  addExtraWall(): THREE.Mesh {
    const id = this.nextExtraWallId++;
    const wall = buildExtraWallMesh(id);
    this.wallsExtra.push(wall);
    this.group.add(wall);
    this.refreshWallMiters();
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
    const miters =
      (wall.userData.wallMiters as { startMiterRad?: number; endMiterRad?: number } | null) ??
      undefined;
    wall.geometry.dispose();
    wall.geometry = buildWallGeometry({
      lengthM: config.lengthM,
      heightM: config.heightM,
      thicknessM: config.thicknessM,
      miters,
    });
    wall.position.set(
      config.position.x,
      config.position.y ?? config.heightM / 2,
      config.position.z
    );
    wall.rotation.y = (config.rotationDeg * Math.PI) / 180;
    wall.userData.wallLengthMm = config.lengthM * 1000;
    wall.userData.wallHeightMm = config.heightM * 1000;
    wall.userData.wallThicknessM = config.thicknessM;
    this.refreshWallMiters();
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
    const wall = buildExtraWallMesh(config.id, {
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
    this.refreshWallMiters();
    this.syncBoundsToViewer();
    return wall;
  }

  refreshWallMiters(): void {
    refreshWallMiters([...this.wallsMain, ...this.wallsExtra]);
  }

  setLocked(flag: boolean): void {
    this.locked = flag;
  }

  getBounds(): RoomBounds | null {
    if (!this.room) return null;
    return computeDynamicRoomBounds(this.room, [...this.wallsMain, ...this.wallsExtra]);
  }

  private syncBoundsToViewer(): void {
    const bounds = this.getBounds();
    if (!bounds) return;
    this.viewer.setRoomFromManager(this.getWallsForViewer(), bounds, this.group);
  }

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

    repositionMainWallMeshes(this.room, this.wallsMain);
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
