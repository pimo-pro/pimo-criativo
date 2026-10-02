/**
 * floorMeshBuilder — geometria de piso da sala (vNext).
 * Extrai a construção de mesh usada pelo ViewerCore (paridade visual).
 */
import * as THREE from "three";

export type FloorMeshAppearance = {
  color: number;
  opacity: number;
  outlineColor: number;
};

export type FloorBoundsM = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
};

export type FloorMeshBuildResult = {
  floor: THREE.Mesh;
  outline: THREE.LineLoop | null;
};

/**
 * Constrói mesh de piso a partir de um Shape (já expandido) e aparência.
 * `createOutline` opcional — se omitido, só devolve o piso.
 */
export function floorMeshBuilder(
  shape: THREE.Shape,
  bounds: FloorBoundsM,
  floorMat: THREE.Material,
  outline: THREE.LineLoop | null = null
): FloorMeshBuildResult {
  const floorGeom = new THREE.ShapeGeometry(shape);
  floorGeom.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.position.y = bounds.minY + 0.002;
  floor.name = "room-floor-root";
  floor.userData.isRoomFloor = true;
  floor.renderOrder = 1;
  return { floor, outline };
}

/** Shape rectangular simples a partir de bounds (fallback sem polygon). */
export function buildRectFloorShape(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  expandM = 0
): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(minX - expandM, minZ - expandM);
  shape.lineTo(maxX + expandM, minZ - expandM);
  shape.lineTo(maxX + expandM, maxZ + expandM);
  shape.lineTo(minX - expandM, maxZ + expandM);
  shape.closePath();
  return shape;
}
