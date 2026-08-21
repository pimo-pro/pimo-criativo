/**
 * As 4 funcionalidades industriais do armário unificado (= modos A–D).
 * Sem novos IDs de produto.
 */

import { boxUsesCxGav, CX_GAV_PRODUCT_MODE_ID } from "../cxGav/cxGavGeometry";
import {
  boxUsesGavetaPortaSep,
  GAVETA_PORTA_SEP_NOME_INDUSTRIAL,
  GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
} from "../productModes/gavetaPortaSepLayout";
import {
  boxUsesWardrobePartialSep,
  WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
} from "../wardrobe/partialSepToDiv";
import {
  boxUsesInnerCabinetA1,
  INNER_CABINET_A1_PRODUCT_MODE,
} from "../innerCabinet/a1Geometry";
import type { IndustrialFeatureDefinition } from "./types";

/** Nome lógico do motor (não é baseCabinetId / modo novo). */
export const UNIFIED_INDUSTRIAL_BOX_ENGINE_ID = "unified_industrial_box_engine";

export const INDUSTRIAL_FEATURES: readonly IndustrialFeatureDefinition[] = [
  {
    id: CX_GAV_PRODUCT_MODE_ID,
    nomeTecnico: "cx_gav_cavita",
    nomeIndustrial: "Caixa cavita (cx_gav)",
    phase: "A",
    ruleIds: [
      "profundidade_ssot",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
      "furos_cx_gav_10x30_10x13",
    ],
    syncPatchIds: [],
    adapterIds: ["adapter.cx_gav.cutlist"],
    skipClassicDrawerCutlist: false,
    matches: boxUsesCxGav,
  },
  {
    id: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
    nomeTecnico: "gaveta_porta_sep_prateleiras",
    nomeIndustrial: GAVETA_PORTA_SEP_NOME_INDUSTRIAL,
    phase: "B",
    ruleIds: [
      "folga_2mm_gaveta_porta",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
    ],
    syncPatchIds: ["sync.gaveta_porta_sep"],
    adapterIds: ["adapter.gaveta_porta_sep.patch"],
    skipClassicDrawerCutlist: false,
    matches: boxUsesGavetaPortaSep,
  },
  {
    id: WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
    nomeTecnico: "wardrobe_sep_parcial_gavetas",
    nomeIndustrial: "SEP parcial → DIV (só cavilha)",
    phase: "C",
    ruleIds: [
      "sep_parcial_div_so_cavilha",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
    ],
    syncPatchIds: ["sync.wardrobe_sep_parcial"],
    adapterIds: [],
    skipClassicDrawerCutlist: false,
    matches: boxUsesWardrobePartialSep,
  },
  {
    id: INNER_CABINET_A1_PRODUCT_MODE,
    nomeTecnico: "inner_cabinet_a1",
    nomeIndustrial: "Caixa interna dinâmica a_1",
    phase: "D",
    ruleIds: [
      "profundidade_ssot",
      "compensacao_40mm",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
      "gavetas_europeias_internas",
    ],
    syncPatchIds: [],
    adapterIds: ["adapter.a1.cutlist"],
    skipClassicDrawerCutlist: true,
    matches: boxUsesInnerCabinetA1,
  },
] as const;

export function resolveActiveIndustrialFeatures(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}): IndustrialFeatureDefinition[] {
  return INDUSTRIAL_FEATURES.filter((f) => f.matches(box));
}
