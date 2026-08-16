import * as THREE from "three";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import { applyMaterialToMesh } from "../materials/MaterialEngine";
import { applyRemateGrainOnSnap } from "../materials/viewerGrainOrientation";
import { isNestingRotationLocked } from "../../../core/materials/nestingGrainLock";
import { resolveIndustrialGrainCode } from "../../../core/materials/grainDirection";
import type { RemateBoxMeta } from "../../../core/remate/remateDimensions";
import { remateGeometryExtentsM } from "../../../core/remate/remateGeometryExtents";
import { resolveRematePoseLocal } from "../../../core/remate/remateMountFrame";
import {
  getRemateSavedPoseLocal,
  shouldResolveRematePoseFromBounds,
} from "../../../core/remate/remateTransformStability";
import { getRemateEnvelopeBoundsM } from "../../../core/remate/rematePlacement";
import {
  applyRemateLCompositeChildUserData,
  applyRemateLCompositeUserData,
  collectLRemateCompositeGroups,
  isLRemateCompositeCandidate,
  layoutLRemateComposite,
} from "./remateLCompositeVisual";

export type RematePieceVisualBoxConfig = {
  boxId: string;
  widthM: number;
  heightM: number;
  depthM: number;
  box?: RemateBoxMeta;
};

export type RematePieceVisualBridge = {
  listRematePieces: () => RematePiece[];
  getBoxConfig: (_boxId: string) => RematePieceVisualBoxConfig | null;
  getBoxWorldMatrix: (_boxId: string) => THREE.Matrix4 | null;
};

const REMATE_RENDER_ORDER = 12;
const REMATE_OUTLINE_RENDER_ORDER = 13;

function isRodapeLikeRematePiece(piece: RematePiece): boolean {
  return piece.tipo === "RODAPE" || piece.tipo === "RODAPE_L";
}

function isTampoLikeRematePiece(piece: RematePiece): boolean {
  return piece.tipo === "TAMPO" || piece.productType === "TAMPO_COZINHA";
}

export class RematePieceVisualizer {
  private bridge: RematePieceVisualBridge | null = null;
  private readonly root = new THREE.Group();
  private readonly meshById = new Map<string, THREE.Mesh>();
  private readonly compositeGroupById = new Map<string, THREE.Group>();
  private readonly compositeMeshByRemateId = new Map<string, THREE.Group>();
  private readonly mergeGroupById = new Map<string, THREE.Mesh>();

  constructor() {
    this.root.name = "remate-visual-root";
    this.root.userData.isRemateVisualRoot = true;
  }

  getRoot(): THREE.Group {
    return this.root;
  }

  getMeshByRemateId(remateId: string): THREE.Object3D | undefined {
    return this.compositeMeshByRemateId.get(remateId) ?? this.meshById.get(remateId);
  }

  bindBridge(bridge: RematePieceVisualBridge | null): void {
    this.bridge = bridge;
  }

  syncAll(): void {
    if (!this.bridge) {
      this.clearAll();
      return;
    }

    const remateList = this.bridge
      .listRematePieces()
      .filter((piece) => !isRodapeLikeRematePiece(piece) && !isTampoLikeRematePiece(piece));
    const lCompositeGroups = collectLRemateCompositeGroups(remateList);
    const compositeRemateIds = new Set<string>();
    for (const { ext, int } of lCompositeGroups.values()) {
      compositeRemateIds.add(ext.id);
      compositeRemateIds.add(int.id);
      this.upsertLRemateComposite(ext, int);
    }

    for (const piece of remateList) {
      if (compositeRemateIds.has(piece.id)) continue;
      this.upsertMesh(piece, false);
    }

    this.removeStaleMeshes(
      this.meshById,
      new Set(remateList.filter((p) => !compositeRemateIds.has(p.id)).map((p) => p.id))
    );
    this.removeStaleCompositeGroups(lCompositeGroups);
    this.removeStaleMeshes(this.mergeGroupById, new Set());

    // Merge visual reservado — método mantido para reativação futura sem perder lógica.
    void this.upsertMergeMesh;
  }

  clearBoxChildren(boxRoot: THREE.Object3D): void {
    const toRemove = boxRoot.children.filter((child) => child.userData?.isRematePiece === true);
    toRemove.forEach((child) => boxRoot.remove(child));
  }

  clearAll(): void {
    this.disposeMeshes(this.mergeGroupById);
    this.mergeGroupById.clear();

    this.disposeCompositeGroups();
    this.disposeMeshes(this.meshById);
    this.meshById.clear();
  }

  dispose(): void {
    this.clearAll();
    this.bridge = null;
  }

  private upsertLRemateComposite(ext: RematePiece, int: RematePiece): void {
    const groupId = ext.parentGroupId ?? ext.id;
    let group = this.compositeGroupById.get(groupId);
    if (!group) {
      group = new THREE.Group();
      applyRemateLCompositeUserData(group, ext, int);
      group.renderOrder = REMATE_RENDER_ORDER;
      this.compositeGroupById.set(groupId, group);
      this.root.add(group);
    } else {
      applyRemateLCompositeUserData(group, ext, int);
    }

    this.upsertCompositeChild(group, ext);
    this.upsertCompositeChild(group, int);
    layoutLRemateComposite(group, ext, int, this.bridge);

    this.compositeMeshByRemateId.set(ext.id, group);
    this.compositeMeshByRemateId.set(int.id, group);
  }

  private upsertCompositeChild(group: THREE.Group, piece: RematePiece): void {
    const { w, h, d } = remateGeometryExtentsM(piece);
    const existing = group.children.find(
      (child) => child.userData?.rematePartIndex === piece.partIndex
    ) as THREE.Mesh | undefined;

    let mesh = existing;
    if (!mesh) {
      mesh = this.createMesh(piece, w, h, d);
      applyRemateLCompositeChildUserData(mesh, piece);
      mesh.name = `remate-l-part-${piece.partIndex}-${piece.id}`;
      group.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(w, h, d);
      this.applyMaterial(mesh, piece);
      applyRemateLCompositeChildUserData(mesh, piece);
    }

    mesh.visible = true;
    mesh.renderOrder = REMATE_RENDER_ORDER;
    mesh.userData.remateOutlineRenderOrder = REMATE_OUTLINE_RENDER_ORDER;
    applyRemateGrainOnSnap(mesh, piece.materialPresetId, piece.faceOffsets?.rotationSnapIndex ?? 0, {
      grainLocked: this.isRemateGrainLocked(piece),
    });
  }

  private upsertMesh(piece: RematePiece, hidden: boolean): void {
    if (isLRemateCompositeCandidate(piece)) return;
    const { w, h, d } = remateGeometryExtentsM(piece);

    let mesh = this.meshById.get(piece.id);
    if (!mesh) {
      mesh = this.createMesh(piece, w, h, d);
      this.meshById.set(piece.id, mesh);
      this.root.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(w, h, d);
      this.applyMaterial(mesh, piece);
    }

    mesh.visible = !hidden;
    mesh.userData.remateProductType = piece.productType;
    mesh.userData.rematePartIndex = piece.partIndex;
    mesh.userData.remateParentGroupId = piece.parentGroupId ?? null;
    mesh.userData.remateDepthMm = piece.depth;
    this.applyWorldTransform(mesh, piece);
    applyRemateGrainOnSnap(mesh, piece.materialPresetId, piece.faceOffsets?.rotationSnapIndex ?? 0, {
      grainLocked: this.isRemateGrainLocked(piece),
    });
  }

  private removeStaleMeshes(map: Map<string, THREE.Mesh>, expectedIds: Set<string>): void {
    for (const [id, mesh] of map.entries()) {
      if (expectedIds.has(id)) continue;
      this.disposeMesh(mesh);
      map.delete(id);
    }
  }

  private removeStaleCompositeGroups(
    expected: Map<string, { ext: RematePiece; int: RematePiece }>
  ): void {
    for (const [groupId, group] of this.compositeGroupById.entries()) {
      if (expected.has(groupId)) continue;
      for (const [remateId, mapped] of this.compositeMeshByRemateId.entries()) {
        if (mapped === group) this.compositeMeshByRemateId.delete(remateId);
      }
      this.disposeCompositeGroup(group);
      this.compositeGroupById.delete(groupId);
    }
  }

  private disposeCompositeGroups(): void {
    this.compositeGroupById.forEach((group) => this.disposeCompositeGroup(group));
    this.compositeGroupById.clear();
    this.compositeMeshByRemateId.clear();
  }

  private disposeCompositeGroup(group: THREE.Group): void {
    group.children.slice().forEach((child) => {
      if (child instanceof THREE.Mesh) this.disposeMesh(child);
    });
    group.removeFromParent();
  }

  private disposeMeshes(map: Map<string, THREE.Mesh>): void {
    map.forEach((mesh) => this.disposeMesh(mesh));
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  }

  private upsertMergeMesh(
    group: { id: string; remateIds: string[]; spanMm: number; faceKind: RematePiece["tipo"] },
    remates: RematePiece[]
  ): void {
    const parts = group.remateIds
      .map((id) => remates.find((r) => r.id === id))
      .filter((r): r is RematePiece => r != null);
    if (parts.length < 2) return;

    const ref = parts[0]!;
    const thicknessM = Math.min(ref.width, ref.height, ref.depth) / 1000;
    let mergeW = thicknessM;
    let mergeH = ref.height / 1000;
    let mergeD = ref.depth / 1000;

    if (ref.tipo === "RODAPE" || ref.tipo === "RODAPE_L") {
      mergeW = group.spanMm / 1000;
      mergeH = ref.height / 1000;
      mergeD = thicknessM;
    } else if (ref.tipo === "DIR" || ref.tipo === "ESQ") {
      mergeW = thicknessM;
      mergeH = parts.reduce((s, p) => s + p.height, 0) / 1000 / parts.length;
      mergeD = group.spanMm / 1000;
    } else {
      mergeW = group.spanMm / 1000;
      mergeH = thicknessM;
      mergeD = parts[0]!.depth / 1000;
    }

    let mesh = this.mergeGroupById.get(group.id);
    if (!mesh) {
      mesh = this.createMesh(ref, mergeW, mergeH, mergeD);
      mesh.name = `remate-merge-${group.id}`;
      mesh.userData.isRemateMergeVisual = true;
      mesh.userData.mergeGroupId = group.id;
      this.mergeGroupById.set(group.id, mesh);
      this.root.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(mergeW, mergeH, mergeD);
    }

    mesh.visible = true;
    mesh.renderOrder = REMATE_RENDER_ORDER + 1;
    this.applyWorldTransform(mesh, ref);
  }

  private createMesh(piece: RematePiece, w: number, h: number, d: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: "#f2f0eb" })
    );
    this.applyMaterialPreset(mesh, piece);
    mesh.name = `remate-piece-${piece.id}`;
    mesh.userData.isRematePiece = true;
    mesh.userData.remateId = piece.id;
    mesh.userData.boxId = piece.parentBoxId ?? null;
    mesh.userData.remateTipo = piece.tipo;
    mesh.userData.remateFaceKind = piece.tipo;
    mesh.userData.pieceId = piece.id;
    mesh.userData.panelType = "remate";
    mesh.userData.remateOutlineRenderOrder = REMATE_OUTLINE_RENDER_ORDER;
    mesh.renderOrder = REMATE_RENDER_ORDER;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.remateProductType = piece.productType;
    mesh.userData.rematePartIndex = piece.partIndex;
    mesh.userData.remateParentGroupId = piece.parentGroupId ?? null;
    mesh.userData.remateDepthMm = piece.depth;
    return mesh;
  }

  private applyMaterialPreset(mesh: THREE.Mesh, piece: RematePiece): void {
    applyMaterialToMesh(mesh, piece.materialPresetId);
  }

  /** Veio bloqueado (mesma lógica das portas/frentes): madeira/lock vs "Rodar peça". */
  private isRemateGrainLocked(piece: RematePiece): boolean {
    return isNestingRotationLocked({
      materialId: piece.materialPresetId,
      industrialGrainCode: resolveIndustrialGrainCode({
        tipo: "remate",
        remateProductType: piece.productType,
        remateTipo: piece.tipo,
        remateMountSlot: piece.mountSlot,
      }),
      allowPieceRotation: piece.allowPieceRotation,
      lockWoodGrain: piece.lockWoodGrain,
    });
  }

  private applyMaterial(mesh: THREE.Mesh, piece: RematePiece): void {
    const prev = mesh.material;
    if (prev instanceof THREE.Material) prev.dispose();
    this.applyMaterialPreset(mesh, piece);
  }

  private applyWorldTransform(mesh: THREE.Mesh, piece: RematePiece): void {
    const pose = shouldResolveRematePoseFromBounds(piece)
      ? (() => {
          if (!piece.parentBoxId) {
            return getRemateSavedPoseLocal(piece);
          }
          const cfg = this.bridge?.getBoxConfig(piece.parentBoxId);
          if (!cfg) return getRemateSavedPoseLocal(piece);
          const bounds = getRemateEnvelopeBoundsM(cfg.widthM, cfg.heightM, cfg.depthM, cfg.box ?? null);
          return resolveRematePoseLocal(piece, bounds);
        })()
      : getRemateSavedPoseLocal(piece);

    if (piece.parentBoxId) {
      const worldMatrix = this.bridge?.getBoxWorldMatrix(piece.parentBoxId);
      if (worldMatrix) {
        const local = new THREE.Vector3(
          pose.position.xMm / 1000,
          pose.position.yMm / 1000,
          pose.position.zMm / 1000
        );
        local.applyMatrix4(worldMatrix);
        mesh.position.copy(local);
        const boxQuat = new THREE.Quaternion().setFromRotationMatrix(worldMatrix);
        const partQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(pose.rotation.xRad, pose.rotation.yRad, pose.rotation.zRad)
        );
        mesh.quaternion.copy(boxQuat).multiply(partQuat);
        return;
      }
    }

    mesh.position.set(pose.position.xMm / 1000, pose.position.yMm / 1000, pose.position.zMm / 1000);
    mesh.rotation.set(pose.rotation.xRad, pose.rotation.yRad, pose.rotation.zRad);
  }
}
