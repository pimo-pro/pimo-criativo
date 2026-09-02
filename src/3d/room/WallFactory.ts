/**
 * pimo-room v4 — fábrica de meshes de parede (MeshStandardMaterial / WebGL).
 */
import * as THREE from "three";
import type { Room } from "./Room";
import { getSceneMaterialConfig } from "../viewer-engine/materials";
import { buildWallBoxGeometry } from "./wallGeometryCsg";
import { applyDynamicMitersToWallMeshes } from "./wallMiters";

let currentWallThicknessM = 0.2;

export function getWallThicknessM(): number {
  return currentWallThicknessM;
}

export function setWallThicknessM(value: number): void {
  currentWallThicknessM = Math.max(0.05, value);
}

interface WallMaterialOptions {
  doubleSide?: boolean;
  transparent?: boolean;
  opacity?: number;
  color?: number;
}

/** Cria um material de parede a partir da config de cena (MaterialEngine). */
function createWallMaterialFromConfig(
  config: { color: number; roughness: number; metalness: number; transparent: boolean; opacity: number },
  overrides: WallMaterialOptions = {}
): THREE.MeshStandardMaterial {
  const {
    doubleSide = true,
    transparent = config.transparent,
    opacity = config.opacity,
    color = config.color,
  } = overrides;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: config.roughness,
    metalness: config.metalness,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent,
    opacity,
  });
}

export type RoomNumWalls = 3 | 4;

/**
 * Cria as paredes principais para uma sala.
 * numWalls === 4: front, right, back, left (sala fechada).
 * numWalls === 3: front, right, left (sala de estar / aberta, sem parede traseira).
 * Miters: calculados dinamicamente nas junções (fallback 0 em extremos livres).
 */
export function createMainWalls(room: Room, numWalls: RoomNumWalls = 4, wallThicknessM?: number): THREE.Mesh[] {
  const t = wallThicknessM ?? getWallThicknessM();
  const { width, depth, height, minX, maxX, minZ, maxZ, centerX, centerZ, minY } = room;
  const yCenter = minY + height / 2;
  const config = getSceneMaterialConfig();
  const wallMat = createWallMaterialFromConfig(config.wall, { opacity: 0.6 });

  const front = new THREE.Mesh(buildWallBoxGeometry(width, height, t), wallMat);
  front.position.set(centerX, yCenter, minZ - t / 2);
  front.userData.wallId = 0;
  front.userData.wallNormal = new THREE.Vector3(0, 0, -1);
  front.userData.isRoomWall = true;
  front.userData.isMainWall = true;
  front.userData.wallLengthMm = width * 1000;
  front.userData.wallHeightMm = height * 1000;
  front.userData.wallThicknessM = t;
  front.castShadow = true;
  front.receiveShadow = true;

  const right = new THREE.Mesh(buildWallBoxGeometry(depth, height, t), wallMat);
  right.rotation.y = Math.PI / 2;
  right.position.set(maxX + t / 2, yCenter, centerZ);
  right.userData.wallId = 1;
  right.userData.wallNormal = new THREE.Vector3(-1, 0, 0);
  right.userData.isRoomWall = true;
  right.userData.isMainWall = true;
  right.userData.wallLengthMm = depth * 1000;
  right.userData.wallHeightMm = height * 1000;
  right.userData.wallThicknessM = t;
  right.castShadow = true;
  right.receiveShadow = true;

  const walls: THREE.Mesh[] = [front, right];

  if (numWalls >= 4) {
    const back = new THREE.Mesh(buildWallBoxGeometry(width, height, t), wallMat);
    back.position.set(centerX, yCenter, maxZ + t / 2);
    back.userData.wallId = 2;
    back.userData.wallNormal = new THREE.Vector3(0, 0, 1);
    back.userData.isRoomWall = true;
    back.userData.isMainWall = true;
    back.userData.wallLengthMm = width * 1000;
    back.userData.wallHeightMm = height * 1000;
    back.userData.wallThicknessM = t;
    back.castShadow = true;
    back.receiveShadow = true;
    walls.push(back);
  }

  const left = new THREE.Mesh(buildWallBoxGeometry(depth, height, t), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(minX - t / 2, yCenter, centerZ);
  left.userData.wallId = numWalls >= 4 ? 3 : 2;
  left.userData.wallNormal = new THREE.Vector3(1, 0, 0);
  left.userData.isRoomWall = true;
  left.userData.isMainWall = true;
  left.userData.wallLengthMm = depth * 1000;
  left.userData.wallHeightMm = height * 1000;
  left.userData.wallThicknessM = t;
  left.castShadow = true;
  left.receiveShadow = true;
  walls.push(left);

  applyDynamicMitersToWallMeshes(walls);
  return walls;
}

/**
 * Reposiciona as paredes principais conforme as dimensões da sala.
 * Suporta 3 paredes (sala aberta: front, right, left) ou 4 (sala fechada: front, right, back, left).
 */
export function positionMainWalls(room: Room, walls: THREE.Mesh[]): void {
  if (walls.length < 3) return;
  const t = getWallThicknessM();
  const { width, depth, minX, maxX, minZ, maxZ, centerX, centerZ, minY, height } = room;
  const yCenter = minY + height / 2;
  const front = walls[0];
  const right = walls[1];
  const back = walls.length >= 4 ? walls[2] : null;
  const left = walls.length >= 4 ? walls[3] : walls[2];

  front.geometry.dispose();
  front.geometry = buildWallBoxGeometry(width, height, t);
  front.position.set(centerX, yCenter, minZ - t / 2);
  front.rotation.y = 0;
  front.userData.wallLengthMm = width * 1000;
  front.userData.wallHeightMm = height * 1000;
  front.userData.wallThicknessM = t;

  right.geometry.dispose();
  right.geometry = buildWallBoxGeometry(depth, height, t);
  right.rotation.y = Math.PI / 2;
  right.position.set(maxX + t / 2, yCenter, centerZ);
  right.userData.wallLengthMm = depth * 1000;
  right.userData.wallHeightMm = height * 1000;
  right.userData.wallThicknessM = t;

  if (back) {
    back.geometry.dispose();
    back.geometry = buildWallBoxGeometry(width, height, t);
    back.position.set(centerX, yCenter, maxZ + t / 2);
    back.rotation.y = 0;
    back.userData.wallLengthMm = width * 1000;
    back.userData.wallHeightMm = height * 1000;
    back.userData.wallThicknessM = t;
  }

  left.geometry.dispose();
  left.geometry = buildWallBoxGeometry(depth, height, t);
  left.rotation.y = Math.PI / 2;
  left.position.set(minX - t / 2, yCenter, centerZ);
  left.userData.wallLengthMm = depth * 1000;
  left.userData.wallHeightMm = height * 1000;
  left.userData.wallThicknessM = t;

  applyDynamicMitersToWallMeshes(walls.filter(Boolean) as THREE.Mesh[]);
}

/**
 * Cria uma parede extra (livre). Dimensões padrão; posição (0,0,0) para o caller posicionar.
 * Usa config.wallExtra da cena (MaterialEngine).
 */
export function createExtraWall(
  id: number,
  options: { lengthM?: number; heightM?: number; thicknessM?: number; isMainWall?: boolean } = {}
): THREE.Mesh {
  const length = options.lengthM ?? 2;
  const height = options.heightM ?? 2.7;
  const t = options.thicknessM ?? getWallThicknessM();
  const config = getSceneMaterialConfig();
  const mat = createWallMaterialFromConfig(config.wallExtra, { opacity: 0.6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, t), mat);
  mesh.position.set(0, height / 2, 0);
  mesh.userData.wallId = id;
  mesh.userData.wallNormal = new THREE.Vector3(0, 0, 1);
  mesh.userData.isRoomWall = true;
  mesh.userData.isMainWall = options.isMainWall === true;
  mesh.userData.wallLengthMm = length * 1000;
  mesh.userData.wallHeightMm = height * 1000;
  mesh.userData.wallThicknessM = t;
  return mesh;
}
