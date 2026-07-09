import * as THREE from "three";
import type { ProjectRodape } from "../../../core/rodape/rodapeTypes";
import {
  applyFinishMaterialToMesh,
} from "../materials/viewerFinishMaterial";
import { computeRodapePlacementLocal, getStructuralBoundsM } from "../../../core/rodape/rodapePlacement";
import { computeRodapeVisualMergeGroups, rodapeIdsInMergeGroup } from "../../../core/rodape/rodapeMerge";
import { isViewerRodapeRotationAllowed } from "../utils/viewerPieceRotationPolicy";

export type RodapeVisualBoxConfig = {
  boxId: string;
  widthM: number;
  heightM: number;
  depthM: number;
  rodapes: ProjectRodape[];
};

export type RodapeVisualBridge = {
  getBoxRodapeConfig: (_boxId: string) => RodapeVisualBoxConfig | null;
  getBoxWorldMatrix: (_boxId: string) => THREE.Matrix4 | null;
  listBoxRodapeConfigs: () => RodapeVisualBoxConfig[];
};

const RENDER_ORDER = 14;

export class RodapeVisualizer {
  private bridge: RodapeVisualBridge | null = null;
  private readonly root = new THREE.Group();
  private readonly meshById = new Map<string, THREE.Mesh>();
  private readonly mergeGroupById = new Map<string, THREE.Mesh>();

  constructor() {
    this.root.name = "rodape-visual-root";
  }

  getRoot(): THREE.Group {
    return this.root;
  }

  getMeshByRodapeId(rodapeId: string): THREE.Mesh | undefined {
    return this.meshById.get(rodapeId);
  }

  bindBridge(bridge: RodapeVisualBridge | null): void {
    this.bridge = bridge;
  }

  syncAll(): void {
    if (!this.bridge) {
      this.clearAll();
      return;
    }

    const configs = this.bridge.listBoxRodapeConfigs();
    const boxConfigs = new Map<string, RodapeVisualBoxConfig>();
    const list: ProjectRodape[] = [];
    for (const cfg of configs) {
      boxConfigs.set(cfg.boxId, cfg);
      list.push(...cfg.rodapes.filter((r) => r.visible !== false));
    }

    const mergeGroups = computeRodapeVisualMergeGroups(list);
    const mergedIds = rodapeIdsInMergeGroup(mergeGroups);
    const expectedIds = new Set(list.map((rodape) => rodape.id));
    const expectedMergeIds = new Set(mergeGroups.filter((group) => group.rodapeIds.length >= 2).map((group) => group.id));

    for (const rodape of list) {
      const cfg = boxConfigs.get(rodape.parentBoxId);
      if (!cfg) continue;
      this.upsertMesh(rodape, cfg, mergedIds.has(rodape.id));
    }

    for (const group of mergeGroups) {
      if (group.rodapeIds.length < 2) continue;
      this.upsertMergeMesh(group, list, boxConfigs);
    }
    this.removeStaleMeshes(this.meshById, expectedIds);
    this.removeStaleMeshes(this.mergeGroupById, expectedMergeIds);
  }

  clearAll(): void {
    this.disposeMeshes(this.mergeGroupById);
    this.mergeGroupById.clear();
    this.disposeMeshes(this.meshById);
    this.meshById.clear();
  }

  dispose(): void {
    this.clearAll();
    this.bridge = null;
  }

  private disposeMeshes(map: Map<string, THREE.Mesh>): void {
    map.forEach((mesh) => {
      this.disposeMesh(mesh);
    });
  }

  private removeStaleMeshes(map: Map<string, THREE.Mesh>, expectedIds: Set<string>): void {
    for (const [id, mesh] of map.entries()) {
      if (expectedIds.has(id)) continue;
      this.disposeMesh(mesh);
      map.delete(id);
    }
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  }

  private upsertMesh(rodape: ProjectRodape, cfg: RodapeVisualBoxConfig, hidden: boolean): void {
    const w = Math.max(0.001, rodape.dimensions.widthMm / 1000);
    const h = Math.max(0.001, (rodape.dimensions.heightMm ?? rodape.heightMm) / 1000);
    const d = Math.max(0.001, rodape.dimensions.depthMm / 1000);

    let mesh = this.meshById.get(rodape.id);
    if (!mesh) {
      mesh = this.createMesh(rodape, w, h, d);
      this.meshById.set(rodape.id, mesh);
      this.root.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(w, h, d);
      this.applyMaterial(mesh, rodape);
    }

    mesh.visible = !hidden;
    if (!rodape.placementFree) this.applyInitialPlacement(mesh, rodape, cfg);
    else if (rodape.transform) this.applyTransform(mesh, rodape, cfg.boxId);
  }

  private upsertMergeMesh(
    group: { id: string; rodapeIds: string[]; spanMm: number },
    rodapes: ProjectRodape[],
    boxConfigs: Map<string, RodapeVisualBoxConfig>
  ): void {
    const parts = group.rodapeIds
      .map((id) => rodapes.find((r) => r.id === id))
      .filter((r): r is ProjectRodape => r != null);
    if (parts.length < 2) return;
    const ref = parts[0]!;
    const cfg = boxConfigs.get(ref.parentBoxId);
    if (!cfg) return;

    const h = (ref.dimensions.heightMm ?? ref.heightMm) / 1000;
    const d = Math.max(0.001, ref.thicknessMm / 1000);
    const mergeW = group.spanMm / 1000;

    let mesh = this.mergeGroupById.get(group.id);
    if (!mesh) {
      mesh = this.createMesh(ref, mergeW, h, d);
      mesh.name = `rodape-merge-${group.id}`;
      mesh.userData.isRodapeMergeVisual = true;
      this.mergeGroupById.set(group.id, mesh);
      this.root.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(mergeW, h, d);
    }
    mesh.renderOrder = RENDER_ORDER + 1;
    if (!ref.placementFree) this.applyInitialPlacement(mesh, ref, cfg);
  }

  private createMesh(rodape: ProjectRodape, w: number, h: number, d: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: "#f2f0eb" })
    );
    this.applyMaterialPreset(mesh, rodape);
    mesh.name = `rodape-${rodape.id}`;
    mesh.userData.isRodapePiece = true;
    mesh.userData.rodapeId = rodape.id;
    mesh.userData.boxId = rodape.parentBoxId;
    mesh.userData.pieceId = rodape.id;
    mesh.userData.panelType = "rodape";
    mesh.renderOrder = RENDER_ORDER;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private applyMaterialPreset(mesh: THREE.Mesh, rodape: ProjectRodape): void {
    applyFinishMaterialToMesh(mesh, rodape.materialId, {
      allowPieceRotation: rodape.allowPieceRotation,
      lockWoodGrain: rodape.lockWoodGrain,
      rotationSnapIndex: isViewerRodapeRotationAllowed(rodape)
        ? resolveRodapeRotationSnapIndex(rodape)
        : 0,
    });
  }

  private applyMaterial(mesh: THREE.Mesh, rodape: ProjectRodape): void {
    const prev = mesh.material;
    if (prev instanceof THREE.Material) prev.dispose();
    this.applyMaterialPreset(mesh, rodape);
  }

  private applyInitialPlacement(mesh: THREE.Mesh, rodape: ProjectRodape, cfg: RodapeVisualBoxConfig): void {
    const bounds = getStructuralBoundsM(cfg.widthM, cfg.heightM, cfg.depthM);
    const local = computeRodapePlacementLocal(rodape, bounds);
    this.applyLocalToWorld(mesh, local, cfg.boxId);
  }

  private applyTransform(mesh: THREE.Mesh, rodape: ProjectRodape, boxId: string): void {
    const t = rodape.transform;
    if (!t) return;
    const worldMatrix = this.bridge?.getBoxWorldMatrix(boxId);
    if (worldMatrix && t.xMm != null && t.yMm != null && t.zMm != null) {
      const local = new THREE.Vector3(t.xMm / 1000, t.yMm / 1000, t.zMm / 1000);
      local.applyMatrix4(worldMatrix);
      mesh.position.copy(local);
    }
    if (!isViewerRodapeRotationAllowed(rodape)) {
      mesh.rotation.set(0, 0, 0);
      if (worldMatrix) {
        const quat = new THREE.Quaternion().setFromRotationMatrix(worldMatrix);
        mesh.quaternion.copy(quat);
      }
      return;
    }
    mesh.rotation.set(t.rotacaoXRad ?? 0, t.rotacaoYRad ?? 0, t.rotacaoZRad ?? 0);
  }

  private applyLocalToWorld(
    mesh: THREE.Mesh,
    local: { position: [number, number, number]; rotation: [number, number, number] },
    boxId: string
  ): void {
    const worldMatrix = this.bridge?.getBoxWorldMatrix(boxId);
    if (!worldMatrix) {
      mesh.position.set(...local.position);
      mesh.rotation.set(...local.rotation);
      return;
    }
    const pos = new THREE.Vector3(...local.position);
    pos.applyMatrix4(worldMatrix);
    mesh.position.copy(pos);
    const quat = new THREE.Quaternion().setFromRotationMatrix(worldMatrix);
    const partQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(local.rotation[0], local.rotation[1], local.rotation[2])
    );
    mesh.quaternion.copy(quat).multiply(partQuat);
  }
}

function resolveRodapeRotationSnapIndex(rodape: ProjectRodape): number {
  const yRad = rodape.transform?.rotacaoYRad ?? 0;
  const quarter = Math.PI / 2;
  return ((Math.round(yRad / quarter) % 4) + 4) % 4;
}
