/**
 * wallMeshBuilder — fachada de geometria de paredes (vNext).
 * Hoje delega em WallFactory/CSG/miters (paridade visual com legado).
 * M10: inline desta lógica para eliminar dependência de src/3d/room.
 */
import * as THREE from "three";
import {
  createExtraWall,
  createMainWalls,
  getWallThicknessM,
  positionMainWalls,
  setWallThicknessM,
  type RoomNumWalls,
} from "../../3d/room/WallFactory";
import { Room } from "../../3d/room/Room";
import { buildWallBoxGeometry } from "../../3d/room/wallGeometryCsg";
import { applyDynamicMitersToWallMeshes } from "../../3d/room/wallMiters";

export type { RoomNumWalls };
export { Room, getWallThicknessM, setWallThicknessM };

export type WallMeshBuildOptions = {
  lengthM: number;
  heightM: number;
  thicknessM: number;
  miters?: { startMiterRad?: number; endMiterRad?: number };
};

/** Cria paredes principais (3 ou 4) para uma sala em metros. */
export function wallMeshBuilder(
  room: Room,
  numWalls: RoomNumWalls = 4,
  wallThicknessM?: number
): THREE.Mesh[] {
  return createMainWalls(room, numWalls, wallThicknessM);
}

/** Cria uma parede extra/livre. */
export function buildExtraWallMesh(
  id: number,
  options: { lengthM?: number; heightM?: number; thicknessM?: number; isMainWall?: boolean } = {}
): THREE.Mesh {
  return createExtraWall(id, options);
}

/** Reposiciona paredes principais conforme dimensões da sala. */
export function repositionMainWallMeshes(room: Room, walls: THREE.Mesh[]): void {
  positionMainWalls(room, walls);
}

/** Geometria box de parede (com miters opcionais). */
export function buildWallGeometry(options: WallMeshBuildOptions): THREE.BufferGeometry {
  return buildWallBoxGeometry(
    options.lengthM,
    options.heightM,
    options.thicknessM,
    options.miters
  );
}

/** Recalcula miters dinâmicos no conjunto de meshes. */
export function refreshWallMiters(walls: THREE.Mesh[]): void {
  if (walls.length === 0) return;
  applyDynamicMitersToWallMeshes(walls);
}
