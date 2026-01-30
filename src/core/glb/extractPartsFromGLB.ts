/**
 * Extrai peças (meshes) de uma cena GLTF/GLB.
 * Cada mesh vira uma peça com bounding box em mm, posição, rotação e material hint.
 */

import * as THREE from "three";
import { mToMm } from "../../utils/units";
import type { ExtractedPart } from "./types";

let partIndex = 0;

function nextPartId(): string {
  partIndex += 1;
  return `glb-part-${partIndex}`;
}

/**
 * Obtém hint de material a partir do mesh (nome do material ou cor hexadecimal).
 */
function getMaterialHint(mesh: THREE.Mesh): string | undefined {
  const mat = mesh.material;
  if (!mat) return undefined;
  if (Array.isArray(mat)) {
    const first = mat[0];
    return first?.name ?? (first && "color" in first ? (first as THREE.MeshStandardMaterial).color.getHexString() : undefined);
  }
  if (mat.name) return mat.name;
  if ("color" in mat && mat.color instanceof THREE.Color) {
    return mat.color.getHexString();
  }
  return undefined;
}

/**
 * Extrai peças (uma por mesh) da cena GLTF.
 * Dimensões e posições são convertidas para mm (Three.js usa 1 unidade = 1 m).
 */
export function extractPartsFromGLB(gltfScene: THREE.Object3D): ExtractedPart[] {
  partIndex = 0;
  const parts: ExtractedPart[] = [];
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  gltfScene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.geometry) return;
    const mesh = object;
    mesh.updateMatrixWorld(true);
    box.setFromObject(mesh);
    box.getCenter(center);
    box.getSize(size);

    const larguraMm = Math.max(0.1, mToMm(size.x));
    const alturaMm = Math.max(0.1, mToMm(size.y));
    const profundidadeMm = Math.max(0.1, mToMm(size.z));
    const dims = [larguraMm, alturaMm, profundidadeMm].sort((a, b) => a - b);
    const espessuraMm = dims[0];

    const rotacao = mesh.rotation;
    parts.push({
      id: nextPartId(),
      nome: mesh.name || "Peça",
      dimensoes: {
        largura: Math.round(larguraMm * 10) / 10,
        altura: Math.round(alturaMm * 10) / 10,
        profundidade: Math.round(profundidadeMm * 10) / 10,
      },
      espessura: Math.round(espessuraMm * 10) / 10,
      posicao: {
        x: Math.round(mToMm(center.x) * 10) / 10,
        y: Math.round(mToMm(center.y) * 10) / 10,
        z: Math.round(mToMm(center.z) * 10) / 10,
      },
      rotacao: {
        x: rotacao.x,
        y: rotacao.y,
        z: rotacao.z,
      },
      materialHint: getMaterialHint(mesh),
    });
  });

  return parts;
}
