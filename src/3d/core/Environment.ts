import * as THREE from "three";

export type EnvironmentOptions = {
  groundSize?: number;
  groundColor?: string;
  showGrid?: boolean;
  gridSize?: number;
  gridDivisions?: number;
  gridColor?: string;
};

export const createGround = (options: EnvironmentOptions = {}) => {
  const size = options.groundSize ?? 20;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.groundColor ?? "#e2e8f0"),
    roughness: 0.9,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
};

export const createGrid = (options: EnvironmentOptions = {}) => {
  const size = options.gridSize ?? 20;
  const divisions = options.gridDivisions ?? 20;
  const color = options.gridColor ?? "#94a3b8";
  const grid = new THREE.GridHelper(size, divisions, color, color);
  grid.position.y = 0.001;
  return grid;
};
