/**
 * Tipos partilhados do motor de mesh de sala (M10).
 * A implementação activa é RoomMeshEngine — RoomManager legado eliminado.
 */
import type * as THREE from "three";

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
 * Interface mínima que o Viewer implementa para integração com RoomMeshEngine.
 */
export interface IRoomManagerViewer {
  setRoomFromManager(
    _walls: WallEntryForViewer[],
    _bounds: RoomBounds,
    _group: THREE.Group
  ): void;
  clearRoomFromManager(): void;
}

/** @deprecated Use RoomMeshEngine — alias de tipo para migração. */
export type RoomManager = import("../RoomMeshEngine").RoomMeshEngine;
