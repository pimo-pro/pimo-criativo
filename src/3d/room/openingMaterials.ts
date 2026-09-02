/**
 * pimo-room v4 — materiais de portas/janelas alinhados ao tema pimo (WebGL).
 * Usa tokens próximos de `getSceneMaterialConfig` + madeira/vidro distintos das paredes.
 */
import * as THREE from "three";
import { getSceneMaterialConfig } from "../viewer-engine/materials";

export type OpeningMaterialSet = {
  leaf: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  hardware: THREE.MeshStandardMaterial;
};

/** Materiais partilháveis (clonar por mesh se for mutar cor). */
export function createOpeningMaterials(): OpeningMaterialSet {
  const scene = getSceneMaterialConfig();
  return {
    leaf: new THREE.MeshStandardMaterial({
      color: 0xb45309, // madeira âmbar pimo
      roughness: 0.72,
      metalness: 0.04,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: scene.wallExtra.color,
      roughness: 0.65,
      metalness: 0.08,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    hardware: new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.35,
      metalness: 0.65,
    }),
  };
}
