import type { WorkspaceBox } from "../types";
import type {
  CreateRematePieceInput,
  RemateMountSlot,
  RematePartRole,
  RematePiece,
  RemateProductType,
} from "./rematePieceTypes";
import {
  buildProductPieceSpecs,
  computeDimensionsForProduct,
  normalizeProductOptions,
} from "./remateProductRules";
import { getRemateEnvelopeBoundsM } from "./rematePlacement";
import { snapToMountRule } from "./remateMountFrame";
import { snapLRemateGroupCorners } from "./remateLGeometry";
import { markRematePlacementSettled } from "./remateTransformStability";
import { remateLIndustrialName } from "./remateLGeometry";
import {
  applyTampoIndustrialDefaults,
  shouldApplyTampoRules,
  TAMPO_MATERIAL_ID,
  TAMPO_THICKNESS_MM,
} from "./tampoCozinhaRules";
import { normalizeTampoAngleConfig } from "./tampoAngle";

// Viewer Fase 2: tipo TAMPO / productType TAMPO_COZINHA → TampoPieceVisualizer (postforming).
// Sem import Three.js neste factory industrial.

let remateSeq = 0;

export function createRemateId(prefix = "remate"): string {
  remateSeq += 1;
  return `${prefix}-${Date.now()}-${remateSeq}`;
}

function nextRemateId(prefix = "remate"): string {
  return createRemateId(prefix);
}

function buildRematePieceName(
  box: WorkspaceBox | null,
  productType: RemateProductType,
  mountSlot: RemateMountSlot,
  partRole?: RematePartRole,
  partIndex?: 1 | 2
): string {
  if (productType === "L" && partIndex) {
    const code = (box?.nome || box?.id || "").trim().replace(/\s+/g, "_").toUpperCase();
    return remateLIndustrialName(partIndex, code || undefined);
  }
  return buildLegacyRemateName(box, productType, mountSlot, partRole, partIndex);
}

function buildLegacyRemateName(
  box: WorkspaceBox | null,
  productType: RemateProductType,
  mountSlot: RemateMountSlot,
  partRole?: RematePartRole,
  partIndex?: 1 | 2
): string {
  const code = (box?.nome || box?.id || "STANDALONE").trim().replace(/\s+/g, "_").toUpperCase();
  const suffix = partIndex
    ? `${productType}${partIndex}`
    : `${productType}_${mountSlot}${partRole && partRole !== "MAIN" ? `_${partRole}` : ""}`;
  return `${code}_${suffix}`;
}

function defaultStandalonePosition(
  allBoxes: readonly WorkspaceBox[],
  piece: RematePiece
): RematePiece["position"] {
  const count = allBoxes.length;
  return {
    xMm: 800 + count * 120,
    yMm: piece.height / 2,
    zMm: 600,
  };
}

function applyMountSnapIfNeeded(
  piece: RematePiece,
  box: WorkspaceBox,
  boxDimsM: { widthM: number; heightM: number; depthM: number }
): RematePiece {
  if (!piece.followBox && piece.placementMode === "FREE") return piece;
  const bounds = getRemateEnvelopeBoundsM(
    boxDimsM.widthM,
    boxDimsM.heightM,
    boxDimsM.depthM,
    box
  );
  return markRematePlacementSettled(snapToMountRule(piece, bounds));
}

export function refreshRemateMountSnap(
  piece: RematePiece,
  box: WorkspaceBox,
  boxDimsM: { widthM: number; heightM: number; depthM: number }
): RematePiece {
  const bounds = getRemateEnvelopeBoundsM(
    boxDimsM.widthM,
    boxDimsM.heightM,
    boxDimsM.depthM,
    box
  );
  return markRematePlacementSettled(
    snapToMountRule({ ...piece, placementMode: "SNAPPED" }, bounds)
  );
}

export function createRematePieces(
  input: CreateRematePieceInput,
  ctx: {
    box?: WorkspaceBox | null;
    allBoxes?: readonly WorkspaceBox[];
    materialPresetId: string;
    thicknessMm: number;
    boxDimsM?: { widthM: number; heightM: number; depthM: number };
  }
): RematePiece[] {
  const specs = buildProductPieceSpecs(input);
  const groupId = specs.length > 1 ? nextRemateId("remate-group") : undefined;

  const created = specs.map((spec) => {
    const productType = spec.productType;
    const mountSlot = spec.mountSlot;
    const opts = normalizeProductOptions(productType, spec.productOptions);
    let materialPresetId = input.materialPresetId ?? ctx.materialPresetId;
    let thicknessMm = ctx.thicknessMm;
    if (shouldApplyTampoRules({ productType, materialPresetId })) {
      materialPresetId = TAMPO_MATERIAL_ID;
      thicknessMm = TAMPO_THICKNESS_MM;
    }
    const dims = computeDimensionsForProduct({
      box: ctx.box ?? null,
      productType: shouldApplyTampoRules({ productType, materialPresetId })
        ? "TAMPO_COZINHA"
        : productType,
      mountSlot,
      thicknessMm,
      productOptions: opts,
      partRole: spec.partRole,
      partIndex: spec.partIndex,
    });

    let piece: RematePiece = {
      id: nextRemateId(),
      parentBoxId: input.parentBoxId,
      productType,
      mountSlot,
      productOptions: opts,
      partRole: spec.partRole,
      tipo: spec.tipo,
      width: input.width ?? dims.width,
      height: input.height ?? dims.height,
      depth: input.depth ?? dims.depth,
      materialPresetId,
      position: input.workspacePosition ?? { xMm: 0, yMm: 0, zMm: 0 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: input.followBox ?? Boolean(input.parentBoxId),
      name: buildRematePieceName(ctx.box ?? null, productType, mountSlot, spec.partRole, spec.partIndex),
      parentGroupId: groupId,
      partIndex: spec.partIndex,
      isInitialPlacement: true,
    };

    if (shouldApplyTampoRules({ productType: piece.productType, materialPresetId: piece.materialPresetId })) {
      piece = applyTampoIndustrialDefaults(piece);
      piece.name = buildRematePieceName(
        ctx.box ?? null,
        "TAMPO_COZINHA",
        piece.mountSlot ?? "CIMA",
        spec.partRole,
        spec.partIndex
      );
      if (input.angleConfig !== undefined) {
        piece.angleConfig = normalizeTampoAngleConfig(input.angleConfig, piece.height);
      }
    }

    if (input.parentBoxId && ctx.box && ctx.boxDimsM) {
      piece = applyMountSnapIfNeeded(piece, ctx.box, ctx.boxDimsM);
    } else if (!input.parentBoxId) {
      piece.position = input.workspacePosition ?? defaultStandalonePosition(ctx.allBoxes ?? [], piece);
      piece.followBox = false;
      piece.placementMode = "FREE";
      piece = markRematePlacementSettled(piece);
    } else {
      piece = markRematePlacementSettled(piece);
    }
    return piece;
  });

  if (input.parentBoxId && ctx.box && ctx.boxDimsM && specs.length === 2 && specs[0]?.productType === "L") {
    const bounds = getRemateEnvelopeBoundsM(
      ctx.boxDimsM.widthM,
      ctx.boxDimsM.heightM,
      ctx.boxDimsM.depthM,
      ctx.box
    );
    const extIdx = created.findIndex((p) => p.partIndex === 1);
    const intIdx = created.findIndex((p) => p.partIndex === 2);
    if (extIdx >= 0 && intIdx >= 0) {
      const snapped = snapLRemateGroupCorners(created[extIdx]!, created[intIdx]!, bounds, {
        boxLarguraMm: ctx.box.dimensoes?.largura ?? 600,
        boxAlturaMm: ctx.box.dimensoes?.altura ?? 720,
        thicknessMm: ctx.thicknessMm,
      });
      created[extIdx] = markRematePlacementSettled(snapped.ext);
      created[intIdx] = markRematePlacementSettled(snapped.int);
    }
  }

  return created;
}
