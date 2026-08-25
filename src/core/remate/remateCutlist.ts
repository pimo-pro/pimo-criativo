import type { BoxModule, CutListItem, CutListItemComPreco } from "../types";
import { getMaterialByIdOrLabel } from "../materials/service";
import { getFallbackMaterial } from "../materials/materialLibraryV2";
import { calcularPrecoCutList } from "../pricing/pricing";
import { resolveIndustrialGrainCode } from "../materials/grainDirection";
import { buildCutlistRotationMetadata } from "../manufacturing/cutlistRotationMetadata";
import type { RematePiece } from "./rematePieceTypes";
import { inferProductTypeFromLegacy } from "./remateProductRules";
import { resolveRemateSheetCutDimensions } from "./remateSheetDimensions";
import {
  resolveRemateIndustrialSuffix,
  resolveRematePieceDisplayName,
} from "./labels";
import {
  serializeTampoCutoutsForCutlist,
  TAMPO_CUTOUT_TYPE_LABELS,
} from "./tampoCutouts";
import { serializeTampoUnionForCutlist } from "./tampoUnion";
import { serializeTampoAngleForCutlist } from "./tampoAngle";

function toCutDimensions(remate: RematePiece): CutListItem["dimensoes"] {
  const sheet = resolveRemateSheetCutDimensions(remate);
  return {
    largura: sheet.comprimentoMm,
    altura: sheet.larguraMm,
    profundidade: sheet.espessuraMm,
  };
}

function isRemateIncludedInCutlist(remate: RematePiece): boolean {
  if (remate.visible === false) return false;
  // Usar width/height brutos — resolveRemateSheetCutDimensions faz Math.max(1,…) e mascararia 0
  const L = Number(remate.width) || 0;
  const A = Number(remate.height) || 0;
  return L > 0 && A > 0;
}

export function buildRemateCutlistItems(
  remates: readonly RematePiece[],
  boxes: readonly BoxModule[]
): CutListItemComPreco[] {
  const included = remates.filter(isRemateIncludedInCutlist);
  void boxes;

  const counters = new Map<string, number>();

  const items: CutListItem[] = included.map((remate) => {
    const material = getMaterialByIdOrLabel(remate.materialPresetId);
    const materialLabel = material?.label ?? remate.materialPresetId;
    const boxId = remate.parentBoxId ?? "";
    const productType = remate.productType ?? inferProductTypeFromLegacy(remate);
    const suffix = resolveRemateIndustrialSuffix(remate);
    const counterKey = `${boxId}\0${suffix}`;
    const occurrence = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, occurrence);
    const displayFallback = `Remate ${suffix}`;
    const nome = resolveRematePieceDisplayName(remate, displayFallback);
    const materialId = material?.id ?? remate.materialPresetId;
    const rotationMeta = buildCutlistRotationMetadata({
      allowPieceRotation: remate.allowPieceRotation,
      lockWoodGrain: remate.lockWoodGrain,
      materialId,
    });
    const sheet = resolveRemateSheetCutDimensions(remate);

    return {
      id: remate.id,
      nome,
      quantidade: 1,
      dimensoes: toCutDimensions(remate),
      espessura: sheet.espessuraMm,
      material: materialLabel,
      tipo: "remate",
      sourceType: "parametric",
      boxId,
      materialId: material?.id ?? remate.materialPresetId,
      visualMaterial: getFallbackMaterial(),
      grainDirection: resolveIndustrialGrainCode({
        tipo: "remate",
        remateProductType: productType,
        remateTipo: remate.tipo,
        remateMountSlot: remate.mountSlot,
      }),
      drillHoles: [],
      metadata: {
        panelId: remate.id,
        remateId: remate.id,
        productType,
        mountSlot: remate.mountSlot,
        partRole: remate.partRole,
        partIndex: remate.partIndex,
        parentGroupId: remate.parentGroupId,
        remateType: remate.tipo,
        rematePosition: remate.tipo,
        remateIndustrialLabel: suffix,
        remateKind: suffix,
        remateOccurrenceIndex: occurrence,
        followBox: remate.followBox,
        placementMode: remate.placementMode ?? (remate.followBox ? "SNAPPED" : "FREE"),
        faceOffsets: remate.faceOffsets,
        laminadoFabrica: productType === "TAMPO_COZINHA",
        remateCategory: productType === "TAMPO_COZINHA" ? "tampo_especial" : "remate",
        cutouts:
          productType === "TAMPO_COZINHA"
            ? serializeTampoCutoutsForCutlist(remate.cutouts)
            : undefined,
        cutoutOperations:
          productType === "TAMPO_COZINHA"
            ? (remate.cutouts ?? []).map((c) => ({
                kind: "tampo_cutout" as const,
                tipo: c.tipo,
                label: TAMPO_CUTOUT_TYPE_LABELS[c.tipo],
              }))
            : undefined,
        union:
          productType === "TAMPO_COZINHA"
            ? serializeTampoUnionForCutlist(remate.union)
            : undefined,
        tampoAngle:
          productType === "TAMPO_COZINHA"
            ? serializeTampoAngleForCutlist(remate.angleConfig)
            : undefined,
        ...rotationMeta,
      },
    };
  });

  return calcularPrecoCutList(items);
}
