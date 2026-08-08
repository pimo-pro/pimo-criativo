/**
 * Unified Industrial Box Engine — motor único do armário industrial.
 * Orquestra sync patches + cutlist adapters das features A–D.
 * Não altera carcaça clássica nem L/A/P globais.
 * Não está ligado ao cutlistFromBoxes clássico (consumo via Workspace pipro).
 */

import type { BoxModule, CutListItem, CutListItemComPreco } from "../types";
import { resolveActiveIndustrialFeatures } from "./industrialFeatures";
import { applyIndustrialSyncPatches } from "./industrialSyncPatches";
import { applyIndustrialCutlistAdapters } from "./industrialCutlistAdapters";
import type { IndustrialCutlistAdapterContext } from "./types";

export { UNIFIED_INDUSTRIAL_BOX_ENGINE_ID } from "./industrialFeatures";
export { applyIndustrialSyncPatches } from "./industrialSyncPatches";
export { applyIndustrialCutlistAdapters } from "./industrialCutlistAdapters";

export function resolveActiveFeaturesForBox(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}) {
  return resolveActiveIndustrialFeatures(box);
}

export function shouldSkipClassicDrawerCutlist(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}): boolean {
  return resolveActiveIndustrialFeatures(box).some((f) => f.skipClassicDrawerCutlist);
}

/** Sync industrial (B/C). */
export function syncUnifiedIndustrialBox<T extends BoxModule>(box: T): T {
  return applyIndustrialSyncPatches(box);
}

export type RunIndustrialCutlistAdaptersParams = Omit<
  IndustrialCutlistAdapterContext,
  "priceRaw" | "resolveMaterialId"
> & {
  priceRaw: (raw: CutListItem[]) => CutListItemComPreco[];
  resolveMaterialId: (id: string | undefined, fallback: string) => string;
};

/** Adapters pós-carcaça (aditivos / patches). */
export function runIndustrialCutlistAdapters(
  params: RunIndustrialCutlistAdaptersParams
): void {
  applyIndustrialCutlistAdapters(params);
}
