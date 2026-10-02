/**
 * ceilingMeshBuilder — geometria de tecto da sala (vNext).
 * Paridade com rebuildRoomFloorAndCeiling do ViewerCore.
 */
import * as THREE from "three";

export type CeilingMaterialConfig = {
  color: number;
  roughness: number;
  metalness: number;
  opacity: number;
};

export type CeilingBoundsM = {
  maxY: number;
};

/**
 * Constrói mesh de tecto a partir do mesmo Shape do piso.
 */
export function ceilingMeshBuilder(
  shape: THREE.Shape,
  bounds: CeilingBoundsM,
  sceneConfig: CeilingMaterialConfig,
  visible: boolean
): THREE.Mesh {
  const ceilingGeom = new THREE.ShapeGeometry(shape);
  ceilingGeom.rotateX(Math.PI / 2);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: sceneConfig.color,
    roughness: sceneConfig.roughness,
    metalness: sceneConfig.metalness,
    transparent: true,
    opacity: Math.min(0.45, sceneConfig.opacity),
    side: THREE.DoubleSide,
  });
  const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
  ceiling.position.y = bounds.maxY;
  ceiling.name = "room-ceiling";
  ceiling.userData.isRoomCeiling = true;
  ceiling.visible = visible;
  return ceiling;
}
