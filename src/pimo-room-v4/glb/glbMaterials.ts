/**
 * Melhorias PBR no ViewerCore (normal maps / tangents / iluminação local).
 */
import * as THREE from "three";

/** Garante tangentes e normal maps utilizáveis em meshes importados. */
export function enhancePbrMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geo = obj.geometry;
    if (geo && !geo.attributes.tangent && geo.attributes.normal && geo.attributes.uv) {
      try {
        geo.computeTangents();
      } catch {
        // geometrias indexadas sem UV contínuo podem falhar — ignorar
      }
    }
    const apply = (mat: THREE.Material) => {
      if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)) {
        return;
      }
      mat.roughness = mat.roughness ?? 0.7;
      mat.metalness = mat.metalness ?? 0.05;
      if (mat.normalMap) {
        mat.normalScale = mat.normalScale ?? new THREE.Vector2(1, 1);
        mat.needsUpdate = true;
      }
      mat.envMapIntensity = mat.envMapIntensity ?? 1;
    };
    if (Array.isArray(obj.material)) obj.material.forEach(apply);
    else if (obj.material) apply(obj.material);
  });
}

/** Luzes de suporte para assets GLB/IFC (não substitui iluminação global do viewer). */
export function ensureAssetLights(scene: THREE.Scene): THREE.Group {
  const existing = scene.getObjectByName("roomAssetLights");
  if (existing) return existing as THREE.Group;
  const group = new THREE.Group();
  group.name = "roomAssetLights";
  const hemi = new THREE.HemisphereLight(0xf0f4ff, 0x3a3228, 0.45);
  const dir = new THREE.DirectionalLight(0xfff5e6, 0.65);
  dir.position.set(4, 8, 3);
  dir.castShadow = true;
  group.add(hemi, dir);
  scene.add(group);
  return group;
}
