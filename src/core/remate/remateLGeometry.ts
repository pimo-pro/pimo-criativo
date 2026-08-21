import * as THREE from "three";
import type { StructuralBoundsM } from "./rematePlacement";
import type { RemateMountSlot, RematePiece, RematePiecePosition, RematePieceRotation } from "./rematePieceTypes";

/** Largura fixa da chapa de remate L (mm) — faixa visível. */
export const REMATE_L_STRIP_WIDTH_MM = 100;

/** Slot primário único suportado (modelo industrial CIMA). */
export const REMATE_L_PRIMARY_SLOT: RemateMountSlot = "CIMA";

/** Slot da peça int (perpendicular à ext CIMA). */
export const REMATE_L_SECONDARY_SLOT: RemateMountSlot = "DIR";

const ZERO_ROT: RematePieceRotation = { xRad: 0, yRad: 0, zRad: 0 };

/** Rotação da peça int CIMA: faixa de 100 mm deitada em Z (L real visto de lado). */
export const REMATE_L_CIMA_INT_ROTATION: RematePieceRotation = {
  xRad: Math.PI / 2,
  yRad: 0,
  zRad: 0,
};

/** Slots L removidos (DIR/ESQ/FUNDO) — normalizados para CIMA. */
export function isRemovedLRematePrimarySlot(slot: RemateMountSlot): boolean {
  return slot === "DIR" || slot === "ESQ" || slot === "FUNDO";
}

export function isLRemateCompositePrimary(primary: RemateMountSlot): boolean {
  return primary === REMATE_L_PRIMARY_SLOT;
}

export function resolveLRemateRotation(piece: RematePiece): RematePieceRotation {
  if (isLRemateInt(piece)) {
    return REMATE_L_CIMA_INT_ROTATION;
  }
  return ZERO_ROT;
}

/** Lead id do grupo L composite (ext) para seleção, gizmo e UI de rotação. */
export function resolveLRemateCompositeLeadId(
  remateId: string,
  remates: readonly RematePiece[]
): string {
  const piece = remates.find((p) => p.id === remateId);
  if (!piece?.parentGroupId || !isLRematePiece(piece)) return remateId;
  if (piece.partIndex === 1) return remateId;
  const ext = remates.find(
    (p) =>
      p.parentGroupId === piece.parentGroupId &&
      isLRematePiece(p) &&
      p.partIndex === 1
  );
  return ext?.id ?? remateId;
}

/** @deprecated Use resolveLRemateCompositeLeadId */
export const resolveLRemateCimaCompositeLeadId = resolveLRemateCompositeLeadId;

/** Transformações FREE de L composite aplicam-se sempre na peça ext (lead). */
export function resolveLRemateTransformLeadId(
  remateId: string,
  remates: readonly RematePiece[],
  patch?: Partial<Pick<RematePiece, "position" | "rotation" | "placementMode">>
): string {
  if (patch && patch.position == null && patch.rotation == null && patch.placementMode == null) {
    return remateId;
  }
  return resolveLRemateCompositeLeadId(remateId, remates);
}

/** Lead id para applyLRemateGroupCoupling após patch de dimensões/transform. */
export function resolveLRemateGroupCouplingLeadId(
  remateId: string,
  remates: readonly RematePiece[],
  patch?: Partial<
    Pick<RematePiece, "position" | "rotation" | "width" | "height" | "placementMode">
  >
): string {
  const piece = remates.find((p) => p.id === remateId);
  if (!piece || !isLRematePiece(piece) || !piece.parentGroupId) return remateId;

  if (
    isLRemateInt(piece) &&
    (patch?.width != null || patch?.height != null) &&
    patch?.position == null &&
    patch?.rotation == null
  ) {
    const ext = remates.find(
      (p) =>
        p.parentGroupId === piece.parentGroupId &&
        isLRematePiece(p) &&
        p.partIndex === 1
    );
    return ext?.id ?? remateId;
  }

  return resolveLRemateTransformLeadId(remateId, remates, patch);
}

export function isLRematePiece(piece: Pick<RematePiece, "productType" | "tipo">): boolean {
  return piece.productType === "L" || piece.tipo === "L";
}

export function isLRemateExt(piece: Pick<RematePiece, "partIndex" | "productType" | "tipo">): boolean {
  return isLRematePiece(piece) && piece.partIndex !== 2;
}

export function isLRemateInt(piece: Pick<RematePiece, "partIndex" | "productType" | "tipo">): boolean {
  return isLRematePiece(piece) && piece.partIndex === 2;
}

/** Face perpendicular à peça ext onde a peça int encosta (modelo CIMA). */
export function lSecondaryMountSlot(primary: RemateMountSlot): RemateMountSlot {
  return primary === REMATE_L_PRIMARY_SLOT ? REMATE_L_SECONDARY_SLOT : "FRENTE";
}

export function resolveLPrimarySlot(
  piece: Pick<RematePiece, "mountSlot" | "partIndex">
): RemateMountSlot {
  if (piece.partIndex === 2 && piece.mountSlot === REMATE_L_SECONDARY_SLOT) {
    return REMATE_L_PRIMARY_SLOT;
  }
  if (piece.mountSlot === REMATE_L_PRIMARY_SLOT) {
    return REMATE_L_PRIMARY_SLOT;
  }
  if (piece.mountSlot && isRemovedLRematePrimarySlot(piece.mountSlot)) {
    return REMATE_L_PRIMARY_SLOT;
  }
  return REMATE_L_PRIMARY_SLOT;
}

/** Mount slot industrial por peça (ext=CIMA, int=DIR). */
export function coerceLRemateMountSlot(
  piece: Pick<RematePiece, "partIndex">
): RemateMountSlot {
  return piece.partIndex === 2 ? REMATE_L_SECONDARY_SLOT : REMATE_L_PRIMARY_SLOT;
}

/**
 * Dimensões CIMA: largura=comprimento, altura=faixa, profundidade=espessura.
 * `primarySlot` mantido por compatibilidade; ignorado (sempre modelo CIMA).
 */
export function computeLRemateSheetDimensions(params: {
  primarySlot?: RemateMountSlot;
  partIndex: 1 | 2;
  boxAlturaMm: number;
  boxLarguraMm: number;
  thicknessMm: number;
  boxPanelThicknessMm?: number;
}): { width: number; height: number; depth: number } {
  const esp = Math.max(1, params.thicknessMm);
  return {
    width: Math.max(1, params.boxLarguraMm),
    height: REMATE_L_STRIP_WIDTH_MM,
    depth: esp,
  };
}

/** Origem = canto inferior-esquerdo-frontal (minX, minY, maxZ da AABB). */
export function lRemateCornerToCenterMm(
  piece: Pick<RematePiece, "width" | "height" | "depth">,
  corner: RematePiecePosition
): RematePiecePosition {
  return {
    xMm: corner.xMm + piece.width / 2,
    yMm: corner.yMm + piece.height / 2,
    zMm: corner.zMm - piece.depth / 2,
  };
}

function lRemateCornerToCenterCimaFrame(
  piece: RematePiece,
  corner: RematePiecePosition
): RematePiecePosition {
  if (isLRemateInt(piece)) {
    return {
      xMm: corner.xMm + piece.width / 2,
      yMm: corner.yMm + piece.depth / 2,
      zMm: corner.zMm - piece.height / 2,
    };
  }
  return lRemateCornerToCenterMm(piece, corner);
}

function lRemateCenterToCornerCimaFrame(
  piece: RematePiece,
  center: RematePiecePosition
): RematePiecePosition {
  if (isLRemateInt(piece)) {
    return {
      xMm: center.xMm - piece.width / 2,
      yMm: center.yMm - piece.depth / 2,
      zMm: center.zMm + piece.height / 2,
    };
  }
  return lRemateCenterToCornerMm(piece, center);
}

function lRemateCornerToCenterForPiece(piece: RematePiece, corner: RematePiecePosition): RematePiecePosition {
  return lRemateCornerToCenterCimaFrame(piece, corner);
}

function lRemateCenterToCornerForPiece(piece: RematePiece, center: RematePiecePosition): RematePiecePosition {
  return lRemateCenterToCornerCimaFrame(piece, center);
}

export function lRemateCenterToCornerMm(
  piece: Pick<RematePiece, "width" | "height" | "depth">,
  center: RematePiecePosition
): RematePiecePosition {
  return {
    xMm: center.xMm - piece.width / 2,
    yMm: center.yMm - piece.height / 2,
    zMm: center.zMm + piece.depth / 2,
  };
}

/** Posição de canto inicial da peça ext (rem_L_ext) encostada ao topo do módulo. */
export function computeLRemateExtCornerMm(
  _primary: RemateMountSlot,
  extDims: Pick<RematePiece, "width" | "height" | "depth">,
  bounds: StructuralBoundsM
): RematePiecePosition {
  const d = extDims.depth;
  const maxZ = bounds.maxZ * 1000;
  return { xMm: bounds.minX * 1000, yMm: bounds.maxY * 1000, zMm: maxZ - d };
}

/**
 * Offset canto int ← canto ext em mm (frame local da peça ext, CIMA).
 * Encaixe industrial: int recua ext.depth ao longo do -Z local da ext, depois roda com a ext.
 */
export function computeLRemateCimaIntCornerOffsetMm(
  ext: Pick<RematePiece, "depth" | "rotation">
): RematePiecePosition {
  const v = new THREE.Vector3(0, 0, -Math.max(1, ext.depth));
  const rot = ext.rotation ?? ZERO_ROT;
  v.applyEuler(new THREE.Euler(rot.xRad, rot.yRad, rot.zRad));
  return { xMm: v.x, yMm: v.y, zMm: v.z };
}

/** Offset do centro int ← centro ext em mm, no frame local da ext (CIMA, pivô ext). */
export function computeLRemateCimaIntLocalOffsetMm(
  ext: Pick<RematePiece, "height" | "depth">
): RematePiecePosition {
  return {
    xMm: 0,
    yMm: ext.depth / 2 - ext.height / 2,
    zMm: -ext.depth / 2 - ext.height / 2,
  };
}

/** União geométrica CIMA: int encaixada em ext em Z, mesma X/Y. */
export function computeLRemateIntCornerFromExt(
  extCorner: RematePiecePosition,
  extRef: Pick<RematePiece, "width" | "height" | "depth" | "rotation">,
  _primary: RemateMountSlot = REMATE_L_PRIMARY_SLOT
): RematePiecePosition {
  const offset = computeLRemateCimaIntCornerOffsetMm(extRef);
  return {
    xMm: extCorner.xMm + offset.xMm,
    yMm: extCorner.yMm + offset.yMm,
    zMm: extCorner.zMm + offset.zMm,
  };
}

export function computeLRemateIntCornerFromExtPiece(ext: RematePiece): RematePiecePosition {
  return computeLRemateIntCornerFromExt(ext.position, ext, REMATE_L_PRIMARY_SLOT);
}

export function computeLRemateExtCornerFromInt(
  intCorner: RematePiecePosition,
  extRef: Pick<RematePiece, "width" | "height" | "depth" | "rotation">,
  _primary: RemateMountSlot = REMATE_L_PRIMARY_SLOT
): RematePiecePosition {
  const offset = computeLRemateCimaIntCornerOffsetMm(extRef);
  return {
    xMm: intCorner.xMm - offset.xMm,
    yMm: intCorner.yMm - offset.yMm,
    zMm: intCorner.zMm - offset.zMm,
  };
}

/** Slots L obsoletos que exigem migração para CIMA (não inclui dimensões customizadas). */
export function isLegacyLRemateMountForMigration(
  ext: Pick<RematePiece, "mountSlot">
): boolean {
  const slot = ext.mountSlot ?? "CIMA";
  return isRemovedLRematePrimarySlot(slot) || slot === "FRENTE";
}

/** Normaliza peças L legadas (DIR/ESQ/FUNDO) para o modelo CIMA. */
export function normalizeLRemateGroupToCima(
  ext: RematePiece,
  int: RematePiece,
  ctx: { boxLarguraMm: number; boxAlturaMm: number; thicknessMm: number }
): { ext: RematePiece; int: RematePiece } {
  if (!isLegacyLRemateMountForMigration(ext)) {
    return { ext, int };
  }
  const dims = computeLRemateSheetDimensions({
    partIndex: 1,
    boxAlturaMm: ctx.boxAlturaMm,
    boxLarguraMm: ctx.boxLarguraMm,
    thicknessMm: ctx.thicknessMm,
  });
  return {
    ext: {
      ...ext,
      mountSlot: REMATE_L_PRIMARY_SLOT,
      ...(ext.userDimensionsLocked
        ? {}
        : { width: dims.width, height: dims.height, depth: dims.depth }),
    },
    int: {
      ...int,
      mountSlot: REMATE_L_SECONDARY_SLOT,
      ...(int.userDimensionsLocked
        ? {}
        : { width: dims.width, height: dims.height, depth: dims.depth }),
    },
  };
}

/** Pose de render: centro 3D + rotação (ext FREE usa estado; CIMA int Rx90° industrial). */
export function resolveLRemateRenderPose(
  piece: RematePiece,
  _bounds?: StructuralBoundsM
): { position: RematePiecePosition; rotation: RematePieceRotation } {
  const rotation =
    isLRemateInt(piece) || piece.placementMode !== "FREE"
      ? resolveLRemateRotation(piece)
      : (piece.rotation ?? ZERO_ROT);
  return {
    position: lRemateCornerToCenterForPiece(piece, piece.position),
    rotation,
  };
}

/** Snap inicial das duas peças L com cantos encadeados (modelo CIMA). */
export function snapLRemateGroupCorners(
  ext: RematePiece,
  int: RematePiece,
  bounds: StructuralBoundsM,
  ctx?: { boxLarguraMm: number; boxAlturaMm: number; thicknessMm: number }
): { ext: RematePiece; int: RematePiece } {
  let nextExt = ext;
  let nextInt = int;
  if (ctx) {
    const normalized = normalizeLRemateGroupToCima(ext, int, ctx);
    nextExt = normalized.ext;
    nextInt = normalized.int;
  }

  const primary = REMATE_L_PRIMARY_SLOT;
  const extRotation = resolveLRemateRotation(nextExt);
  const intRotation = resolveLRemateRotation(nextInt);
  const extCorner = computeLRemateExtCornerMm(primary, nextExt, bounds);
  const intCorner = computeLRemateIntCornerFromExt(extCorner, nextExt, primary);

  return {
    ext: {
      ...nextExt,
      mountSlot: REMATE_L_PRIMARY_SLOT,
      placementMode: "SNAPPED",
      faceOffsets: undefined,
      position: extCorner,
      rotation: extRotation,
    },
    int: {
      ...nextInt,
      mountSlot: REMATE_L_SECONDARY_SLOT,
      placementMode: "SNAPPED",
      faceOffsets: undefined,
      position: intCorner,
      rotation: intRotation,
    },
  };
}

/** Ao mover/redimensionar uma peça L, mantém união perfeita no grupo. */
export function applyLRemateGroupCoupling(remates: RematePiece[], movedId: string): RematePiece[] {
  const moved = remates.find((r) => r.id === movedId);
  if (!moved || !isLRematePiece(moved) || !moved.parentGroupId) return remates;

  const group = remates.filter((r) => r.parentGroupId === moved.parentGroupId && isLRematePiece(r));
  const ext = group.find((r) => r.partIndex === 1);
  const int = group.find((r) => r.partIndex === 2);
  if (!ext || !int) return remates;

  if (moved.partIndex === 1) {
    const intCorner = computeLRemateIntCornerFromExtPiece(ext);
    return remates.map((r) =>
      r.id === int.id
        ? {
            ...r,
            position: intCorner,
            rotation: resolveLRemateRotation(r),
            placementMode: moved.placementMode,
          }
        : r
    );
  }

  const extCorner = computeLRemateExtCornerFromInt(int.position, ext, REMATE_L_PRIMARY_SLOT);
  return remates.map((r) =>
    r.id === ext.id
      ? {
          ...r,
          position: extCorner,
          placementMode: moved.placementMode,
        }
      : r
  );
}

/** Converte patch vindo do viewer (centro) para canto CIMA. */
export function normalizeLRemateTransformPatch<T extends Partial<Pick<RematePiece, "position" | "rotation" | "faceOffsets" | "placementMode">>>(
  piece: RematePiece,
  patch: T,
  _bounds?: StructuralBoundsM
): T {
  if (!isLRematePiece(piece)) return patch;
  const next: T = {
    ...patch,
    faceOffsets: undefined,
    placementMode: patch.placementMode ?? piece.placementMode ?? "FREE",
  } as T;
  if (patch.rotation != null) {
    next.rotation = isLRemateExt(piece) ? patch.rotation : resolveLRemateRotation(piece);
  }
  if (patch.position) {
    next.position = lRemateCenterToCornerForPiece(piece, patch.position);
  }
  return next;
}

/** @deprecated Preferir resolveLRemateRenderPose / computeLRemateExtCornerMm */
export function computeLRemateCenterM(
  piece: Pick<RematePiece, "width" | "height" | "depth" | "mountSlot" | "partIndex" | "position">,
  bounds: StructuralBoundsM
): { x: number; y: number; z: number } {
  const full = piece as RematePiece;
  const pose = resolveLRemateRenderPose(full, bounds);
  return {
    x: pose.position.xMm / 1000,
    y: pose.position.yMm / 1000,
    z: pose.position.zMm / 1000,
  };
}

export function remateLIndustrialName(partIndex: 1 | 2, boxCode?: string): string {
  const suffix = partIndex === 1 ? "REMATE_L_ext" : "REMATE_L_int";
  const code = boxCode?.trim();
  return code ? `${code}_${suffix}` : suffix;
}

export function remateLIndustrialSuffix(partIndex: 1 | 2 | undefined): "L_ext" | "L_int" {
  return partIndex === 2 ? "L_int" : "L_ext";
}

/** Observação industrial obrigatória para Remate L (ext e int). */
export const REMATE_L_INDUSTRIAL_OBSERVACAO = "ME manual";

export function isRemateLIndustrialMetadata(metadata?: Record<string, unknown>): boolean {
  if (!metadata) return false;
  if (metadata.productType === "L") return true;
  const kind = metadata.remateKind;
  return kind === "L_ext" || kind === "L_int";
}

export function isRemateLIndustrialPiece(
  piece: Pick<RematePiece, "productType" | "tipo">
): boolean {
  return piece.productType === "L" || piece.tipo === "L";
}
