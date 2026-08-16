import type { StructuralBoundsM } from "./rematePlacement";
import {
  computeLRemateExtCornerMm,
  isLRematePiece,
  lSecondaryMountSlot,
  resolveLPrimarySlot,
  resolveLRemateRenderPose,
  resolveLRemateRotation,
} from "./remateLGeometry";
import type {
  RemateFaceOffsets,
  RemateMountSlot,
  RematePiece,
  RematePiecePosition,
  RematePieceRotation,
} from "./rematePieceTypes";
import {
  getRemateSavedPoseLocal,
  shouldResolveRematePoseFromBounds,
} from "./remateTransformStability";

export type MountFrameM = {
  originM: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  tangentU: { x: number; y: number; z: number };
  tangentV: { x: number; y: number; z: number };
};

type Vec3 = { x: number; y: number; z: number };

const ZERO_ROT: RematePieceRotation = { xRad: 0, yRad: 0, zRad: 0 };

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/** Mapeia tipo legado → slot de montagem. Nunca usa centro como fallback de profundidade. */
export function resolveMountSlot(piece: RematePiece): RemateMountSlot {
  if (piece.mountSlot) return piece.mountSlot;
  if (piece.tipo === "FRENTE") return "FRENTE";
  switch (piece.tipo) {
    case "DIR":
      return "DIR";
    case "ESQ":
      return "ESQ";
    case "CIMA":
      return "CIMA";
    case "BAIXO":
      return "FUNDO";
    case "RODAPE":
    case "RODAPE_L":
      return "FUNDO";
    case "L":
      return piece.partIndex === 2 ? "DIR" : "CIMA";
    case "TAMPO":
      return "CIMA";
    default:
      return "FRENTE";
  }
}

/** Frame local do box (m): origem na face, normal para fora, tangentes U/V. */
export function computeMountFrameM(bounds: StructuralBoundsM, slot: RemateMountSlot): MountFrameM {
  const { centerX: cx, centerY: cy, maxX, minX, maxY, minY, maxZ, minZ } = bounds;

  switch (slot) {
    case "FRENTE":
      return { originM: vec(cx, cy, maxZ), normal: vec(0, 0, 1), tangentU: vec(1, 0, 0), tangentV: vec(0, 1, 0) };
    case "TRAS":
      return { originM: vec(cx, cy, minZ), normal: vec(0, 0, -1), tangentU: vec(1, 0, 0), tangentV: vec(0, 1, 0) };
    case "DIR":
      return { originM: vec(maxX, cy, maxZ), normal: vec(1, 0, 0), tangentU: vec(0, 0, -1), tangentV: vec(0, 1, 0) };
    case "ESQ":
      return { originM: vec(minX, cy, maxZ), normal: vec(-1, 0, 0), tangentU: vec(0, 0, -1), tangentV: vec(0, 1, 0) };
    case "CIMA":
      return { originM: vec(cx, maxY, maxZ), normal: vec(0, 1, 0), tangentU: vec(1, 0, 0), tangentV: vec(0, 0, -1) };
    case "FUNDO":
      return { originM: vec(cx, minY, maxZ), normal: vec(0, -1, 0), tangentU: vec(1, 0, 0), tangentV: vec(0, 0, -1) };
  }
}

function centerFromOffsetsM(frame: MountFrameM, offsets: RemateFaceOffsets): Vec3 {
  const n = offsets.offsetAlongNormalMm / 1000;
  const u = offsets.offsetTangentUMm / 1000;
  const v = offsets.offsetTangentVMm / 1000;
  return add(
    add(add(frame.originM, scale(frame.normal, n)), scale(frame.tangentU, u)),
    scale(frame.tangentV, v)
  );
}

export function poseFromFaceOffsetsM(
  frame: MountFrameM,
  offsets: RemateFaceOffsets,
  rotation: RematePieceRotation = ZERO_ROT
): { position: RematePiecePosition; rotation: RematePieceRotation } {
  const c = centerFromOffsetsM(frame, offsets);
  return {
    position: { xMm: c.x * 1000, yMm: c.y * 1000, zMm: c.z * 1000 },
    rotation,
  };
}

export function faceOffsetsFromPositionM(
  frame: MountFrameM,
  position: RematePiecePosition,
  preserveRotationSnapIndex?: 0 | 1 | 2 | 3
): RemateFaceOffsets {
  const p = vec(position.xMm / 1000, position.yMm / 1000, position.zMm / 1000);
  const rel = {
    x: p.x - frame.originM.x,
    y: p.y - frame.originM.y,
    z: p.z - frame.originM.z,
  };
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  return {
    offsetAlongNormalMm: dot(rel, frame.normal) * 1000,
    offsetTangentUMm: dot(rel, frame.tangentU) * 1000,
    offsetTangentVMm: dot(rel, frame.tangentV) * 1000,
    rotationSnapIndex: preserveRotationSnapIndex ?? 0,
  };
}

/** Offsets padrão SNAPPED por tipo — profundidade sempre alinhada à frente (maxZ), nunca centerZ. */
export function defaultFaceOffsetsForPiece(piece: RematePiece, bounds: StructuralBoundsM): RemateFaceOffsets {
  const w = piece.width / 1000;
  const h = piece.height / 1000;
  const d = piece.depth / 1000;
  const slot = resolveMountSlot(piece);

  if (piece.tipo === "RODAPE") {
    const frame = computeMountFrameM(bounds, "FUNDO");
    const pos = vec(bounds.centerX, bounds.minY - h / 2 - 0.002, bounds.maxZ + d / 2);
    return faceOffsetsFromPositionM(frame, {
      xMm: pos.x * 1000,
      yMm: pos.y * 1000,
      zMm: pos.z * 1000,
    });
  }

  if (piece.tipo === "L" || piece.productType === "L") {
    const primary = resolveLPrimarySlot(piece);
    const corner = computeLRemateExtCornerMm(primary, piece, bounds);
    if (piece.partIndex === 2) {
      return {
        offsetAlongNormalMm: 0,
        offsetTangentUMm: 0,
        offsetTangentVMm: 0,
        rotationSnapIndex: 0,
      };
    }
    void corner;
    return {
      offsetAlongNormalMm: 0,
      offsetTangentUMm: 0,
      offsetTangentVMm: 0,
      rotationSnapIndex: 0,
    };
  }

  if (piece.tipo === "RODAPE_L") {
    const frame = computeMountFrameM(bounds, "FUNDO");
    if (piece.partIndex === 2) {
      const pos = vec(bounds.maxX - w / 2, bounds.minY - h / 2, bounds.maxZ + d / 2);
      return faceOffsetsFromPositionM(frame, { xMm: pos.x * 1000, yMm: pos.y * 1000, zMm: pos.z * 1000 });
    }
    const pos = vec(bounds.minX + w / 2, bounds.minY - h / 2, bounds.maxZ - d / 2);
    return faceOffsetsFromPositionM(frame, { xMm: pos.x * 1000, yMm: pos.y * 1000, zMm: pos.z * 1000 });
  }

  if (piece.productType === "AVISTA" && piece.productOptions?.avistaFlushToDoor) {
    const flushD = (piece.productOptions.avistaFlushDepthMm ?? 20) / 1000;
    if (slot === "FRENTE" || slot === "TRAS") {
      return {
        offsetAlongNormalMm: (flushD / 2) * 1000,
        offsetTangentUMm: 0,
        offsetTangentVMm: 0,
        rotationSnapIndex: 0,
      };
    }
  }

  switch (slot) {
    case "DIR":
    case "ESQ":
      return {
        offsetAlongNormalMm: (d / 2) * 1000,
        offsetTangentUMm: (h / 2) * 1000,
        offsetTangentVMm: 0,
        rotationSnapIndex: 0,
      };
    case "CIMA":
    case "FUNDO":
      return {
        offsetAlongNormalMm: (h / 2) * 1000,
        offsetTangentUMm: 0,
        offsetTangentVMm: (d / 2) * 1000,
        rotationSnapIndex: 0,
      };
    case "FRENTE":
    case "TRAS":
      return {
        offsetAlongNormalMm: (d / 2) * 1000,
        offsetTangentUMm: 0,
        offsetTangentVMm: 0,
        rotationSnapIndex: 0,
      };
  }
}

/** Regra de montagem — só na criação ou comando explícito (não no sync visual). */
export function snapToMountRule(piece: RematePiece, bounds: StructuralBoundsM): RematePiece {
  if (isLRematePiece(piece)) {
    const primary = resolveLPrimarySlot(piece);
    if (piece.partIndex === 2) {
      return {
        ...piece,
        mountSlot: lSecondaryMountSlot(primary),
        placementMode: "SNAPPED",
        faceOffsets: undefined,
        rotation: resolveLRemateRotation(piece),
      };
    }
    const extCorner = computeLRemateExtCornerMm(primary, piece, bounds);
    return {
      ...piece,
      mountSlot: primary,
      placementMode: "SNAPPED",
      faceOffsets: undefined,
      position: extCorner,
      rotation: resolveLRemateRotation(piece),
    };
  }

  const mountSlot = resolveMountSlot(piece);
  const frame = computeMountFrameM(bounds, mountSlot);
  const faceOffsets = defaultFaceOffsetsForPiece(piece, bounds);
  const pose = poseFromFaceOffsetsM(frame, faceOffsets, piece.rotation);
  return {
    ...piece,
    mountSlot,
    placementMode: "SNAPPED",
    faceOffsets,
    position: pose.position,
    rotation: pose.rotation,
  };
}

/** Pose para render/sync: offsets + frame atual (followBoxTransform). Só na criação inicial. */
export function resolveRematePoseLocal(
  piece: RematePiece,
  bounds: StructuralBoundsM
): { position: RematePiecePosition; rotation: RematePieceRotation } {
  if (!shouldResolveRematePoseFromBounds(piece)) {
    return getRemateSavedPoseLocal(piece);
  }

  if (isLRematePiece(piece)) {
    if (piece.placementMode === "SNAPPED" && piece.partIndex === 1) {
      const primary = resolveLPrimarySlot(piece);
      const corner = computeLRemateExtCornerMm(primary, piece, bounds);
      return resolveLRemateRenderPose({ ...piece, position: corner }, bounds);
    }
    return resolveLRemateRenderPose(piece, bounds);
  }

  const slot = resolveMountSlot(piece);
  const frame = computeMountFrameM(bounds, slot);

  if (piece.placementMode === "FREE") {
    return { position: piece.position, rotation: piece.rotation };
  }

  if (piece.faceOffsets) {
    return poseFromFaceOffsetsM(frame, piece.faceOffsets, piece.rotation);
  }

  return poseFromFaceOffsetsM(frame, defaultFaceOffsetsForPiece(piece, bounds), piece.rotation);
}

/** Offsets corrompidos pelo bug mm×1000 (peça a km de distância). */
export function isCorruptedMountOffsetSnap(piece: RematePiece): boolean {
  if (!piece.faceOffsets) return false;
  const { offsetAlongNormalMm, offsetTangentUMm, offsetTangentVMm } = piece.faceOffsets;
  const maxAbs = Math.max(
    Math.abs(offsetAlongNormalMm),
    Math.abs(offsetTangentUMm),
    Math.abs(offsetTangentVMm),
  );
  return maxAbs > 2000;
}

/** Detecta remates V2 contaminados com Z≈0 (snap antigo com centerZ). */
export function isLegacyCenterZSnap(piece: RematePiece): boolean {
  if (piece.placementMode === "FREE") return false;
  if (piece.faceOffsets) return false;
  if (piece.tipo === "RODAPE" || piece.tipo === "L" || piece.tipo === "RODAPE_L") return false;
  return Math.abs(piece.position.zMm) < 80;
}
