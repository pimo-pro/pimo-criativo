/**
 * Tipos do motor industrial unificado do armário.
 * Features = antigos modos A–D (mesmos IDs técnicos).
 */

import type { BoxModule, CutListItem, CutListItemComPreco } from "../types";
import type { IndustrialModeId } from "../industrialAdmin/industrialModelsRegistry";

/** IDs estáveis das 4 funcionalidades (não são modos novos). */
export type IndustrialFeatureId = IndustrialModeId;

export type IndustrialSyncPatch = {
  id: string;
  featureId: IndustrialFeatureId;
  /** Menor = mais cedo (B=10, C=20). */
  order: number;
  matches: (box: BoxModule) => boolean;
  apply: <T extends BoxModule>(box: T) => T;
};

export type IndustrialCutlistAdapterContext = {
  syncedBox: BoxModule;
  items: CutListItemComPreco[];
  baseItem: Partial<CutListItemComPreco>;
  bodyMaterialKey: string;
  material: string;
  visualMaterial: CutListItemComPreco["visualMaterial"];
  boxName?: string;
  priceRaw: (raw: CutListItem[]) => CutListItemComPreco[];
  resolveMaterialId: (id: string | undefined, fallback: string) => string;
};

export type IndustrialCutlistAdapter = {
  id: string;
  featureId: IndustrialFeatureId;
  /** Menor = mais cedo (A=10, B patch=20, D=30). */
  order: number;
  matches: (box: BoxModule) => boolean;
  /** Mutates items / pushes additive pieces. */
  apply: (ctx: IndustrialCutlistAdapterContext) => void;
};

export type IndustrialFeatureDefinition = {
  id: IndustrialFeatureId;
  nomeTecnico: string;
  nomeIndustrial: string;
  phase: "A" | "B" | "C" | "D";
  ruleIds: readonly string[];
  syncPatchIds: readonly string[];
  adapterIds: readonly string[];
  skipClassicDrawerCutlist: boolean;
  matches: (box: {
    baseCabinetId?: string | null;
    customIndustrialModelId?: string | null;
  }) => boolean;
};
