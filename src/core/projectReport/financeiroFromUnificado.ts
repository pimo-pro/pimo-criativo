/**
 * P3.17 / P3.25 / P3.26 — Mapper SSOT Unificado → shape do Relatório Final.
 * Totais/IVA copiados do snapshot. Detalhe de chapas = só visualização.
 */

import type { ProjectState } from "@/context/projectTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import {
  FINANCEIRO_CUSTO_KEYS,
  type FinanceiroCustoKey,
  type FinanceiroUnificadoSnapshot,
} from "@/core/financeiro/financeiroUnificadoTypes";
import type { MaterialIndustrial } from "@/core/manufacturing/materials";
import { listIndustrialWoodMaterials } from "@/core/materials/materials.api";
import { safeGetItem } from "@/utils/storage";

import { ensureFinanceiroShape } from "./financeReportCalc";
import {
  applyReportLineOverrides,
  normalizeReportLineOverrides,
  officialPaineisTotal,
  resolvePaineisOrigem,
  type ReportLineOverrides,
} from "./financeiroOverrides";
import { buildPaineisChapasDetalhe, withPaineisChapasDetalhe } from "./paineisChapasDetalhe";
import {
  FINANCEIRO_REPORT_LABELS,
  PROJECT_REPORT_IVA_DEFAULT,
  type ProjectReport,
  type ProjectReportFinanceiro,
  type ReportFinanceiroLinha,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const MATERIALS_STORAGE_KEY = "pimo_admin_materials";

/** Materiais industriais (mesmo pipeline do Admin / useMaterials). */
export function loadMaterialsForFinanceiro(): MaterialIndustrial[] {
  const defaults: MaterialIndustrial[] = listIndustrialWoodMaterials().map((m) => ({
    id: m.canonicalId,
    nome: m.label,
    espessuraPadrao: m.industrialDefaults?.espessuraPadrao ?? 19,
    custo_m2: m.industrialDefaults?.custo_m2 ?? 0,
    materialPbrId: m.viewerMaterialId as MaterialIndustrial["materialPbrId"],
    larguraChapa: m.industrialDefaults?.larguraChapa,
    alturaChapa: m.industrialDefaults?.alturaChapa,
    densidade: m.industrialDefaults?.densidade,
  }));
  const raw = safeGetItem(MATERIALS_STORAGE_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as MaterialIndustrial[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch {
    return defaults;
  }
}

/** Valor de linha no Relatório = ADMIN (Painéis = paineis + chapasReais). */
export function officialLineTotal(
  snap: FinanceiroUnificadoSnapshot,
  key: FinanceiroCustoKey
): number {
  if (key === "chapasReais") return 0;
  if (key === "paineis") return officialPaineisTotal(snap);
  if (key === "portas" || key === "remates") return 0;
  return round2(Number(snap.custosEffective[key]) || 0);
}

/**
 * Converte o snapshot do Financeiro Unificado (ADMIN) no formato do Relatório Final.
 * Fonte única: `custosEffective` + `subtotal` / `ivaValor` / `totalProjeto`.
 */
export function snapshotToReportFinanceiro(
  snap: FinanceiroUnificadoSnapshot
): ProjectReportFinanceiro {
  const linhas: ReportFinanceiroLinha[] = FINANCEIRO_CUSTO_KEYS.map((key) => ({
    key,
    label: FINANCEIRO_REPORT_LABELS[key],
    quantidade: null,
    precoUnitario: null,
    total: officialLineTotal(snap, key),
    detalhe: [],
  }));

  const ivaPct =
    typeof snap.ivaPct === "number" && Number.isFinite(snap.ivaPct) && snap.ivaPct >= 0
      ? snap.ivaPct
      : PROJECT_REPORT_IVA_DEFAULT;
  const subtotal = round2(snap.subtotal);
  const ivaValor = round2(snap.ivaValor);
  const totalProjeto = round2(snap.totalProjeto);

  linhas.push({
    key: "iva",
    label: `IVA (${ivaPct}%)`,
    quantidade: null,
    precoUnitario: null,
    total: ivaValor,
    detalhe: [],
  });
  linhas.push({
    key: "total",
    label: "Total do projeto",
    quantidade: null,
    precoUnitario: null,
    total: totalProjeto,
    detalhe: [],
  });

  return {
    ivaPct,
    linhas,
    subtotal,
    ivaValor,
    totalProjeto,
    paineisOrigem: resolvePaineisOrigem(snap),
  };
}

export type BuildLiveReportFinanceiroOptions = {
  /** Overrides manuais do Relatório (não alteram o motor Unificado). */
  lineOverrides?: ReportLineOverrides | null;
  /** Anexa detalhe visual de chapas (não altera totais). */
  attachChapasDetalhe?: boolean;
  projectId?: string;
};

/** Financeiro do Relatório sempre live a partir do Unificado (P3.25/P3.26). */
export function buildLiveReportFinanceiro(
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = loadMaterialsForFinanceiro(),
  opts: BuildLiveReportFinanceiroOptions = {}
): ProjectReportFinanceiro {
  if (!state) return ensureFinanceiroShape(null);
  try {
    const snap = computeFinanceiroUnificado(state, materials);
    let fin = snapshotToReportFinanceiro(snap);

    if (opts.attachChapasDetalhe !== false) {
      const projectId =
        opts.projectId ||
        String(state.projectName || "").trim() ||
        "";
      if (projectId) {
        const detalhe = buildPaineisChapasDetalhe(projectId, state);
        if (detalhe.length > 0) {
          fin = withPaineisChapasDetalhe(fin, detalhe);
        }
      }
    }

    const overrides = normalizeReportLineOverrides(
      opts.lineOverrides ?? fin.lineOverrides
    );
    if (Object.keys(overrides).length > 0) {
      fin = applyReportLineOverrides(fin, overrides);
    }

    return fin;
  } catch {
    return ensureFinanceiroShape(null);
  }
}

/** Substitui o bloco financeiro do relatório pelo SSOT ADMIN (live). */
export function withLiveFinanceiro(
  report: ProjectReport,
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = loadMaterialsForFinanceiro()
): ProjectReport {
  const live = buildLiveReportFinanceiro(state, materials, {
    lineOverrides: report.financeiro?.lineOverrides,
    attachChapasDetalhe: true,
    projectId: report.projectId,
  });
  return {
    ...report,
    financeiro: live,
  };
}
