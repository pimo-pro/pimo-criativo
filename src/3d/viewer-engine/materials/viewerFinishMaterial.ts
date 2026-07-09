import * as THREE from "three";
import {
  isViewerGrainFlipped,
  resolveViewerGrainUvScale,
} from "../../../core/materials/nestingGrainLock";
import { applyMaterialToMesh } from "./MaterialEngine";
import {
  isViewerWoodMaterial,
  resolveViewerGrainSnapIndex,
} from "../utils/viewerPieceRotationPolicy";

export type ViewerFinishGrainOptions = {
  allowPieceRotation?: boolean;
  lockWoodGrain?: boolean;
  rotationSnapIndex?: number;
};

function applyGrainToMaterialMaps(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  materialId: string,
  options?: ViewerFinishGrainOptions
): void {
  const madeira = isViewerWoodMaterial(materialId);
  if (!madeira) return;

  const snapIdx = resolveViewerGrainSnapIndex(
    options?.rotationSnapIndex,
    materialId,
    options?.lockWoodGrain,
    options?.allowPieceRotation
  );
  const flipped = isViewerGrainFlipped(snapIdx);
  const scale = resolveViewerGrainUvScale(
    { x: 1, y: 1 },
    {
      materialMadeira: true,
      grainFlipped: flipped,
      grainDirection: "horizontal",
    }
  );

  for (const tex of [mat.map, mat.normalMap, mat.roughnessMap]) {
    if (!tex) continue;
    tex.repeat.set(scale.x, scale.y);
    tex.needsUpdate = true;
  }
  mat.needsUpdate = true;
}

/** Material de remate/rodapé com veio alinhado ao nesting industrial. */
export function applyFinishMaterialToMesh(
  mesh: THREE.Mesh,
  materialId: string,
  grainOptions?: ViewerFinishGrainOptions
): void {
  applyMaterialToMesh(mesh, materialId);
  const mat = mesh.material;
  if (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial
  ) {
    applyGrainToMaterialMaps(mat, materialId, grainOptions);
  }
  mesh.userData.viewerGrainOptions = grainOptions;
}
