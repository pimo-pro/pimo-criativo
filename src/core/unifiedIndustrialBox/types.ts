/**
 * Tipos do motor industrial unificado do armário.
 * Features = antigos modos A–D (mesmos IDs técnicos).
 */

import type { BoxModule, CutListItem, CutListItemComPreco } from "../types";

/**
 * IDs estáveis das 4 funcionalidades (≡ modos A–D).
 * Definidos aqui (sem import do registry Fase E) para evitar puxar o registo no grafo do motor.
 */
export type IndustrialFeatureId =
  | "cx_gav_cavita"
  | "gaveta_porta_sep_prateleiras"
  | "wardrobe_sep_parcial_gavetas"
  | "inner_cabinet_a1";

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
