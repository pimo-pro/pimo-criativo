import * as THREE from "three";
import type { UpdateRematePieceInput } from "../../core/remate/rematePieceTypes";
import { isLRematePiece } from "../../core/remate/remateLGeometry";
import { isTampoAngularConfig } from "../../core/remate/tampoAngle";
import type { UpdateRodapeInput } from "../../core/rodape/rodapeTypes";
import {
  divisorLocalXToPositionMm,
  separadorLocalYToPositionMm,
} from "../../core/divSep/dragCoords";
import type { DivisorItem, SeparadorItem } from "../../core/divSep/types";
import type { DivSepVisualBridge } from "./divSep/DivSepVisualBridge";
import type { HematiVisualizer } from "./hemati/HematiVisualizer";
import type { RematePieceVisualBridge } from "./remate/RematePieceVisualizer";
import {
  listRemateIdsInSameLComposite,
  resolveRemateTransformRoot,
} from "./remate/remateLCompositeVisual";
import type { RodapeVisualBridge, RodapeVisualizer } from "./rodape/RodapeVisualizer";
import type { ViewerState } from "./state/ViewerState";
import type { ViewerBoxEntry } from "./types";
import { applyFinishMovementConstraints } from "./constraints/finishCollision";

export type ViewerCoreFinishTransformOpsDeps = {
  viewerState: ViewerState;
  boxes: Map<string, ViewerBoxEntry>;
  getRemateMesh: (remateId: string) => THREE.Object3D | null;
  getDivSepMesh: (
    selection: NonNullable<ReturnType<ViewerState["getSelectedDivSep"]>>
  ) => THREE.Object3D | null;
  getRemateVisualBridge: () => RematePieceVisualBridge | null;
  getRodapeVisualBridge: () => RodapeVisualBridge | null;
  getDivSepVisualBridge: () => DivSepVisualBridge | null;
  hematiVisualizer: HematiVisualizer;
  rodapeVisualizer: RodapeVisualizer;
  onRemateTransform: ((remateId: string, patch: UpdateRematePieceInput) => void) | null;
  onHematiTransform: ((
    hematiId: string,
    patch: {
      transform: {
        xMm: number;
        yMm: number;
        zMm: number;
        rotacaoXRad: number;
        rotacaoYRad: number;
        rotacaoZRad: number;
      };
      placementFree: boolean;
    }
  ) => void) | null;
  onRodapeTransform: ((rodapeId: string, patch: UpdateRodapeInput) => void) | null;
  onDivSepTransform: ((params: {
    boxId: string;
    kind: "div" | "sep";
    itemId: string;
    positionMm: number;
  }) => void) | null;
  lockEnabled: boolean;
  roomBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    centerX: number;
    centerZ: number;
  } | null;
  roomBoxWalls: Array<{ id: number; normal: THREE.Vector3; mesh: THREE.Mesh }>;
  applyFloorConstraint: (mesh: THREE.Object3D) => void;
  isMeshInsideOrTouchingRoom: (mesh: THREE.Object3D) => boolean;
};

export function notifyRemateTransformImpl(deps: ViewerCoreFinishTransformOpsDeps): void {
  const remateId = deps.viewerState.getSelectedRemate();
  if (!remateId) return;
  const rawMesh = deps.getRemateMesh(remateId);
  const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
  if (!mesh) return;
  const p = mesh.position;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    console.warn("[sanity] posição inválida em notifyRemateTransform — ignorado");
    return;
  }
  const boxId = mesh.userData.boxId as string | undefined;
  const entry = boxId ? deps.boxes.get(boxId) : undefined;

  const tool = deps.viewerState.getCurrentTool();
  if (tool === "scale") {
    if (!(mesh instanceof THREE.Mesh)) return;
    mesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    mesh.geometry.boundingBox?.getSize(size);
    const widthMm = Math.max(1, size.x * mesh.scale.x * 1000);
    const heightMm = Math.max(1, size.y * mesh.scale.y * 1000);
    const depthMm = Math.max(1, size.z * mesh.scale.z * 1000);
    mesh.scale.set(1, 1, 1);
    deps.onRemateTransform?.(remateId, {
      width: widthMm,
      height: heightMm,
      depth: depthMm,
      placementMode: "FREE",
      isInitialPlacement: false,
    });
    return;
  }

  const buildRemateTransformPatch = (
    position: { xMm: number; yMm: number; zMm: number },
    rotation: { xRad: number; yRad: number; zRad: number }
  ) => ({
    position,
    rotation,
    transform: {
      xMm: position.xMm,
      yMm: position.yMm,
      zMm: position.zMm,
      rotacaoXRad: rotation.xRad,
      rotacaoYRad: rotation.yRad,
      rotacaoZRad: rotation.zRad,
    },
    placementMode: "FREE" as const,
    isInitialPlacement: false,
  });

  if (entry?.mesh && boxId) {
    entry.mesh.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(entry.mesh.matrixWorld).invert();
    const local = mesh.position.clone().applyMatrix4(inv);
    const localQuat = new THREE.Quaternion().copy(mesh.quaternion);
    const boxQuat = new THREE.Quaternion().setFromRotationMatrix(entry.mesh.matrixWorld);
    const invBoxQuat = boxQuat.clone().invert();
    localQuat.premultiply(invBoxQuat);
    const euler = new THREE.Euler().setFromQuaternion(localQuat);

    const position = {
      xMm: local.x * 1000,
      yMm: local.y * 1000,
      zMm: local.z * 1000,
    };
    const rotation = { xRad: euler.x, yRad: euler.y, zRad: euler.z };

    const piece = deps.getRemateVisualBridge()?.listRematePieces().find((r) => r.id === remateId);
    if (piece && isLRematePiece(piece)) {
      deps.onRemateTransform?.(remateId, buildRemateTransformPatch(position, rotation));
      return;
    }

    deps.onRemateTransform?.(remateId, buildRemateTransformPatch(position, rotation));
    return;
  }

  const position = {
    xMm: mesh.position.x * 1000,
    yMm: mesh.position.y * 1000,
    zMm: mesh.position.z * 1000,
  };
  const rotation = {
    xRad: mesh.rotation.x,
    yRad: mesh.rotation.y,
    zRad: mesh.rotation.z,
  };
  deps.onRemateTransform?.(remateId, buildRemateTransformPatch(position, rotation));
}

export function notifyHematiTransformImpl(deps: ViewerCoreFinishTransformOpsDeps): void {
  const hematiId = deps.viewerState.getSelectedHemati();
  if (!hematiId) return;
  const mesh = deps.hematiVisualizer.getMeshByHematiId(hematiId);
  if (!mesh) return;
  const boxId = mesh.userData.boxId as string | undefined;
  if (!boxId) return;
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  entry.mesh.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(entry.mesh.matrixWorld).invert();
  const local = mesh.position.clone().applyMatrix4(inv);
  deps.onHematiTransform?.(hematiId, {
    transform: {
      xMm: local.x * 1000,
      yMm: local.y * 1000,
      zMm: local.z * 1000,
      rotacaoXRad: mesh.rotation.x,
      rotacaoYRad: mesh.rotation.y,
      rotacaoZRad: mesh.rotation.z,
    },
    placementFree: true,
  });
}

export function notifyRodapeTransformImpl(deps: ViewerCoreFinishTransformOpsDeps): void {
  const rodapeId = deps.viewerState.getSelectedRodape();
  if (!rodapeId) return;
  const mesh = deps.rodapeVisualizer.getMeshByRodapeId(rodapeId);
  if (!mesh) return;
  const boxId = mesh.userData.boxId as string | undefined;
  if (!boxId) return;
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  entry.mesh.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(entry.mesh.matrixWorld).invert();
  const local = mesh.position.clone().applyMatrix4(inv);
  deps.onRodapeTransform?.(rodapeId, {
    transform: {
      xMm: local.x * 1000,
      yMm: local.y * 1000,
      zMm: local.z * 1000,
      rotacaoXRad: mesh.rotation.x,
      rotacaoYRad: mesh.rotation.y,
      rotacaoZRad: mesh.rotation.z,
    },
    placementFree: true,
    isInitialPlacement: false,
  });
}

export function notifyDivSepTransformImpl(deps: ViewerCoreFinishTransformOpsDeps): void {
  const selection = deps.viewerState.getSelectedDivSep();
  if (!selection) return;
  const mesh = deps.getDivSepMesh(selection);
  const entry = deps.boxes.get(selection.boxId);
  const ctx = deps.getDivSepVisualBridge()?.getDivSepDragContext(
    selection.boxId,
    selection.kind,
    selection.itemId
  );
  if (!mesh || !entry || !ctx) return;

  const positionMm =
    selection.kind === "sep"
      ? separadorLocalYToPositionMm(
          mesh.position.y,
          entry.height,
          ctx.box,
          ctx.item as SeparadorItem
        )
      : divisorLocalXToPositionMm(
          mesh.position.x,
          entry.width,
          ctx.box,
          ctx.item as DivisorItem
        );

  deps.onDivSepTransform?.({
    boxId: selection.boxId,
    kind: selection.kind,
    itemId: selection.itemId,
    positionMm,
  });
}

/**
 * Após sync visual (painel/teclado), reaplica colisão e propaga posição corrigida ao estado.
 */
export function resolveFinishCollisionAfterSyncImpl(
  deps: ViewerCoreFinishTransformOpsDeps,
  params: { remateId?: string; rodapeId?: string }
): void {
  const { remateId, rodapeId } = params;
  if (remateId) {
    const rawMesh = deps.getRemateMesh(remateId);
    const mesh = resolveRemateTransformRoot(rawMesh) ?? rawMesh;
    if (!mesh) return;
    const piece = deps.getRemateVisualBridge()?.listRematePieces().find((r) => r.id === remateId);
    if (isTampoAngularConfig(piece?.angleConfig, piece?.height)) return;
    const boxId = piece?.parentBoxId ?? (mesh.userData.boxId as string | undefined);
    applyFinishCollisionConstraintImpl(deps, mesh, boxId, remateId);
    const prev = deps.viewerState.getSelectedRemate();
    if (prev !== remateId) deps.viewerState.setSelectedRemate(remateId);
    notifyRemateTransformImpl(deps);
    if (prev !== remateId) deps.viewerState.setSelectedRemate(prev);
    return;
  }
  if (rodapeId) {
    const mesh = deps.rodapeVisualizer.getMeshByRodapeId(rodapeId);
    if (!mesh) return;
    const boxId = mesh.userData.boxId as string | undefined;
    applyFinishCollisionConstraintImpl(deps, mesh, boxId, undefined, rodapeId);
    const prev = deps.viewerState.getSelectedRodape();
    if (prev !== rodapeId) deps.viewerState.setSelectedRodape(rodapeId);
    notifyRodapeTransformImpl(deps);
    if (prev !== rodapeId) deps.viewerState.setSelectedRodape(prev);
  }
}

export function applyFinishCollisionConstraintImpl(
  deps: ViewerCoreFinishTransformOpsDeps,
  movingMesh: THREE.Object3D,
  excludeBoxId: string | undefined,
  excludeRemateId?: string,
  excludeRodapeId?: string
): void {
  if (!deps.lockEnabled) return;
  if (excludeRemateId) {
    const piece = deps
      .getRemateVisualBridge()
      ?.listRematePieces()
      .find((r) => r.id === excludeRemateId);
    if (isTampoAngularConfig(piece?.angleConfig, piece?.height)) return;
  }

  const excludeRemateIds = new Set<string>();
  if (excludeRemateId) {
    for (const id of listRemateIdsInSameLComposite(
      excludeRemateId,
      deps.getRemateVisualBridge()?.listRematePieces() ?? []
    )) {
      excludeRemateIds.add(id);
    }
  }

  const otherMeshes: THREE.Object3D[] = [];
  const seenMeshUuids = new Set<string>();
  for (const piece of deps.getRemateVisualBridge()?.listRematePieces() ?? []) {
    if (excludeRemateIds.has(piece.id)) continue;
    const mesh = deps.getRemateMesh(piece.id);
    if (!mesh || mesh === movingMesh || seenMeshUuids.has(mesh.uuid)) continue;
    seenMeshUuids.add(mesh.uuid);
    otherMeshes.push(mesh);
  }
  for (const cfg of deps.getRodapeVisualBridge()?.listBoxRodapeConfigs() ?? []) {
    for (const rodape of cfg.rodapes) {
      if (rodape.id === excludeRodapeId) continue;
      const mesh = deps.rodapeVisualizer.getMeshByRodapeId(rodape.id);
      if (mesh) otherMeshes.push(mesh);
    }
  }

  const parentBoxEntry =
    excludeBoxId && deps.boxes.has(excludeBoxId)
      ? (() => {
          const entry = deps.boxes.get(excludeBoxId)!;
          return {
            boxId: excludeBoxId,
            mesh: entry.mesh,
            width: entry.width,
            height: entry.height,
            depth: entry.depth,
          };
        })()
      : undefined;

  applyFinishMovementConstraints({
    movingMesh,
    boxes: deps.boxes,
    otherMeshes,
    parentBox: parentBoxEntry,
    applyFloorConstraint: (mesh) => deps.applyFloorConstraint(mesh),
    roomBounds: deps.roomBounds,
    roomWallMeshes: deps.roomBoxWalls.map((w) => w.mesh),
    isInsideRoom: (mesh) => deps.isMeshInsideOrTouchingRoom(mesh),
  });
}
