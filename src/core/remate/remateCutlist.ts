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
  buildRemateIndustrialLabelsForRemates,
  resolveRemateIndustrialSuffix,
  resolveRematePieceDisplayName,
} from "./labels";
import { buildRemateIndustrialViewerMetadata } from "./remateIndustrialMetadata";

function toCutDimensions(remate: RematePiece): CutListItem["dimensoes"] {
  const sheet = resolveRemateSheetCutDimensions(remate);
  return {
    largura: sheet.comprimentoMm,
    altura: sheet.larguraMm,
    profundidade: sheet.espessuraMm,
  };
}

function buildBoxNameLookup(boxes: readonly BoxModule[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const box of boxes) {
    if (box?.id) out[box.id] = typeof box.nome === "string" ? box.nome : box.id;
  }
  return out;
}

export function buildRemateCutlistItems(
  remates: readonly RematePiece[],
  boxes: readonly BoxModule[]
): CutListItemComPreco[] {
  const boxNameById = buildBoxNameLookup(boxes);
  const industrialLabels = buildRemateIndustrialLabelsForRemates(remates, boxNameById);

  const items: CutListItem[] = remates.map((remate) => {
    const material = getMaterialByIdOrLabel(remate.materialPresetId);
    const materialLabel = material?.label ?? remate.materialPresetId;
    const boxId = remate.parentBoxId ?? "";
    const productType = remate.productType ?? inferProductTypeFromLegacy(remate);
    const suffix = resolveRemateIndustrialSuffix(remate);
    const industrialLabel = industrialLabels.get(remate.id) ?? remate.name;
    const nome = resolveRematePieceDisplayName(remate, industrialLabel);
    const materialId = material?.id ?? remate.materialPresetId;
    const rotationMeta = buildCutlistRotationMetadata({
      allowPieceRotation: remate.allowPieceRotation,
      lockWoodGrain: remate.lockWoodGrain,
      materialId,
    });
    const viewerMeta = buildRemateIndustrialViewerMetadata(remate);

    return {
      id: remate.id,
      nome,
      quantidade: 1,
      dimensoes: toCutDimensions(remate),
      espessura: resolveRemateSheetCutDimensions(remate).espessuraMm,
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
        industrialLabel,
        remateIndustrialLabel: suffix,
        remateKind: suffix,
        ...viewerMeta,
        ...rotationMeta,
      },
    };
  });

  return calcularPrecoCutList(items);
}
