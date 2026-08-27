/**
 * Snapshot da última geração TCN/PRO bem-sucedida («Gerar arquivo completo»).
 * SSOT futuro do Relatório (F1/F2). F0 só persiste — não liga o Relatório.
 */

import type { FerragemUnificadoLineSsot } from "../financeiro/ferragensUnificadoLines";
import {
  computeFerragensUnificadoSsot,
  type FerragensUnificadoProjectSlice,
} from "../financeiro/ferragensUnificadoLines";
import { asObject } from "../projects/projectsMappers";
import {
  buildChapasSummaryFromProBundles,
  type ProLayoutBundleForChapas,
} from "./chapasSummaryFromProBundles";
import type { ChapasRealSummary } from "./computeChapasReal";

export const PRODUCTION_RELEASE_VERSION = 1 as const;

export type ProductionReleaseChapas = Omit<ChapasRealSummary, "layout">;

export type ProductionReleaseFerragens = {
  totalEur: number;
  totalQty: number;
  lines: FerragemUnificadoLineSsot[];
};

export type ProductionRelease = {
  version: typeof PRODUCTION_RELEASE_VERSION;
  generatedAt: string;
  projectId: string;
  chapas: ProductionReleaseChapas;
  ferragens: ProductionReleaseFerragens;
};

export type BuildProductionReleaseInput = {
  projectId: string;
  generatedAt: string;
  bundles: ReadonlyArray<ProLayoutBundleForChapas>;
  project: FerragensUnificadoProjectSlice & {
    boxes?: Array<{ id: string; nome?: string }>;
  };
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
  };
}
