import * as THREE from "three";

export type FeetCabinetEntry = {
  cabinetType?: "lower" | "upper";
  feetEnabled?: boolean;
  pe_cm?: number;
  height: number;
};

export type FeetVisualEntry = {
  mesh: THREE.Object3D;
  width: number;
  height: number;
  depth: number;
  cabinetType?: "lower" | "upper";
  pe_cm?: number;
  feetHeight?: number;
  feetOffsetFront?: number;
  feetEnabled?: boolean;
};

export type ViewerCoreFeetOpsDeps = {
  heightBaseCm: number;
  heightUpperCm: number;
  feetFrontInsetM: number;
  feetBackInsetM: number;
  feetSideInsetM: number;
};

export function shouldUseFeetLockImpl(
  entry: Pick<FeetCabinetEntry, "cabinetType" | "feetEnabled">
): boolean {
  return entry.cabinetType === "lower" && entry.feetEnabled === true;
}

export function shouldRenderFeetImpl(
  entry: Pick<FeetCabinetEntry, "feetEnabled">
): boolean {
  return entry.feetEnabled === true;
}

/** Altura Y (m) fixa para caixas inferiores com pés ativos. */
export function getFixedYForCabinetImpl(
  deps: ViewerCoreFeetOpsDeps,
  entry: FeetCabinetEntry
): number {
  const h = entry.height;
  if (entry.cabinetType === "lower") {
    const peM = (entry.pe_cm ?? deps.heightBaseCm) / 100;
    return peM + h / 2;
  }
  if (entry.cabinetType === "upper") {
    const baseM = deps.heightUpperCm / 100;
    return baseM + h / 2;
  }
  return h / 2;
}

export function removeFeetVisualImpl(root: THREE.Object3D): void {
  const existing = root.getObjectByName("kitchen-feet-group");
  if (!existing) return;
  root.remove(existing);
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  existing.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node.geometry && !disposedGeometries.has(node.geometry)) {
      node.geometry.dispose();
      disposedGeometries.add(node.geometry);
    }
    if (Array.isArray(node.material)) {
      node.material.forEach((material) => {
        if (!disposedMaterials.has(material)) {
          material.dispose();
          disposedMaterials.add(material);
        }
      });
    } else if (node.material && !disposedMaterials.has(node.material)) {
      node.material.dispose();
      disposedMaterials.add(node.material);
    }
  });
}

export function createKitchenFeetGroupImpl(
  deps: ViewerCoreFeetOpsDeps,
  width: number,
  height: number,
  depth: number,
  feetHeightM: number,
  feetOffsetFrontM: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = "kitchen-feet-group";
  group.userData.isKitchenFeet = true;

  const headHeight = 0.012;
  const baseHeight = 0.008;
  const bodyHeight = Math.max(0.02, feetHeightM - headHeight - baseHeight);
  const headSize = 0.036;
  const bodyRadius = 0.012;
  const baseRadius = 0.03;

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.32,
    metalness: 0.82,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.85,
    metalness: 0.1,
  });

  const headGeometry = new THREE.BoxGeometry(headSize, headHeight, headSize);
  const bodyGeometry = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 18);
  const baseGeometry = new THREE.CylinderGeometry(baseRadius, baseRadius, baseHeight, 22);

  const createFoot = () => {
    const foot = new THREE.Group();
    const topY = -height / 2;
    const head = new THREE.Mesh(headGeometry, metalMat);
    head.position.y = topY - headHeight / 2;
    head.castShadow = true;
    head.receiveShadow = true;

    const body = new THREE.Mesh(bodyGeometry, metalMat);
    body.position.y = topY - headHeight - bodyHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;

    const base = new THREE.Mesh(baseGeometry, baseMat);
    base.position.y = topY - headHeight - bodyHeight - baseHeight / 2;
    base.castShadow = true;
    base.receiveShadow = true;

    foot.add(head, body, base);
    return foot;
  };

  const widthInsetLimit = Math.max(0.02, width / 2 - baseRadius - 0.005);
  const depthInsetLimit = Math.max(0.02, depth / 2 - baseRadius - 0.005);
  const sideInset = Math.min(deps.feetSideInsetM, widthInsetLimit);
  const frontInset = Math.min(Math.max(0, feetOffsetFrontM), depthInsetLimit);
  const backInset = Math.min(deps.feetBackInsetM, depthInsetLimit);

  const xLeft = -width / 2 + sideInset;
  const xRight = width / 2 - sideInset;
  const zFront = depth / 2 - frontInset;
  const zBack = -depth / 2 + backInset;

  const placements: Array<{ x: number; z: number }> = [
    { x: xLeft, z: zFront },
    { x: xRight, z: zFront },
    { x: xLeft, z: zBack },
    { x: xRight, z: zBack },
  ];

  placements.forEach(({ x, z }) => {
    const foot = createFoot();
    foot.position.set(x, 0, z);
    group.add(foot);
  });

  return group;
}

export function syncFeetVisualForBoxImpl(
  deps: ViewerCoreFeetOpsDeps,
  entry: FeetVisualEntry
): void {
  removeFeetVisualImpl(entry.mesh);
  if (!shouldRenderFeetImpl(entry)) return;
  const feetHeightMm = Math.max(40, entry.feetHeight ?? ((entry.pe_cm ?? deps.heightBaseCm) * 10));
  const feetOffsetFrontMm = Math.max(0, entry.feetOffsetFront ?? (deps.feetFrontInsetM * 1000));
  const feet = createKitchenFeetGroupImpl(
    deps,
    entry.width,
    entry.height,
    entry.depth,
    feetHeightMm / 1000,
    feetOffsetFrontMm / 1000
  );
  entry.mesh.add(feet);
}
