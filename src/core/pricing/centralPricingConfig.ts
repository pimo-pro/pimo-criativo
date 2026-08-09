/**
 * SSOT de tarifas de fábrica — public/config/pricing.json
 * Local e produção leem o mesmo ficheiro (Vite public/ + deploy FTP).
 * Schema de mercado (chapas/orlas/€) mapeia para Orçamentos + Financeiro ADMIN.
 */

import {
  normalizeOrcamentosSettings,
  ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT,
  type OrcamentosSettings,
} from "../orcamentos";
import {
  normalizeFinanceiroAdminSettings,
  type FinanceiroAdminSettings,
} from "../financeiro/financeiroAdminRules";

export const CENTRAL_PRICING_URL = "/config/pricing.json";

export type CentralChapasPricing = {
  MDF_BRANCO_LAMINADO_19?: number;
  MDF_BRANCO_10?: number;
  MDF_CRU_19?: number;
  MDF_LACADO_19?: number;
  MDF_PRETO_LAMINADO_19?: number;
  CARVALHO_LAMINADO_19?: number;
  AGLOMERADO_BRANCO_19?: number;
  CONTRAPLACADO_CARVALHO_18?: number;
  HDF_CRU_3?: number;
  espessuraReducaoPct?: number;
  [key: string]: number | undefined;
};

export type CentralOrlasPricing = {
  PVC_BRANCO_1?: number;
  PVC_CARVALHO_1?: number;
  MELAMINA_05?: number;
  FOLHA_MADEIRA_05?: number;
  regraCarvalhoUsaFolhaMadeira?: boolean;
  [key: string]: number | boolean | undefined;
};

export type CentralFerragensPricing = {
  dobradica_soft_close?: number;
  parafuso?: number;
  suporte_prateleira?: number;
  corredica_telescopica?: number;
  corredica_soft_close?: number;
  gaveta_metalica?: number;
  [key: string]: number | undefined;
};

export type CentralOperacoesPricing = {
  corte_cnc_metro?: number;
  furo_cnc?: number;
  rasgo_cnc_metro?: number;
  drill_manual?: number;
  [key: string]: number | undefined;
};

export type CentralPricingFile = {
  version?: number;
  updatedAt?: string;
  notes?: Record<string, string>;
  /** Schema de mercado (SSOT actual). */
  chapas?: CentralChapasPricing;
  orlas?: CentralOrlasPricing;
  ferragens?: CentralFerragensPricing;
  operacoes?: CentralOperacoesPricing;
  desperdicio?: { percentual?: number };
  maoDeObra?: {
    montagem_caixa_m2?: number;
    montagem_gaveta?: number;
    montagem_remate_metro?: number;
  };
  custosAdicionais?: {
    serragem?: number;
    adm_percentual?: number;
    logistica?: number;
  };
  portes?: {
    ativoSomenteComEscolha?: boolean;
    local_kg?: number;
    local_caixa?: number;
    internacional_kg?: number;
    internacional_caixa?: number;
    material_extra?: number;
  };
  /** Campos derivados / legado (preenchidos no normalize). */
  material?: {
    precoChapaMdf19EurM2?: number;
    fallbackEurM2?: number;
    densidadePadraoKgM3?: number;
  };
  ivaPct?: number;
  orcamentos?: Partial<OrcamentosSettings> | Record<string, unknown>;
  financeiroAdmin?: Partial<FinanceiroAdminSettings> | Record<string, unknown>;
  aliases?: Record<string, string>;
};

let cached: CentralPricingFile | null = null;
let loadPromise: Promise<CentralPricingFile | null> | null = null;

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickNums(src: Record<string, unknown> | undefined, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!src) return out;
  for (const k of keys) {
    if (typeof src[k] === "number" && Number.isFinite(src[k] as number)) {
      out[k] = src[k] as number;
    }
  }
  return out;
}

const MARKET_BUILTIN_RAW: CentralPricingFile = {
  chapas: {
    MDF_BRANCO_LAMINADO_19: 31,
    MDF_BRANCO_10: 20,
    MDF_CRU_19: 20,
    MDF_LACADO_19: 130,
    MDF_PRETO_LAMINADO_19: 48,
    CARVALHO_LAMINADO_19: 95,
    AGLOMERADO_BRANCO_19: 29,
    CONTRAPLACADO_CARVALHO_18: 155,
    HDF_CRU_3: 15,
    espessuraReducaoPct: 0.95,
  },
  orlas: {
    PVC_BRANCO_1: 0.53,
    PVC_CARVALHO_1: 0.65,
    MELAMINA_05: 1.7,
    FOLHA_MADEIRA_05: 1.7,
    regraCarvalhoUsaFolhaMadeira: true,
  },
  ferragens: {
    dobradica_soft_close: 2.5,
    parafuso: 0.03,
    suporte_prateleira: 0.15,
    corredica_telescopica: 4.2,
    corredica_soft_close: 7.5,
    gaveta_metalica: 15,
  },
  operacoes: {
    corte_cnc_metro: 0.14,
    furo_cnc: 0.0225,
    rasgo_cnc_metro: 0.275,
    drill_manual: 0.015,
  },
  desperdicio: { percentual: 0.18 },
  maoDeObra: {
    montagem_caixa_m2: 17,
    montagem_gaveta: 15,
    montagem_remate_metro: 25,
  },
  custosAdicionais: {
    serragem: 0.8,
    adm_percentual: 0.05,
    logistica: 5,
  },
  portes: {
    ativoSomenteComEscolha: true,
    local_kg: 3.5,
    local_caixa: 12,
    internacional_kg: 11,
    internacional_caixa: 28,
    material_extra: 8,
  },
};

/** Baseline embutido (espelha public/config/pricing.json). */
export function getBuiltinCentralPricing(): CentralPricingFile {
  return normalizeCentralPricing(MARKET_BUILTIN_RAW);
}

export function getCentralPricingCached(): CentralPricingFile {
  return cached ?? getBuiltinCentralPricing();
}

export function setCentralPricingCacheForTests(value: CentralPricingFile | null): void {
  cached = value;
  loadPromise = null;
}

function isHtmlPayload(text: string): boolean {
  const t = String(text || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html");
}

function isMarketSchema(src: Record<string, unknown>): boolean {
  return src.chapas != null && typeof src.chapas === "object";
}

function mapMarketToLegacy(src: CentralPricingFile): {
  material: NonNullable<CentralPricingFile["material"]>;
  ivaPct: number;
  orcamentos: OrcamentosSettings;
  financeiroAdmin: FinanceiroAdminSettings;
} {
  const chapas = src.chapas ?? {};
  const operacoes = src.operacoes ?? {};
  const custos = src.custosAdicionais ?? {};
  const mao = src.maoDeObra ?? {};
  const portes = src.portes ?? {};
  const despPct = num(src.desperdicio?.percentual, 0.18);

  const mdfBranco = num(chapas.MDF_BRANCO_LAMINADO_19, 31);
  const mdfCru = num(chapas.MDF_CRU_19, 20);
  const serragem = num(custos.serragem, 0.8);
  const admPct = num(custos.adm_percentual, 0.05);
  const portesSoComEscolha = portes.ativoSomenteComEscolha !== false;

  const material = {
    precoChapaMdf19EurM2: mdfBranco,
    fallbackEurM2: mdfCru,
    densidadePadraoKgM3: 750,
  };

  const custosIndustriaisMerged = {
    // desperdício monetizado em % do custo de painéis (pricing.json desperdicio.percentual).
    desperdicioEurPorM2: 0,
    serragemEurPorM2: serragem,
    custoChapaReal: 0,
    custoOperacoesEspeciais: 0,
    // Mão de obra financeira = EUR manual Admin. Nunca herdar montagem/tempo.
    valorHoraMaquina: 0,
    // Logística financeira = valor manual Admin (EUR). Nunca herdar portes/peso.
    custoLogisticaPorKg: 0,
    custoMontagemPorPeca: num(mao.montagem_gaveta, 15),
    materialCostMode: ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT,
    enableDesperdicio: despPct > 0,
    enableSerragem: serragem > 0,
    enableLogistica: false,
    enableMaoDeObra: false,
    ...(typeof src.orcamentos === "object" && src.orcamentos && "custosIndustriais" in src.orcamentos
      ? (src.orcamentos as { custosIndustriais?: object }).custosIndustriais
      : {}),
  };

  const orcamentos = normalizeOrcamentosSettings({
    ...(src.orcamentos && typeof src.orcamentos === "object" ? src.orcamentos : {}),
    perfuracoes: {
      // Drill = furo CNC real; nesting flat-fee legado = 0 (CNC usa corte_cnc_metro).
      drillEurPorFuro: num(operacoes.furo_cnc, 0.0225),
      nestingEurPorOperacao: 0,
      ...(typeof src.orcamentos === "object" && src.orcamentos && "perfuracoes" in src.orcamentos
        ? (src.orcamentos as { perfuracoes?: object }).perfuracoes
        : {}),
    },
    custosIndustriais: custosIndustriaisMerged,
    operacoesAvancadas: {
      precoRasgoGaveta: num(operacoes.rasgo_cnc_metro, 0.275),
      ...(typeof src.orcamentos === "object" && src.orcamentos && "operacoesAvancadas" in src.orcamentos
        ? (src.orcamentos as { operacoesAvancadas?: object }).operacoesAvancadas
        : {}),
      // Foros/cavilhas/corte manual já cobrados em CNC/Drill — forçar 0 (após spread).
      precoForo5mm: 0,
      precoForoCavilha10x13: 0,
      precoForoCavilha10x30: 0,
      precoForoCalcoGrupo: 0,
      precoForoDobradicaGrupo: 0,
      precoCorteManualPorMetro: 0,
      precoMeQuadrilha: 0,
    },
    ferragens: { enableUnificacao: true },
  });

  const financeiroAdmin = normalizeFinanceiroAdminSettings({
    ...(src.financeiroAdmin && typeof src.financeiroAdmin === "object" ? src.financeiroAdmin : {}),
    adm: {
      enabled: admPct > 0,
      mode: "percentagem",
      valor: admPct <= 1 ? admPct * 100 : admPct,
    },
    montagem: {
      enabled: num(mao.montagem_caixa_m2, 0) > 0,
      mode: "eur_por_m2",
      valor: num(mao.montagem_caixa_m2, 17),
    },
    portes: {
      // Tarifas disponíveis; cobrança no projeto só com incluirPortes (ativoSomenteComEscolha).
      enabled: !portesSoComEscolha,
      taxaBase: num(portes.local_caixa, 12),
      porKg: num(portes.local_kg, 3.5),
      porM3: num(portes.material_extra, 8),
      porKm: 0,
      minimo: num(portes.local_caixa, 12),
    },
    distanciaKmDefault: 0,
  });

  return { material, ivaPct: 23, orcamentos, financeiroAdmin };
}

export function normalizeCentralPricing(raw: unknown): CentralPricingFile {
  const src = (
    !raw || typeof raw !== "object" ? MARKET_BUILTIN_RAW : raw
  ) as CentralPricingFile & Record<string, unknown>;

  if (isMarketSchema(src)) {
    const chapasSrc = (src.chapas ?? {}) as Record<string, unknown>;
    const orlasSrc = (src.orlas ?? {}) as Record<string, unknown>;
    const mapped = mapMarketToLegacy(src);
    return {
      version: typeof src.version === "number" && Number.isFinite(src.version) ? src.version : 2,
      updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : undefined,
      notes: src.notes && typeof src.notes === "object" ? src.notes : undefined,
      chapas: {
        ...pickNums(chapasSrc, [
          "MDF_BRANCO_LAMINADO_19",
          "MDF_BRANCO_10",
          "MDF_CRU_19",
          "MDF_LACADO_19",
          "MDF_PRETO_LAMINADO_19",
          "CARVALHO_LAMINADO_19",
          "AGLOMERADO_BRANCO_19",
          "CONTRAPLACADO_CARVALHO_18",
          "HDF_CRU_3",
          "espessuraReducaoPct",
        ]),
      },
      orlas: {
        ...pickNums(orlasSrc, ["PVC_BRANCO_1", "PVC_CARVALHO_1", "MELAMINA_05", "FOLHA_MADEIRA_05"]),
        regraCarvalhoUsaFolhaMadeira: orlasSrc.regraCarvalhoUsaFolhaMadeira === true,
      },
      ferragens: pickNums((src.ferragens ?? {}) as Record<string, unknown>, [
        "dobradica_soft_close",
        "parafuso",
        "suporte_prateleira",
        "corredica_telescopica",
        "corredica_soft_close",
        "gaveta_metalica",
      ]),
      operacoes: pickNums((src.operacoes ?? {}) as Record<string, unknown>, [
        "corte_cnc_metro",
        "furo_cnc",
        "rasgo_cnc_metro",
        "drill_manual",
      ]),
      desperdicio: {
        percentual: num(src.desperdicio?.percentual, 0.18),
      },
      maoDeObra: {
        montagem_caixa_m2: num(src.maoDeObra?.montagem_caixa_m2, 17),
        montagem_gaveta: num(src.maoDeObra?.montagem_gaveta, 15),
        montagem_remate_metro: num(src.maoDeObra?.montagem_remate_metro, 25),
      },
      custosAdicionais: {
        serragem: num(src.custosAdicionais?.serragem, 0.8),
        adm_percentual: num(src.custosAdicionais?.adm_percentual, 0.05),
        logistica: num(src.custosAdicionais?.logistica, 5),
      },
      portes: {
        ativoSomenteComEscolha: src.portes?.ativoSomenteComEscolha !== false,
        local_kg: num(src.portes?.local_kg, 3.5),
        local_caixa: num(src.portes?.local_caixa, 12),
        internacional_kg: num(src.portes?.internacional_kg, 11),
        internacional_caixa: num(src.portes?.internacional_caixa, 28),
        material_extra: num(src.portes?.material_extra, 8),
      },
      material: mapped.material,
      ivaPct: mapped.ivaPct,
      orcamentos: mapped.orcamentos,
      financeiroAdmin: mapped.financeiroAdmin,
      aliases: src.aliases && typeof src.aliases === "object" ? src.aliases : undefined,
    };
  }

  // Schema legado (material/orcamentos/financeiroAdmin)
  const materialSrc = src.material && typeof src.material === "object" ? src.material : {};
  return {
    version: typeof src.version === "number" && Number.isFinite(src.version) ? src.version : 1,
    updatedAt: typeof src.updatedAt === "string" ? src.updatedAt : undefined,
    notes: src.notes && typeof src.notes === "object" ? src.notes : undefined,
    material: {
      precoChapaMdf19EurM2: num(materialSrc.precoChapaMdf19EurM2, 31),
      fallbackEurM2: num(materialSrc.fallbackEurM2, 20),
      densidadePadraoKgM3: num(materialSrc.densidadePadraoKgM3, 750),
    },
    ivaPct: num(src.ivaPct, 23),
    orcamentos: normalizeOrcamentosSettings({
      ...(src.orcamentos && typeof src.orcamentos === "object" ? src.orcamentos : {}),
    }),
    financeiroAdmin: normalizeFinanceiroAdminSettings({
      ...(src.financeiroAdmin && typeof src.financeiroAdmin === "object"
        ? src.financeiroAdmin
        : {}),
    }),
    aliases: src.aliases && typeof src.aliases === "object" ? src.aliases : undefined,
  };
}

/** Fetch /config/pricing.json (idempotente). Falha ? builtin (mesmos números). */
export async function loadCentralPricing(url = CENTRAL_PRICING_URL): Promise<CentralPricingFile> {
  if (cached) return cached;
  if (loadPromise) {
    const existing = await loadPromise;
    return existing ?? getBuiltinCentralPricing();
  }
  loadPromise = (async () => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (isHtmlPayload(text)) return null;
      const parsed = normalizeCentralPricing(JSON.parse(text));
      cached = parsed;
      return parsed;
    } catch {
      return null;
    } finally {
      loadPromise = null;
    }
  })();
  const loaded = await loadPromise;
  if (!loaded) {
    cached = getBuiltinCentralPricing();
    return cached;
  }
  return loaded;
}

export function orcamentosDefaultsFromCentral(pricing?: CentralPricingFile | null): OrcamentosSettings {
  const p = pricing ?? getCentralPricingCached();
  return normalizeOrcamentosSettings(p.orcamentos ?? {});
}

export function financeiroAdminDefaultsFromCentral(
  pricing?: CentralPricingFile | null
): FinanceiroAdminSettings {
  const p = pricing ?? getCentralPricingCached();
  return normalizeFinanceiroAdminSettings(p.financeiroAdmin);
}

export function materialFallbackEurM2FromCentral(pricing?: CentralPricingFile | null): number {
  const p = pricing ?? getCentralPricingCached();
  const n = p.material?.fallbackEurM2;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 20;
}

export function ivaPctFromCentral(pricing?: CentralPricingFile | null): number {
  const p = pricing ?? getCentralPricingCached();
  const n = p.ivaPct;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 23;
}

/** Família viewer / canonical ? chave de chapa no pricing de mercado. */
const CHAPA_KEY_BY_FAMILY: Record<string, string> = {
  mdf_branco: "MDF_BRANCO_LAMINADO_19",
  mdf_preto: "MDF_PRETO_LAMINADO_19",
  carvalho_natural: "CARVALHO_LAMINADO_19",
  carvalho: "CARVALHO_LAMINADO_19",
  agl_carvalho: "CARVALHO_LAMINADO_19",
  hdf_cru: "MDF_CRU_19",
  lacado: "MDF_LACADO_19",
  laminado_linho_cancun: "AGLOMERADO_BRANCO_19",
  nogueira: "CARVALHO_LAMINADO_19",
};

/**
 * Preço €/m² a partir de chapas do pricing.json.
 * Costa / painéis ?10 mm ? MDF_BRANCO_10 / MDF_CRU (20 €/m²).
 * Espessuras intermédias (&lt;19) aplicam espessuraReducaoPct.
 */
export function chapaEurM2FromCentral(
  materialKey: string,
  espessuraMm: number,
  pricing?: CentralPricingFile | null
): number | null {
  const p = pricing ?? getCentralPricingCached();
  const chapas = p.chapas;
  if (!chapas) return null;

  const keyNorm = String(materialKey || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const family = keyNorm.replace(/-\d+(\.\d+)?$/, "").replace(/_\d+(\.\d+)?$/, "");
  const chapaKey = CHAPA_KEY_BY_FAMILY[family] ?? CHAPA_KEY_BY_FAMILY[keyNorm];

  // Costa / 10 mm: preço dedicado (não 31–0.95).
  if (espessuraMm > 0 && espessuraMm <= 10.5) {
    const thinBranco = num(
      (chapas as Record<string, number>).MDF_BRANCO_10,
      num(chapas.MDF_CRU_19, 20)
    );
    if (
      !family ||
      family.includes("mdf_branco") ||
      family.includes("branco") ||
      family === "mdf" ||
      keyNorm.includes("costa")
    ) {
      return thinBranco;
    }
    if (family.includes("cru") || family.includes("hdf")) {
      return num(chapas.MDF_CRU_19, thinBranco);
    }
  }

  let base: number | undefined;
  let refMm = 19;

  if (family === "hdf_cru" && espessuraMm > 0 && espessuraMm <= 5) {
    base = chapas.HDF_CRU_3;
    refMm = 3;
  } else if (chapaKey && typeof chapas[chapaKey] === "number") {
    base = chapas[chapaKey];
    if (chapaKey.includes("_18")) refMm = 18;
    else if (chapaKey.includes("_3")) refMm = 3;
    else refMm = 19;
  }

  if (base == null || !Number.isFinite(base)) return null;

  const reducao = num(chapas.espessuraReducaoPct, 0.95);
  if (espessuraMm > 0 && espessuraMm < refMm - 0.5) {
    return base * reducao;
  }
  return base;
}

export function orlaEurMFromCentral(
  kind: "PVC_BRANCO_1" | "PVC_CARVALHO_1" | "MELAMINA_05" | "FOLHA_MADEIRA_05",
  pricing?: CentralPricingFile | null
): number | null {
  const p = pricing ?? getCentralPricingCached();
  const v = p.orlas?.[kind];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
