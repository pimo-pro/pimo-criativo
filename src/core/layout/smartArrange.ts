/**
 * Smart Arrangement: organizar automaticamente modelos por categoria
 * (prateleiras, gavetas, portas, acessórios) dentro da caixa.
 */

import type { Dimensoes } from "../types";
import { computeAutoPosition } from "../rules/positioning";
import type { PlacedModelMm } from "../rules/positioning";
import { boxDimsToBoundsMm, toPlacedModelMm, positionMmToLocalM } from "./viewerLayoutAdapter";
import type { BoxDimsM, PositionLocalM, SizeM } from "./viewerLayoutAdapter";
import type { CadModelCategoryId } from "../cad/categories";

export type ModelToArrange = {
  instanceId: string;
  modelId: string;
  categoria?: string;
  currentPosition?: PositionLocalM;
  sizeM: SizeM;
};

export type ArrangeResult = {
  instanceId: string;
  position: PositionLocalM;
};

/**
 * Ordena modelos por categoria para disposição: estrutura/prateleiras primeiro,
 * depois gavetas, portas, acessórios, decoração.
 */
const CATEGORY_ORDER: CadModelCategoryId[] = [
  "estrutura",
  "gavetas",
  "portas",
  "acessorios",
  "decoracao",
];

function categoryOrder(categoria?: string): number {
  const id = (categoria ?? "").toLowerCase();
  const idx = CATEGORY_ORDER.indexOf(id as CadModelCategoryId);
  return idx >= 0 ? idx : CATEGORY_ORDER.length;
}

/**
 * Calcula posições automáticas para uma lista de modelos, respeitando categoria
 * e evitando sobreposição. Devolve posições em espaço local do viewer (m).
 */
export function autoArrangeModels(
  boxDimsM: BoxDimsM,
  models: ModelToArrange[]
): ArrangeResult[] {
  const bounds = boxDimsToBoundsMm(boxDimsM);
  const sorted = [...models].sort(
    (a, b) => categoryOrder(a.categoria) - categoryOrder(b.categoria)
  );
  const placed: PlacedModelMm[] = [];
  const results: ArrangeResult[] = [];

  for (const m of sorted) {
    const sizeMm: Dimensoes = {
      largura: m.sizeM.width * 1000,
      altura: m.sizeM.height * 1000,
      profundidade: m.sizeM.depth * 1000,
    };
    const result = computeAutoPosition(
      bounds,
      placed,
      m.modelId,
      sizeMm,
      m.instanceId
    );
    const positionLocal = positionMmToLocalM(result.positionMm, boxDimsM);
    results.push({ instanceId: m.instanceId, position: positionLocal });
    placed.push(
      toPlacedModelMm(
        m.instanceId,
        m.modelId,
        positionLocal,
        m.sizeM,
        boxDimsM
      )
    );
  }
  return results;
}
