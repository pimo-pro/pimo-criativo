import * as THREE from "three";
import type { ViewerMaterialQuality } from "../../../context/projectTypes";

type DisplayMaterialBase = {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  map: THREE.Texture | null;
  clearcoat?: number;
  clearcoatRoughness?: number;
};

export type DisplayMaterialProfileState = {
  materialQuality: ViewerMaterialQuality;
  glossIntensity: number;
  matteMode: boolean;
};

/** Reconcilia brilho/qualidade visual sobre materiais já aplicados pelo MaterialEngine. */
export class DisplayMaterialController {
  private displayMaterialBaseByUuid = new Map<string, DisplayMaterialBase>();
  private premiumTexture: THREE.CanvasTexture | null = null;

  reapply(root: THREE.Object3D, state: DisplayMaterialProfileState): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        const isPhysical = material instanceof THREE.MeshPhysicalMaterial;

        if (!this.displayMaterialBaseByUuid.has(material.uuid)) {
          const snap: DisplayMaterialBase = {
            roughness: material.roughness,
            metalness: material.metalness,
            envMapIntensity: material.envMapIntensity,
            map: material.map,
          };
          if (isPhysical) {
            snap.clearcoat = (material as THREE.MeshPhysicalMaterial).clearcoat;
            snap.clearcoatRoughness = (material as THREE.MeshPhysicalMaterial).clearcoatRoughness;
          }
          this.displayMaterialBaseByUuid.set(material.uuid, snap);
        }
        const base = this.displayMaterialBaseByUuid.get(material.uuid);
        if (!base) return;

        let roughness = base.roughness;
        let metalness = base.metalness;
        let envMapIntensity = base.envMapIntensity;
        let clearcoat = base.clearcoat;
        let clearcoatRoughness = base.clearcoatRoughness;

        if (state.materialQuality === "lacquered") {
          roughness = Math.min(base.roughness, 0.18);
          metalness = Math.max(base.metalness, 0.1);
          envMapIntensity = Math.max(base.envMapIntensity, 1.1);
        } else if (state.materialQuality === "premium") {
          roughness = Math.max(0.18, base.roughness * 0.72);
          metalness = Math.min(0.28, Math.max(0.03, base.metalness * 1.06));
          envMapIntensity = Math.max(base.envMapIntensity, 0.95);
        }

        if (!state.matteMode) {
          const t = state.glossIntensity;
          roughness = roughness + (1 - t) * (1 - roughness);
          envMapIntensity = envMapIntensity * t;
          if (clearcoat !== undefined) {
            clearcoat = clearcoat * t;
            if (clearcoatRoughness !== undefined) {
              clearcoatRoughness = clearcoatRoughness + (1 - t) * (1 - clearcoatRoughness);
            }
          }
        } else {
          roughness = Math.max(roughness, 0.92);
          envMapIntensity = 0;
          if (clearcoat !== undefined) clearcoat = 0;
        }

        material.roughness = roughness;
        material.metalness = metalness;
        material.envMapIntensity = envMapIntensity;
        if (isPhysical && clearcoat !== undefined) {
          (material as THREE.MeshPhysicalMaterial).clearcoat = clearcoat;
          if (clearcoatRoughness !== undefined) {
            (material as THREE.MeshPhysicalMaterial).clearcoatRoughness = clearcoatRoughness;
          }
        }
        material.needsUpdate = true;
      });
    });
  }

  dispose(): void {
    this.displayMaterialBaseByUuid.clear();
    if (this.premiumTexture) {
      this.premiumTexture.dispose();
      this.premiumTexture = null;
    }
  }
}
