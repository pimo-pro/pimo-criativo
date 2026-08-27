/**
 * Snapshot da última geração TCN/PRO bem-sucedida («Gerar arquivo completo»).
 * SSOT do Relatório: chapas+ferragens (F0–F2) + custosEffective (F4).
 */

import type { FerragemUnificadoLineSsot } from "../financeiro/ferragensUnificadoLines";
import {
  computeFerragensUnificadoSsot,
  type FerragensUnificadoProjectSlice,
} from "../financeiro/ferragensUnificadoLines";
import {
  computeFinanceiroUnificado,
  type FinanceiroUnificadoProjectSlice,
} from "../financeiro/financeiroUnificado";
import type { FinanceiroCustoKey } from "../financeiro/financeiroUnificadoTypes";
import { FINANCEIRO_CUSTO_KEYS } from "../financeiro/financeiroUnificadoTypes";
import type { MaterialIndustrial } from "../manufacturing/materials";
import { asObject } from "../projects/projectsMappers";
import {
  buildChapasSummaryFromProBundles,
  type ProLayoutBundleForChapas,
} from "./chapasSummaryFromProBundles";
import type { ChapasRealSummary } from "./computeChapasReal";
import { isChapasRealOficial } from "./computeChapasReal";

export const PRODUCTION_RELEASE_VERSION = 1 as const;

export type ProductionReleaseChapas = Omit<ChapasRealSummary, "layout">;

export type ProductionReleaseFerragens = {
  totalEur: number;
  totalQty: number;
  lines: FerragemUnificadoLineSsot[];
};

export type ProductionReleaseCustos = Record<FinanceiroCustoKey, number>;

/** Origem das linhas congeladas via Unificado (F4). */
export type ProductionReleaseCustosOrigem = "oficial" | "estimado_fallback";

export type ProductionRelease = {
  version: typeof PRODUCTION_RELEASE_VERSION;
  generatedAt: string;
  projectId: string;
  chapas: ProductionReleaseChapas;
  ferragens: ProductionReleaseFerragens;
  /** custosEffective do motor ADMIN no instante do ZIP. Ausente = releases F0–F2. */
  custos?: ProductionReleaseCustos;
  ivaPct?: number;
  /** oficial = Unificado leu PRO store; estimado_fallback = FAST/vazio no freeze. */
  custosOrigem?: ProductionReleaseCustosOrigem;
};

export type BuildProductionReleaseInput = {
  projectId: string;
  generatedAt: string;
  bundles: ReadonlyArray<ProLayoutBundleForChapas>;
  project: FerragensUnificadoProjectSlice &
    FinanceiroUnificadoProjectSlice & {
      boxes?: Array<{ id: string; nome?: string }>;
    };
  materials?: ReadonlyArray<MaterialIndustrial>;
};

export function isProductionRelease(value: unknown): value is ProductionRelease {
  const obj = asObject(value);
  if (!obj) return false;
  if (obj.version !== PRODUCTION_RELEASE_VERSION) return false;
  if (typeof obj.generatedAt !== "string" || !obj.generatedAt.trim()) return false;
  if (typeof obj.projectId !== "string" || !obj.projectId.trim()) return false;
  const chapas = asObject(obj.chapas);
  const ferragens = asObject(obj.ferragens);
  if (!chapas || !ferragens) return false;
  if (!Array.isArray(chapas.sheets)) return false;
  if (!Array.isArray(ferragens.lines)) return false;
  return true;
}

export function productionReleaseHasCustos(release: ProductionRelease): boolean {
  return release.custos != null && typeof release.custos === "object";
}

export function buildProductionRelease(
  input: BuildProductionReleaseInput
): ProductionRelease | null {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) return null;

  const chapas = buildChapasSummaryFromProBundles({
    bundles: input.bundles ?? [],
    projectName: input.project.projectName ?? "Projeto",
    boxes: input.project.boxes ?? [],
  });
  if (chapas.mode !== "oficial_pro" || chapas.totalSheets <= 0) return null;

  const { layout: _omitLayout, ...chapasSemLayout } = chapas;
  const ferragensSsot = computeFerragensUnificadoSsot(input.project);

  const snap = computeFinanceiroUnificado(input.project, [...(input.materials ?? [])]);
  const custos = {} as ProductionReleaseCustos;
  for (const key of FINANCEIRO_CUSTO_KEYS) {
    custos[key] = Number(snap.custosEffective[key]) || 0;
  }
  const custosOrigem: ProductionReleaseCustosOrigem = isChapasRealOficial(snap.chapas.mode)
    ? "oficial"
    : "estimado_fallback";

  return {
    version: PRODUCTION_RELEASE_VERSION,
    generatedAt: input.generatedAt,
    projectId,
    chapas: chapasSemLayout,
    ferragens: {
      totalEur: ferragensSsot.totalEur,
      totalQty: ferragensSsot.totalQty,
      lines: ferragensSsot.lines,
    },
    custos,
    ivaPct: snap.ivaPct,
    custosOrigem,
  };
}
