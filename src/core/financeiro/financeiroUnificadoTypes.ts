/**
 * P3.5/P3.6 — Financeiro Unificado (tipos SSOT).
 * Overrides + admin settings persistem no projeto.
 */

import {
  defaultFinanceiroAdminSettings,
  normalizeFinanceiroAdminSettings,
  type FinanceiroAdminSettings,
} from "./financeiroAdminRules";

export const FINANCEIRO_IVA_DEFAULT_PCT = 23;

/** estimado = fast/área (A1); oficial_pro = snapshot TCN/PRO; real = legado até unificar no passo 5. */
export type FinanceiroChapasMode = "estimado" | "real" | "oficial_pro";

/** Custos de materiais + administrativos. */
export type FinanceiroCustoKey =
  | "paineis"
  | "portas"
  | "gavetas"
  | "ferragens"
  | "orla"
  | "remates"
  | "operacoes"
  | "desperdicio"
  | "serragem"
  | "chapasReais"
  | "maoDeObra"
  | "logistica"
  | "operacoesAvancadas"
  | "adm"
  | "montagem"
  | "portes";

export type FinanceiroCustoMaterialKey =
  | "paineis"
  | "portas"
  | "gavetas"
  | "ferragens"
  | "orla"
  | "remates"
  | "operacoes"
  | "desperdicio"
  | "serragem"
  | "chapasReais"
  | "maoDeObra"
  | "logistica"
  | "operacoesAvancadas";

export type FinanceiroCustosOverrides = Partial<Record<FinanceiroCustoKey, number | null>>;

/** Overrides editáveis — gravados em `ProjectState.financeiroOverrides`. */
export type FinanceiroOverrides = {
  /** Percentagem de IVA (default 23). */
  ivaPct?: number;
  /** Distância de transporte (km) para cálculo de portes. */
  distanciaKm?: number;
  /**
   * Escolha explícita de incluir portes/transporte no projeto.
   * Sem isto (e sem override manual de custos.portes), Portes = 0.
   */
  incluirPortes?: boolean;
  /** Substitui o custo calculado quando definido (número ? 0). */
  custos?: FinanceiroCustosOverrides;
  notas?: string;
};

export type FinanceiroUnificadoSnapshot = {
  caixas: number;
  pecasTotais: number;
  areaTotalM2: number;
  pesoTotalKg: number;
  /** Volume externo das caixas montadas (transporte). */
  areaTotalMontadoM3: number;
  chapas: {
    count: number;
    mode: FinanceiroChapasMode;
    /** Diagnósticos do nesting fast (fallback / grupos sem layout). */
    diagnostics?: string[];
  };
  desperdicioTotalM2: number;
  serragemTotalM2: number;
  ferragensTotais: number;
  orlaTotalM: number;

  /** Custos derivados (antes de overrides). */
  custosComputed: Record<FinanceiroCustoKey, number>;
  /** Custos após aplicar overrides. */
  custosEffective: Record<FinanceiroCustoKey, number>;
  custoKeysOverridden: FinanceiroCustoKey[];

  ivaPct: number;
  distanciaKm: number;
  /** Soma materiais (sem ADM/montagem/portes/IVA). */
  subtotal: number;
  /** Subtotal materiais + ADM + montagem + portes (base tributável de serviços; IVA só sobre materiais). */
  subtotalComAdmin: number;
  ivaValor: number;
  /** subtotal materiais + ADM + montagem + portes + IVA (sem margem comercial). */
  totalProjeto: number;

  overrides: FinanceiroOverrides;
  adminSettings: FinanceiroAdminSettings;

  /**
   * P3.9 F3a — breakdown CNC/Drill (custosComputed.operacoes = total).
   */
  operacoesBreakdown?: {
    cnc: number;
    drill: number;
    total: number;
  };

  /** P3.9 F3b — warnings STRICT desperdicio/serragem (flags off, waste=0, …). */
  desperdicioSerragemWarnings?: string[];

  /** P3.9 F3c — chapas reais / MO / logística (warnings + modo). */
  custosAvancadosWarnings?: string[];
  materialCostMode?: import("../orcamentos").OrcamentosMaterialCostMode;
  /**
   * Meta UI/PDF: N monetizado + média efectiva €/chapa (totalEur/N).
   * O € oficial em custosEffective.chapasReais é Σ exacto (priceChapasSheetsEur), não N×média.
   * countMonetizado = 0 se nesting estimado (chapasReais€=0).
   */
  chapasReaisMeta?: {
    countMonetizado: number;
    custoChapaDerived: number;
    nestingMode: FinanceiroChapasMode;
  };

  /** P3.9 F4 — breakdown ops industriais avançadas. */
  operacoesAvancadasBreakdown?: {
    foros: number;
    grupos: number;
    rasgos: number;
    cortes: number;
    quadrilha: number;
    total: number;
  };

  /**
   * P3.9 F2 — diagnóstico STRICT da unificação ferragens (só se enableUnificacao).
   * Não afecta CNC/PDF industrial.
   */
  ferragensUnificacao?: {
    enabled: true;
    warnings: import("./priceFerragensFromCatalog").FerragensStrictWarning[];
    fallbacks: import("./priceFerragensFromCatalog").FerragensFallbackUsage[];
    compare?: import("./priceFerragensFromCatalog").CompareFerragensAvsBResult;
  };
};

export const FINANCEIRO_CUSTO_MATERIAL_KEYS: FinanceiroCustoMaterialKey[] = [
  "paineis",
  "portas",
  "gavetas",
  "ferragens",
  "orla",
  "remates",
  "operacoes",
  "desperdicio",
  "serragem",
  "chapasReais",
  "maoDeObra",
  "logistica",
  "operacoesAvancadas",
];

/** Keys de material peç substituídas por chapasReais quando há € de chapas reais.
 * `gavetas` = montagem unitária (não madeira) — não entra na suppress.
 * `remates` mantido na lista por segurança (linha forçada a 0 no Unificado).
 */
export const FINANCEIRO_PIECE_MATERIAL_KEYS: Array<
  Extract<FinanceiroCustoMaterialKey, "paineis" | "portas" | "remates">
> = ["paineis", "portas", "remates"];

export const FINANCEIRO_CUSTO_KEYS: FinanceiroCustoKey[] = [
  ...FINANCEIRO_CUSTO_MATERIAL_KEYS,
  "adm",
  "montagem",
  "portes",
];

export function emptyFinanceiroOverrides(): FinanceiroOverrides {
  return {};
}

export function normalizeFinanceiroOverrides(raw: unknown): FinanceiroOverrides {
  if (!raw || typeof raw !== "object") return emptyFinanceiroOverrides();
  const src = raw as FinanceiroOverrides;
  const out: FinanceiroOverrides = {};

  if (typeof src.ivaPct === "number" && Number.isFinite(src.ivaPct) && src.ivaPct >= 0) {
    out.ivaPct = src.ivaPct;
  }

  if (typeof src.distanciaKm === "number" && Number.isFinite(src.distanciaKm) && src.distanciaKm >= 0) {
    out.distanciaKm = src.distanciaKm;
  }

  if (typeof src.incluirPortes === "boolean") {
    out.incluirPortes = src.incluirPortes;
  }

  if (src.custos && typeof src.custos === "object") {
    const custos: FinanceiroCustosOverrides = {};
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      const v = src.custos[key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        custos[key] = v;
      } else if (v === null) {
        custos[key] = null;
      }
    }
    if (Object.keys(custos).length > 0) out.custos = custos;
  }

  if (typeof src.notas === "string" && src.notas.trim()) {
    out.notas = src.notas.trim();
  }

  return out;
}

export { defaultFinanceiroAdminSettings, normalizeFinanceiroAdminSettings };
export type { FinanceiroAdminSettings };
