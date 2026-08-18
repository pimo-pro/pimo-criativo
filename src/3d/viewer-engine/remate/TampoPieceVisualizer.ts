import * as THREE from "three";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import { applyMaterialToMesh } from "../materials/MaterialEngine";
import { applyRemateGrainOnSnap } from "../materials/viewerGrainOrientation";
import { isNestingRotationLocked } from "../../../core/materials/nestingGrainLock";
import { resolveIndustrialGrainCode } from "../../../core/materials/grainDirection";
import { remateGeometryExtentsM } from "../../../core/remate/remateGeometryExtents";
import { resolveRematePoseLocal } from "../../../core/remate/remateMountFrame";
import {
  getRemateSavedPoseLocal,
  shouldResolveRematePoseFromBounds,
} from "../../../core/remate/remateTransformStability";
import { getRemateEnvelopeBoundsM } from "../../../core/remate/rematePlacement";
import type { RematePieceVisualBridge } from "./RematePieceVisualizer";
import {
  createTampoPostformingGeometry,
  createTampoPostformingGeometryFromShape,
  TAMPO_POSTFORM_RADIUS_MM,
} from "./tampoPostformingGeometry";
import { buildTampoGeometryWithCutouts } from "./TampoCutoutVisualizer";
import { applyTampoUnion } from "./TampoUnionVisualizer";
import { buildTampoAngleShape } from "./tampoAngleGeometry";
import {
  normalizeTampoAngleConfig,
  resolveTampoAngleEnvelopeMm,
  isTampoAngularConfig,
} from "../../../core/remate/tampoAngle";

export { TAMPO_POSTFORM_RADIUS_MM };

const TAMPO_RENDER_ORDER = 12;
const TAMPO_OUTLINE_RENDER_ORDER = 13;

function resolveTampoGeometry(
  piece: RematePiece,
  w: number,
  h: number,
  d: number
): THREE.BufferGeometry {
  const baseLengthMm = piece.width;
  const widthMm = piece.height;
  const cfg = normalizeTampoAngleConfig(piece.angleConfig, widthMm);

  const base = cfg
    ? createTampoPostformingGeometryFromShape(
        buildTampoAngleShape(cfg, baseLengthMm, widthMm),
        d
      )
    : createTampoPostformingGeometry(w, h, d);

  const withCutouts = buildTampoGeometryWithCutouts(base, piece.cutouts);
  const envelope = resolveTampoAngleEnvelopeMm(cfg, baseLengthMm, widthMm);
  const finalGeom = applyTampoUnion(withCutouts, piece.union, {
    w: envelope.lengthMm / 1000,
    h: envelope.widthMm / 1000,
    d,
  });
  finalGeom.computeBoundingBox();
  finalGeom.computeBoundingSphere();
  return finalGeom;
}

/** Peça TAMPO / Tampo Cozinha — visualização dedicada (postforming). */
export function isTampoVisualPiece(piece: RematePiece): boolean {
  return piece.tipo === "TAMPO" || piece.productType === "TAMPO_COZINHA";
}

/**
 * Visualizador Viewer do TAMPO (Fase 2).
 * Mesmo bridge/snapping que remates; geometria Extrude com borda frontal arredondada.
 * Viewer Fase 2: tipo TAMPO / productType TAMPO_COZINHA → este visualizador (postforming).
 */
export class TampoPieceVisualizer {
  private bridge: RematePieceVisualBridge | null = null;
  private readonly root = new THREE.Group();
  private readonly meshById = new Map<string, THREE.Mesh>();

  constructor() {
    this.root.name = "tampo-visual-root";
    this.root.userData.isTampoVisualRoot = true;
  }

  getRoot(): THREE.Group {
    return this.root;
  }

  getMeshByRemateId(remateId: string): THREE.Mesh | undefined {
    return this.meshById.get(remateId);
  }

  bindBridge(bridge: RematePieceVisualBridge | null): void {
    this.bridge = bridge;
  }

  syncAll(): void {
    if (!this.bridge) {
      this.clearAll();
      return;
    }

    const tampoList = this.bridge.listRematePieces().filter(isTampoVisualPiece);
    const expected = new Set(tampoList.map((p) => p.id));

    for (const piece of tampoList) {
      this.upsertMesh(piece);
    }
    this.removeStaleMeshes(expected);
  }

  clearAll(): void {
    this.meshById.forEach((mesh) => this.disposeMesh(mesh));
    this.meshById.clear();
  }

  dispose(): void {
    this.clearAll();
    this.bridge = null;
  }

  private upsertMesh(piece: RematePiece): void {
    const { w, h, d } = remateGeometryExtentsM(piece);
    let mesh = this.meshById.get(piece.id);
    if (!mesh) {
      mesh = this.createMesh(piece, w, h, d);
      this.meshById.set(piece.id, mesh);
      this.root.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = resolveTampoGeometry(piece, w, h, d);
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
      this.applyMaterial(mesh, piece);
    }

    mesh.visible = piece.visible !== false;
    mesh.name = piece.id;
    mesh.userData.remateId = piece.id;
    mesh.userData.pieceId = piece.id;
    mesh.userData.isRematePiece = true;
    mesh.userData.isTampoPiece = true;
    mesh.userData.remateProductType = piece.productType;
    mesh.userData.rematePartIndex = piece.partIndex;
    mesh.userData.remateParentGroupId = piece.parentGroupId ?? null;
    mesh.userData.remateDepthMm = piece.depth;
    mesh.userData.remateTipo = piece.tipo;
    mesh.userData.boxId = piece.parentBoxId ?? null;
    mesh.userData.tampoPostformRadiusMm = TAMPO_POSTFORM_RADIUS_MM;
    mesh.userData.tampoCutoutCount = piece.cutouts?.length ?? 0;
    mesh.userData.tampoUnionOverlapMm = piece.union?.overlapMm ?? null;
    mesh.userData.tampoUnionDirection = piece.union?.direction ?? null;
    mesh.userData.tampoAngleDeg = normalizeTampoAngleConfig(piece.angleConfig, piece.height)?.angleDeg ?? null;
    this.applyWorldTransform(mesh, piece);
    applyRemateGrainOnSnap(mesh, piece.materialPresetId, piece.faceOffsets?.rotationSnapIndex ?? 0, {
      grainLocked: this.isGrainLocked(piece),
    });
  }

  private createMesh(piece: RematePiece, w: number, h: number, d: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      resolveTampoGeometry(piece, w, h, d),
      new THREE.MeshStandardMaterial({ color: "#f2f0eb" })
    );
    applyMaterialToMesh(mesh, piece.materialPresetId);
    mesh.name = piece.id;
    mesh.userData.isRematePiece = true;
    mesh.userData.isTampoPiece = true;
    mesh.userData.remateId = piece.id;
    mesh.userData.boxId = piece.parentBoxId ?? null;
    mesh.userData.remateTipo = piece.tipo;
    mesh.userData.remateFaceKind = piece.tipo;
    mesh.userData.pieceId = piece.id;
    mesh.userData.panelType = "remate";
    mesh.userData.remateOutlineRenderOrder = TAMPO_OUTLINE_RENDER_ORDER;
    mesh.userData.tampoPostformRadiusMm = TAMPO_POSTFORM_RADIUS_MM;
    mesh.userData.tampoCutoutCount = piece.cutouts?.length ?? 0;
    mesh.userData.tampoUnionOverlapMm = piece.union?.overlapMm ?? null;
    mesh.userData.tampoUnionDirection = piece.union?.direction ?? null;
    mesh.userData.tampoAngleDeg = normalizeTampoAngleConfig(piece.angleConfig, piece.height)?.angleDeg ?? null;
    mesh.renderOrder = TAMPO_RENDER_ORDER;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.remateProductType = piece.productType;
    mesh.userData.rematePartIndex = piece.partIndex;
    mesh.userData.remateParentGroupId = piece.parentGroupId ?? null;
    mesh.userData.remateDepthMm = piece.depth;
    return mesh;
  }

  private applyMaterial(mesh: THREE.Mesh, piece: RematePiece): void {
    const prev = mesh.material;
    if (prev instanceof THREE.Material) prev.dispose();
    applyMaterialToMesh(mesh, piece.materialPresetId);
  }

  private isGrainLocked(piece: RematePiece): boolean {
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

  private applyWorldTransform(mesh: THREE.Mesh, piece: RematePiece): void {
    const angular = isTampoAngularConfig(piece.angleConfig, piece.height);
    const pose = angular
      ? getRemateSavedPoseLocal(piece)
      : shouldResolveRematePoseFromBounds(piece)
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

    if (angular) {
      mesh.position.set(
        piece.position.xMm / 1000,
        piece.position.yMm / 1000,
        piece.position.zMm / 1000
      );
      mesh.rotation.set(
        piece.rotation.xRad,
        piece.rotation.yRad,
        piece.rotation.zRad
      );
      return;
    }

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

  private removeStaleMeshes(expectedIds: Set<string>): void {
    for (const [id, mesh] of this.meshById.entries()) {
      if (expectedIds.has(id)) continue;
      this.disposeMesh(mesh);
      this.meshById.delete(id);
    }
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  }
}
