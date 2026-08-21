/**
 * SSOT — registo dos modos industriais (Fases A–D).
 * Não altera geometria nem fórmulas; só declara metadados + ordem de pipeline.
 */

import {
  boxUsesCxGav,
  CX_GAV_PIECE_TIPOS,
  CX_GAV_PRODUCT_MODE_ID,
} from "../cxGav/cxGavGeometry";
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
import {
  INDUSTRIAL_DRILL_TIPOS,
  INDUSTRIAL_ORLA_SIDES,
  industrialDrillTokenMatch,
  industrialExcludeFromCncHeuristic,
  isIndustrialDrillTipo,
} from "./industrialPieceTables";

const A1_CARCASS_TIPOS = [
  "a1_cx_lat_dir",
  "a1_cx_lat_esq",
  "a1_cx_cima",
  "a1_cx_fundo",
] as const;
const A1_COMP_TIPO = "a1_cx_comp_40";

export type IndustrialModeId =
  | typeof CX_GAV_PRODUCT_MODE_ID
  | typeof GAVETA_PORTA_SEP_PRODUCT_MODE_ID
  | typeof WARDROBE_PARTIAL_SEP_PRODUCT_MODE
  | typeof INNER_CABINET_A1_PRODUCT_MODE;

export type IndustrialModelEntry = {
  id: IndustrialModeId;
  nomeTecnico: string;
  nomeIndustrial: string;
  phase: "A" | "B" | "C" | "D";
  pieceTipos: readonly string[];
  pieceLabels: Record<string, string>;
  adapters: readonly string[];
  rules: readonly string[];
  dependencies: {
    sep?: boolean;
    div?: boolean;
    gavetas?: boolean;
    portas?: boolean;
    compensacao40?: boolean;
    profundidadeSsot?: boolean;
  };
  /** Ordem de sync pré-cutlist (menor = mais cedo). null = sem sync próprio. */
  syncOrder: number | null;
  /** Ordem do adapter/patch pós-carcaça (menor = mais cedo). null = sem adapter. */
  adapterOrder: number | null;
  skipClassicDrawerCutlist: boolean;
  matches: (box: {
    baseCabinetId?: string | null;
    customIndustrialModelId?: string | null;
  }) => boolean;
};

export const INDUSTRIAL_MODELS: readonly IndustrialModelEntry[] = [
  {
    id: CX_GAV_PRODUCT_MODE_ID,
    nomeTecnico: "cx_gav_cavita",
    nomeIndustrial: "Caixa cavita (cx_gav)",
    phase: "A",
    pieceTipos: [...CX_GAV_PIECE_TIPOS],
    pieceLabels: {
      cx_gav_lat_dir: "CX GAV lateral direita",
      cx_gav_lat_esq: "CX GAV lateral esquerda",
      cx_gav_fun: "CX GAV fundo",
      cx_gav_cima: "CX GAV cima",
    },
    adapters: ["cxGavCutlistAdapter", "cxGavDrilling"],
    rules: [
      "profundidade_ssot",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
      "furos_cx_gav_10x30_10x13",
    ],
    dependencies: { profundidadeSsot: true },
    syncOrder: null,
    adapterOrder: 10,
    skipClassicDrawerCutlist: false,
    matches: boxUsesCxGav,
  },
  {
    id: GAVETA_PORTA_SEP_PRODUCT_MODE_ID,
    nomeTecnico: "gaveta_porta_sep_prateleiras",
    nomeIndustrial: GAVETA_PORTA_SEP_NOME_INDUSTRIAL,
    phase: "B",
    pieceTipos: ["separador", "gaveta_frente_ext", "porta_simples", "prateleira"],
    pieceLabels: {},
    adapters: ["gavetaPortaSepLayout", "drawerCutlistAdapter", "doorLabels"],
    rules: [
      "folga_2mm_gaveta_porta",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
    ],
    dependencies: { sep: true, gavetas: true, portas: true },
    syncOrder: 10,
    adapterOrder: 20,
    skipClassicDrawerCutlist: false,
    matches: boxUsesGavetaPortaSep,
  },
  {
    id: WARDROBE_PARTIAL_SEP_PRODUCT_MODE,
    nomeTecnico: "wardrobe_sep_parcial_gavetas",
    nomeIndustrial: "SEP parcial → DIV (só cavilha)",
    phase: "C",
    pieceTipos: ["separador", "divisorio", "gaveta_frente_ext"],
    pieceLabels: {},
    adapters: ["partialSepToDiv", "divSep/drilling"],
    rules: [
      "sep_parcial_div_so_cavilha",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
    ],
    dependencies: { sep: true, div: true, gavetas: true },
    syncOrder: 20,
    adapterOrder: null,
    skipClassicDrawerCutlist: false,
    matches: boxUsesWardrobePartialSep,
  },
  {
    id: INNER_CABINET_A1_PRODUCT_MODE,
    nomeTecnico: "inner_cabinet_a1",
    nomeIndustrial: "Caixa interna dinâmica a_1",
    phase: "D",
    pieceTipos: [
      ...A1_CARCASS_TIPOS,
      A1_COMP_TIPO,
      "gaveta_frente_ext",
      "gaveta_lat_dir",
      "gaveta_lat_esq",
      "gaveta_fundo",
      "gaveta_traseira",
    ],
    pieceLabels: {
      a1_cx_lat_dir: "A1 lateral direita",
      a1_cx_lat_esq: "A1 lateral esquerda",
      a1_cx_cima: "A1 cima",
      a1_cx_fundo: "A1 fundo",
      a1_cx_comp_40: "A1 compensador 40 mm",
    },
    adapters: ["a1CutlistAdapter", "hingeCompensation40", "a1Naming", "drawerCutlistAdapter"],
    rules: [
      "profundidade_ssot",
      "compensacao_40mm",
      "naming_industrial",
      "orla_industrial",
      "routing_drill_cnc",
      "gavetas_europeias_internas",
    ],
    dependencies: {
      sep: true,
      div: true,
      gavetas: true,
      compensacao40: true,
      profundidadeSsot: true,
    },
    syncOrder: null,
    adapterOrder: 30,
    skipClassicDrawerCutlist: true,
    matches: boxUsesInnerCabinetA1,
  },
] as const;

export const INDUSTRIAL_MODE_IDS: readonly IndustrialModeId[] = INDUSTRIAL_MODELS.map(
  (m) => m.id
);

// Re-export tabelas estáticas (ponto único para consumidores do registo)
export {
  INDUSTRIAL_DRILL_TIPOS,
  INDUSTRIAL_ORLA_SIDES,
  industrialDrillTokenMatch,
  industrialExcludeFromCncHeuristic,
  isIndustrialDrillTipo,
};

export function getIndustrialModelById(id: string): IndustrialModelEntry | undefined {
  return INDUSTRIAL_MODELS.find((m) => m.id === id);
}

export function resolveActiveIndustrialModels(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}): IndustrialModelEntry[] {
  return INDUSTRIAL_MODELS.filter((m) => m.matches(box));
}

export function resolveIndustrialPieceLabel(tipo: string): string | undefined {
  for (const m of INDUSTRIAL_MODELS) {
    const label = m.pieceLabels[tipo];
    if (label) return label;
  }
  return undefined;
}

export function isRegisteredIndustrialModeId(id: string): boolean {
  return (
    INDUSTRIAL_MODE_IDS.includes(id as IndustrialModeId) ||
    INDUSTRIAL_MODELS.some((m) => id.includes(m.id))
  );
}

export function shouldSkipClassicDrawerCutlist(box: {
  baseCabinetId?: string | null;
  customIndustrialModelId?: string | null;
}): boolean {
  return resolveActiveIndustrialModels(box).some((m) => m.skipClassicDrawerCutlist);
}

export function assertNoDuplicateIndustrialModeIds(): void {
  const seen = new Set<string>();
  for (const m of INDUSTRIAL_MODELS) {
    if (seen.has(m.id)) throw new Error(`Modo industrial duplicado: ${m.id}`);
    seen.add(m.id);
  }
}
