/**
 * SSOT — regras industriais declarativas (valores = constantes já usadas nas Fases A–D).
 */

import { DRAWER_FRONT_LATERAL_GAP_MM } from "../drawers/drawerGeometryConstants";
import {
  GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM,
  GAVETA_PORTA_SEP_DOOR_GAP_MM,
  GAVETA_PORTA_SEP_FRONT_GAP_MM,
} from "../productModes/gavetaPortaSepLayout";
import { HINGE_COMPENSATION_MM } from "../innerCabinet/hingeCompensation40";
import { INNER_CABINET_A1_DEFAULT_HEIGHT_MM } from "../innerCabinet/a1Geometry";
import { CX_GAV_CIMA_DEPTH_MM } from "../cxGav/cxGavGeometry";

export type IndustrialRuleId =
  | "folga_2mm_gaveta_porta"
  | "sep_parcial_div_so_cavilha"
  | "profundidade_ssot"
  | "compensacao_40mm"
  | "naming_industrial"
  | "orla_industrial"
  | "routing_drill_cnc"
  | "gavetas_europeias_internas"
  | "furos_cx_gav_10x30_10x13";

export type IndustrialRuleEntry = {
  id: IndustrialRuleId;
  nome: string;
  descricao: string;
  /** Valores numéricos de referência (não recalcula geometria). */
  valuesMm?: Record<string, number>;
  appliesToModes: readonly string[];
};

export const INDUSTRIAL_RULES: readonly IndustrialRuleEntry[] = [
  {
    id: "folga_2mm_gaveta_porta",
    nome: "Folga 2 mm (gaveta/porta)",
    descricao: "Folga industrial na frente da gaveta e porta parcial (Fase B).",
    valuesMm: {
      gavetaFrenteMm: GAVETA_PORTA_SEP_FRONT_GAP_MM,
      portaMm: GAVETA_PORTA_SEP_DOOR_GAP_MM,
      drawerFrontLateralMm: DRAWER_FRONT_LATERAL_GAP_MM,
      gavetaPortaSepDrawerDefaultMm: GAVETA_PORTA_SEP_DEFAULT_DRAWER_HEIGHT_MM,
    },
    appliesToModes: ["gaveta_porta_sep_prateleiras", "inner_cabinet_a1"],
  },
  {
    id: "sep_parcial_div_so_cavilha",
    nome: "SEP parcial → DIV só cavilha",
    descricao: "Ligação SEP↔DIV sem parafusos; SEP2 visual intacto (Fase C).",
    appliesToModes: ["wardrobe_sep_parcial_gavetas"],
  },
  {
    id: "profundidade_ssot",
    nome: "Profundidade interna SSOT",
    descricao: "Usa getProfundidadeInternaUtilMm; não altera fórmulas globais L/A/P.",
    appliesToModes: ["cx_gav_cavita", "inner_cabinet_a1"],
  },
  {
    id: "compensacao_40mm",
    nome: "Compensação 40 mm (dobradiça)",
    descricao: "Offset local a_1 + peça compensadora; não altera carcaça mãe.",
    valuesMm: { compensacaoMm: HINGE_COMPENSATION_MM },
    appliesToModes: ["inner_cabinet_a1"],
  },
  {
    id: "naming_industrial",
    nome: "Naming industrial",
    descricao: "Labels industriais (cx_gav_*, port_cima, a_1_cx_*, a_1_cx_gav_*).",
    appliesToModes: [
      "cx_gav_cavita",
      "gaveta_porta_sep_prateleiras",
      "wardrobe_sep_parcial_gavetas",
      "inner_cabinet_a1",
    ],
  },
  {
    id: "orla_industrial",
    nome: "Orla industrial",
    descricao: "Lados de orla por tipo (registo + regras clássicas).",
    appliesToModes: [
      "cx_gav_cavita",
      "gaveta_porta_sep_prateleiras",
      "wardrobe_sep_parcial_gavetas",
      "inner_cabinet_a1",
    ],
  },
  {
    id: "routing_drill_cnc",
    nome: "Routing DRILL/CNC",
    descricao: "Tipos industriais → DRILL; frentes de gaveta nunca CNC.",
    appliesToModes: [
      "cx_gav_cavita",
      "gaveta_porta_sep_prateleiras",
      "wardrobe_sep_parcial_gavetas",
      "inner_cabinet_a1",
    ],
  },
  {
    id: "gavetas_europeias_internas",
    nome: "Gavetas internas europeias",
    descricao: "Gavetas a_1 com regras europeias / alturas custom.",
    valuesMm: { alturaPadraoA1Mm: INNER_CABINET_A1_DEFAULT_HEIGHT_MM },
    appliesToModes: ["inner_cabinet_a1"],
  },
  {
    id: "furos_cx_gav_10x30_10x13",
    nome: "Furos cx_gav",
    descricao: "Cavilha 10×30 aresta + 10×13 face a 30/70 mm da traseira.",
    valuesMm: { cimaProfundidadeMm: CX_GAV_CIMA_DEPTH_MM },
    appliesToModes: ["cx_gav_cavita"],
  },
] as const;

export const INDUSTRIAL_RULE_IDS: readonly IndustrialRuleId[] = INDUSTRIAL_RULES.map(
  (r) => r.id
);

export function getIndustrialRuleById(id: IndustrialRuleId): IndustrialRuleEntry | undefined {
  return INDUSTRIAL_RULES.find((r) => r.id === id);
}

export function assertNoDuplicateIndustrialRuleIds(): void {
  const seen = new Set<string>();
  for (const r of INDUSTRIAL_RULES) {
    if (seen.has(r.id)) throw new Error(`Regra industrial duplicada: ${r.id}`);
    seen.add(r.id);
  }
}
