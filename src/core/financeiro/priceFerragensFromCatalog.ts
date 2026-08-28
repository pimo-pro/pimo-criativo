/**
 * P3.9 F2 — SSOT preço ferragens via catálogo B + fallback Via A + STRICT.
 * Nunca throw: avisos em warnings[]; cálculo continua.
 */

import type { ComponentType } from "../components/componentTypes";
import { COMPONENT_TYPES_DEFAULT } from "../components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "../ferragens/ferragens";
import { CALCO_00_ID, CALCO_03_ID, loadCalcoConfig } from "../ferragens/calcoConfig";
import { loadPesPlasticoConfig } from "../ferragens/pesPlasticoConfig";
import { ferragensFromBoxes } from "../manufacturing/cutlistFromBoxes";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { safeGetItem } from "../../utils/storage";
import { sanitizeFerragensCatalog } from "../ferragens/ferragensCatalogSanitize";
import { sanitizeComponentTypes } from "../ferragens/ferragensCatalogSanitize";
import {
  pieceTemParafusoPuxador,
  resolveCanonicalFerragemId,
} from "../ferragens/ferragensCountRules";

const TIPO_TO_COMPONENT_ID: Record<string, string> = {
  cima: "cima",
  fundo: "fundo",
  lateral_esquerda: "lateral_esquerda",
  lateral_direita: "lateral_direita",
  COSTA: "costa",
  costa: "costa",
  prateleira: "prateleira",
  porta_dupla: "porta",
  porta_simples: "porta",
  porta_correr: "porta",
  gaveta_frente: "gaveta_frente",
  gaveta_frente_ext: "gaveta_frente",
  gaveta_lat_esq: "gaveta_lat_esq",
  gaveta_lat_dir: "gaveta_lat_dir",
  gaveta_fundo: "gaveta_fundo",
  gaveta_traseira: "gaveta_traseira",
  frente_fixa: "frente_fixa",
};

const JOINT_FERRAGEM_IDS = new Set(["parafuso_4x50"]);
const JOINT_COUNT_PIECE_TIPOS = new Set(["cima", "fundo"]);

/** Preços unitários Via A (boxManufacturing.gerarFerragens) mapeados a ids do catálogo B. */
const FALLBACK_PRECO_A_STATIC: Record<string, number> = {
  dobradica_35mm: 2.5,
  corredica_esq: 9.5,
  corredica_dir: 9.5,
  suporte_prateleira: 0.9,
  parafuso_4x50: 0.15,
  parafuso_3x30: 0.1,
  parafuso_4x35: 0.14,
  parafuso_5x50: 0.24,
  puxa_8mm: 0.7,
  cavilha_10x40: 0.08,
  dobradica_w90: 2.5,
  parafuso_puxador: 0.12,
};

export type FerragensStrictCode =
  | "COMPONENT_TYPE_MISSING"
  | "FERRAGEM_ID_MISSING_IN_CATALOG"
  | "PRECO_B_MISSING_FALLBACK_A"
  | "PRECO_A_FALLBACK_MISSING"
  | "MAPPING_MISSING";

export type FerragensStrictWarning = {
  code: FerragensStrictCode;
  pieceId: string;
  pieceTipo?: string;
  ferragemId?: string;
  message: string;
  precoFallbackA?: number;
};

export type FerragensFallbackUsage = {
  pieceId: string;
  ferragemId: string;
  precoA: number;
  qtd: number;
};

export type FerragemCatalogLine = {
  pieceId: string;
  ferragemId: string;
  qtd: number;
  precoUnitario: number;
  precoTotal: number;
  usedFallbackA: boolean;
};

export type PriceFerragensFromCatalogResult = {
  totalEur: number;
  totalQty: number;
  eurByPieceId: Map<string, number>;
  qtyByPieceId: Map<string, number>;
  lines: FerragemCatalogLine[];
  warnings: FerragensStrictWarning[];
  fallbacks: FerragensFallbackUsage[];
};

export type CompareFerragensAvsBResult = {
  totalEurA: number;
  totalQtyA: number;
  totalEurB: number;
  totalQtyB: number;
  deltaEur: number;
  warnings: FerragensStrictWarning[];
  fallbacks: FerragensFallbackUsage[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function loadFerragensCatalogForPricing(): Ferragem[] {
  const raw = safeGetItem("pimo_ferragens");
  if (!raw) return FERRAGENS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Ferragem[];
    const list = Array.isArray(parsed) && parsed.length > 0 ? parsed : FERRAGENS_DEFAULT;
    return sanitizeFerragensCatalog(list);
  } catch {
    return FERRAGENS_DEFAULT;
  }
}

export function loadComponentTypesForPricing(): ComponentType[] {
  const raw = safeGetItem("pimo_component_types");
  if (!raw) return COMPONENT_TYPES_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as ComponentType[];
    const list = Array.isArray(parsed) && parsed.length > 0 ? parsed : COMPONENT_TYPES_DEFAULT;
    return sanitizeComponentTypes(list);
  } catch {
    return COMPONENT_TYPES_DEFAULT;
  }
}

/** Resolve preço unitário A para um id B (inclui pe/calço dinâmicos). */
export function resolveFallbackPrecoA(ferragemId: string): number | null {
  if (ferragemId in FALLBACK_PRECO_A_STATIC) {
    return FALLBACK_PRECO_A_STATIC[ferragemId];
  }
  if (ferragemId === "pe_plastico") {
    return loadPesPlasticoConfig().precoUnitario;
  }
  if (ferragemId === "parafuso_3x30") {
    return 0.1;
  }
  if (ferragemId === CALCO_00_ID) {
    return loadCalcoConfig().refs["00"].precoUnitario;
  }
  if (ferragemId === CALCO_03_ID) {
    return loadCalcoConfig().refs["03"].precoUnitario;
  }
  return null;
}

function resolveUnitPrice(
  ferragemId: string,
  pieceId: string,
  catalogById: Map<string, Ferragem>,
  warnings: FerragensStrictWarning[],
  fallbacks: FerragensFallbackUsage[],
  qtd: number
): { unit: number; usedFallbackA: boolean } {
  const entry = catalogById.get(ferragemId);
  if (!entry) {
    warnings.push({
      code: "FERRAGEM_ID_MISSING_IN_CATALOG",
      pieceId,
      ferragemId,
      message: `ferragemId "${ferragemId}" ausente no catálogo B`,
    });
  }

  const precoB = entry?.precoUnitario;
  if (typeof precoB === "number" && Number.isFinite(precoB) && precoB >= 0) {
    return { unit: precoB, usedFallbackA: false };
  }

  const precoA = resolveFallbackPrecoA(ferragemId);
  if (precoA != null && Number.isFinite(precoA) && precoA >= 0) {
    warnings.push({
      code: "PRECO_B_MISSING_FALLBACK_A",
      pieceId,
      ferragemId,
      message: `Sem preço B para "${ferragemId}"; fallback A = ${precoA}`,
      precoFallbackA: precoA,
    });
    fallbacks.push({ pieceId, ferragemId, precoA, qtd });
    return { unit: precoA, usedFallbackA: true };
  }

  warnings.push({
    code: "PRECO_A_FALLBACK_MISSING",
    pieceId,
    ferragemId,
    message: `Sem preço B nem fallback A para "${ferragemId}"; usando 0`,
  });
  return { unit: 0, usedFallbackA: false };
}

function iterDefsForItem(
  item: CutListItemComPreco,
  ctById: Record<string, ComponentType>,
  warnings: FerragensStrictWarning[],
  onDef: (ferragemId: string, qtd: number) => void,
  box?: BoxModule
): void {
  const pieceId = String(item.id ?? "");
  const pieceTipo = String(item.tipo ?? "");
  const componentId = TIPO_TO_COMPONENT_ID[pieceTipo] ?? pieceTipo;
  const ct = ctById[componentId];

  if (!ct) {
    if (pieceTipo && !TIPO_TO_COMPONENT_ID[pieceTipo]) {
      warnings.push({
        code: "MAPPING_MISSING",
        pieceId,
        pieceTipo,
        message: `Sem mapping tipo?componentType para "${pieceTipo}"`,
      });
    } else {
      warnings.push({
        code: "COMPONENT_TYPE_MISSING",
        pieceId,
        pieceTipo,
        message: `componentType "${componentId}" ausente`,
      });
    }
    return;
  }

  const defs = ct.ferragens_default ?? [];
  if (defs.length === 0) return;

  const qtyMult = Math.max(1, item.quantidade ?? 1);
  for (const def of defs) {
    if (def.ferragem_id === "prego_costa") continue;
    if (def.ferragem_id === "parafuso_puxador" && !pieceTemParafusoPuxador(item, box)) {
      continue;
    }
    if (JOINT_FERRAGEM_IDS.has(def.ferragem_id) && !JOINT_COUNT_PIECE_TIPOS.has(pieceTipo)) {
      continue;
    }
    const qtdBase =
      def.quantidade_fixa ??
      (def.quantidade_por_lado != null
        ? def.quantidade_por_lado * Math.max(1, def.aplicar_em?.length ?? 1)
        : 1);
    onDef(resolveCanonicalFerragemId(def.ferragem_id), qtdBase * qtyMult);
  }
}

/**
 * Preço ferragens SSOT (catálogo B + fallback A). STRICT: só warnings.
 */
export function priceFerragensFromCatalog(input: {
  cutlist: CutListItemComPreco[];
  componentTypes?: ComponentType[];
  catalog?: Ferragem[];
  boxes?: BoxModule[];
}): PriceFerragensFromCatalogResult {
  const componentTypes = input.componentTypes ?? loadComponentTypesForPricing();
  const catalog = sanitizeFerragensCatalog(input.catalog ?? loadFerragensCatalogForPricing());
  const ctById = Object.fromEntries(componentTypes.map((ct) => [ct.id, ct]));
  const catalogById = new Map(catalog.map((f) => [f.id, f]));
  const boxById = new Map((input.boxes ?? []).map((b) => [b.id, b]));

  const warnings: FerragensStrictWarning[] = [];
  const fallbacks: FerragensFallbackUsage[] = [];
  const lines: FerragemCatalogLine[] = [];
  const eurByPieceId = new Map<string, number>();
  const qtyByPieceId = new Map<string, number>();
  let totalEur = 0;
  let totalQty = 0;

  for (const item of input.cutlist ?? []) {
    const pieceId = String(item.id ?? "");
    const box = boxById.get(String(item.boxId ?? ""));
    iterDefsForItem(item, ctById, warnings, (ferragemId, qtd) => {
      if (!(qtd > 0)) return;
      const { unit, usedFallbackA } = resolveUnitPrice(
        ferragemId,
        pieceId,
        catalogById,
        warnings,
        fallbacks,
        qtd
      );
      const precoTotal = round2(unit * qtd);
      lines.push({
        pieceId,
        ferragemId,
        qtd,
        precoUnitario: unit,
        precoTotal,
        usedFallbackA,
      });
      totalEur = round2(totalEur + precoTotal);
      totalQty += qtd;
      eurByPieceId.set(pieceId, round2((eurByPieceId.get(pieceId) ?? 0) + precoTotal));
      qtyByPieceId.set(pieceId, (qtyByPieceId.get(pieceId) ?? 0) + qtd);
    }, box);
  }

  return {
    totalEur: round2(totalEur),
    totalQty,
    eurByPieceId,
    qtyByPieceId,
    lines,
    warnings,
    fallbacks,
  };
}

/** Diagnóstico ? Via A (boxes) vs catálogo B (cutlist). */
export function compareFerragensAvsB(
  boxes: BoxModule[],
  rules: RulesConfig,
  cutlist: CutListItemComPreco[]
): CompareFerragensAvsBResult {
  const viaB = priceFerragensFromCatalog({ cutlist });
  let totalEurA = 0;
  let totalQtyA = 0;
  try {
    const viaA = ferragensFromBoxes(boxes, rules);
    totalEurA = round2(viaA.reduce((s, a) => s + (Number(a.precoTotal) || 0), 0));
    totalQtyA = viaA.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
  } catch {
    /* STRICT: Via A indisponivel — Delta parcial */
  }
  return {
    totalEurA,
    totalQtyA,
    totalEurB: viaB.totalEur,
    totalQtyB: viaB.totalQty,
    deltaEur: round2(viaB.totalEur - totalEurA),
    warnings: viaB.warnings,
    fallbacks: viaB.fallbacks,
  };
}
