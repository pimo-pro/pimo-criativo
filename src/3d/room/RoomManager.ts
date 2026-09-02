/**
 * STUB no-op — sistema Sala removido (feature/sala-rebuild-opensource).
 * Mantém a superfície importada pelo ViewerCore / ViewerCore*Ops.
 */
import * as THREE from "three";

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

export interface IRoomManagerViewer {
  setRoomFromManager(
    _walls: WallEntryForViewer[],
    _bounds: RoomBounds,
    _group: THREE.Group
  ): void;
  clearRoomFromManager(): void;
}

export class RoomManager {
  room: { width: number; depth: number; height: number } | null = null;
  wallsMain: THREE.Mesh[] = [];
  wallsExtra: THREE.Mesh[] = [];
  group: THREE.Group;
  locked = false;
  private _visible = true;
  private viewer: IRoomManagerViewer;

  constructor(viewer: IRoomManagerViewer) {
    this.viewer = viewer;
    this.group = new THREE.Group();
    this.group.name = "roomManager";
  }

  get visible(): boolean {
    return this._visible;
  }

  createRoom(
    _width = 4,
    _depth = 4,
    _height = 2.6,
    _numWalls: 3 | 4 = 4,
    _wallThicknessM?: number
  ): void {
    void _width;
    void _depth;
    void _height;
    void _numWalls;
    void _wallThicknessM;
  }

  removeRoom(): void {
    this.viewer.clearRoomFromManager();
    this.wallsMain = [];
    this.wallsExtra = [];
    this.group.clear();
    this.room = null;
  }

  setDimensions(_width: number, _depth: number, _height: number): void {
    void _width;
    void _depth;
    void _height;
  }

  addExtraWall(): THREE.Mesh {
    const mesh = new THREE.Mesh();
    mesh.name = "stub-extra-wall";
    return mesh;
  }

  updateWallFromConfig(_config: {
    id: number;
    lengthM: number;
    heightM: number;
    thicknessM: number;
    position: { x: number; y?: number; z: number };
    rotationDeg: number;
  }): boolean {
    void _config;
    return false;
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
    void config;
    const mesh = new THREE.Mesh();
    mesh.name = "stub-wall";
    return mesh;
  }

  setLocked(flag: boolean): void {
    this.locked = flag;
  }

  getBounds(): RoomBounds | null {
    return null;
  }

  refreshDynamicBounds(): void {}

  getWallsForViewer(): WallEntryForViewer[] {
    return [];
  }

  onMainWallTransformed(
    _wallIndex: number,
    _position: { x: number; z: number },
    _rotationDeg: number
  ): void {
    void _wallIndex;
    void _position;
    void _rotationDeg;
  }

  hideRoom(): void {
    this._visible = false;
  }

  showRoom(): void {
    this._visible = true;
  }

  updateCamera(): void {}
}
