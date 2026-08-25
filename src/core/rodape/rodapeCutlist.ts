import type { BoxModule, CutListItem, CutListItemComPreco } from "../types";
import { getMaterialByIdOrLabel } from "../materials/service";
import { getFallbackMaterial } from "../materials/materialLibraryV2";
import { calcularPrecoCutList } from "../pricing/pricing";
import { buildCutlistRotationMetadata } from "../manufacturing/cutlistRotationMetadata";
import type { ProjectRodape } from "./rodapeTypes";
import { resolveRodapePieceDisplayName } from "./labels";

function isRodapeIncludedInCutlist(rodape: ProjectRodape): boolean {
  if (rodape.visible === false) return false;
  const L = Number(rodape.dimensions?.widthMm ?? rodape.autoLengthMm) || 0;
  const A = Number(rodape.heightMm ?? rodape.dimensions?.heightMm) || 0;
  return L > 0 && A > 0;
}

function toCutDimensions(rodape: ProjectRodape): CutListItem["dimensoes"] {
  const largura = Number(rodape.dimensions?.widthMm ?? rodape.autoLengthMm) || 0;
  const altura = Number(rodape.heightMm ?? rodape.dimensions?.heightMm) || 0;
  const profundidade = Math.max(
    1,
    Number(rodape.thicknessMm ?? rodape.dimensions?.depthMm ?? 19)
  );
  return { largura, altura, profundidade };
}

export function buildRodapeCutlistItems(
  rodapes: readonly ProjectRodape[],
  boxes: readonly BoxModule[]
): CutListItemComPreco[] {
  const included = rodapes.filter(isRodapeIncludedInCutlist);
  void boxes;

  const counters = new Map<string, number>();

  const items: CutListItem[] = included.map((rodape) => {
    const material = getMaterialByIdOrLabel(rodape.materialId);
    const materialLabel = material?.label ?? rodape.materialId;
    const boxId = rodape.parentBoxId ?? "";
    const dims = toCutDimensions(rodape);
    const counterKey = boxId || rodape.id;
    const occurrence = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, occurrence);
    const nome = resolveRodapePieceDisplayName(rodape, "Rodapé");
    const materialId = material?.id ?? rodape.materialId;
    const rotationMeta = buildCutlistRotationMetadata({
      allowPieceRotation: rodape.allowPieceRotation,
      lockWoodGrain: rodape.lockWoodGrain,
      materialId,
    });

    return {
      id: rodape.id,
      nome,
      quantidade: 1,
      dimensoes: dims,
      espessura: dims.profundidade,
      material: materialLabel,
      tipo: "rodape",
      sourceType: "parametric",
      boxId,
      materialId,
      visualMaterial: getFallbackMaterial(),
      drillHoles: [],
      metadata: {
        panelId: rodape.id,
        rodapeId: rodape.id,
        rodapeKind: rodape.kind,
        partIndex: rodape.partIndex,
        parentGroupId: rodape.parentGroupId,
        rodapeOccurrenceIndex: occurrence,
        rodapeIndustrialLabel: "RODA_PE",
        ...rotationMeta,
      },
    };
  });

  return calcularPrecoCutList(items);
}
