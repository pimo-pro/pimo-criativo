/**
 * P3.17 / P3.25 / P3.26 / P3.27 — Mapper SSOT Unificado → shape do Relatório Final.
 * Totais oficiais do Unificado; detalhe = camada visual preservável (P3.27).
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
import { syncWithUnificado } from "./financeiroDynamicEngine";
import { finalizeReportFinanceiro } from "./financeiroMargemGanho";
import {
  applyReportLineOverrides,
  normalizeReportLineOverrides,
  officialPaineisTotal,
  resolvePaineisOrigem,
  type ReportLineOverrides,
} from "./financeiroOverrides";
import {
  buildFerragensVisual,
  collectUnificadoFerragens,
  persistFerragensVisual,
  visualToDetalhe,
} from "./financeiroFerragensEngine";
import { buildPaineisChapasDetalhe, withPaineisChapasDetalhe } from "./paineisChapasDetalhe";
import { buildRelatorioPainelContagens } from "./relatorioPainelContagens";
import {
  FINANCEIRO_REPORT_LABELS,
  PROJECT_REPORT_IVA_DEFAULT,
  type ProjectReport,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportFinanceiroLinha,
  type ReportFerragensOverridesMap,
  type ReportMargemGanhoConfig,
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

  const fin: ProjectReportFinanceiro = {
    ivaPct,
    linhas,
    subtotal: round2(snap.subtotal),
    ivaValor: round2(snap.ivaValor),
    totalProjeto: round2(snap.totalProjeto),
    paineisOrigem: resolvePaineisOrigem(snap),
  };
  return finalizeReportFinanceiro({
    ...fin,
    officialSnapshot: syncWithUnificado(fin),
  });
}

export type BuildLiveReportFinanceiroOptions = {
  /** Overrides manuais do Relatório (não alteram o motor Unificado). */
  lineOverrides?: ReportLineOverrides | null;
  /** Anexa detalhe visual de chapas (não altera totais). */
  attachChapasDetalhe?: boolean;
  projectId?: string;
  /**
   * Detalhe visual a preservar (P3.27) — por key.
   * Se a key tiver detalhe, não é regenerado a partir do nesting.
   */
  preserveDetalheByKey?: Partial<Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>>;
  /** Overrides de item Ferragens (camada visual). */
  ferragensOverrides?: ReportFerragensOverridesMap | null;
  /** Margem de ganho persistida no relatório. */
  margemGanho?: ReportMargemGanhoConfig | null;
};

/** Financeiro do Relatório sempre live a partir do Unificado (P3.25–P3.27). */
export function buildLiveReportFinanceiro(
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = loadMaterialsForFinanceiro(),
  opts: BuildLiveReportFinanceiroOptions = {}
): ProjectReportFinanceiro {
  if (!state) return ensureFinanceiroShape(null);
  try {
    const snap = computeFinanceiroUnificado(state, materials);
    let fin = snapshotToReportFinanceiro(snap);

    const preservedPaineis = opts.preserveDetalheByKey?.paineis;
    if (preservedPaineis && preservedPaineis.length > 0) {
      fin = withPaineisChapasDetalhe(fin, preservedPaineis);
    } else if (opts.attachChapasDetalhe !== false) {
      const projectId =
        opts.projectId || String(state.projectName || "").trim() || "";
      if (projectId) {
        const detalhe = buildPaineisChapasDetalhe(projectId, state);
        if (detalhe.length > 0) {
          fin = withPaineisChapasDetalhe(fin, detalhe);
        }
      }
    }

    // Preservar detalhe visual das outras linhas
    if (opts.preserveDetalheByKey) {
      fin = {
        ...fin,
        linhas: fin.linhas.map((l) => {
          if (l.key === "iva" || l.key === "total" || l.key === "paineis" || l.key === "ferragens") {
            return l;
          }
          const key = l.key as FinanceiroCustoKey;
          const preserved = opts.preserveDetalheByKey?.[key];
          if (preserved && preserved.length > 0) {
            return { ...l, detalhe: preserved };
          }
          return l;
        }),
      };
    }

    const ferragensOv = opts.ferragensOverrides ?? fin.overrides?.ferragens;
    const preservedFerragens = opts.preserveDetalheByKey?.ferragens;
    const unificadoFerragens = collectUnificadoFerragens(state);
    const hasFerragensOv = Boolean(ferragensOv && Object.keys(ferragensOv).length > 0);
    if (preservedFerragens && (preservedFerragens.length > 0 || hasFerragensOv)) {
      fin = persistFerragensVisual(
        { ...fin, overrides: { ...(fin.overrides ?? {}), ferragens: ferragensOv } },
        preservedFerragens,
        unificadoFerragens
      );
    } else if (unificadoFerragens.length > 0) {
      const visual = buildFerragensVisual(unificadoFerragens, ferragensOv);
      fin = persistFerragensVisual(fin, visualToDetalhe(visual), unificadoFerragens);
    }

    const overrides = normalizeReportLineOverrides(
      opts.lineOverrides ?? fin.lineOverrides
    );
    if (Object.keys(overrides).length > 0) {
      fin = applyReportLineOverrides(fin, overrides);
    }

    const margem =
      opts.margemGanho !== undefined ? opts.margemGanho ?? undefined : fin.margemGanho;
    fin = finalizeReportFinanceiro({ ...fin, margemGanho: margem });

    return fin;
  } catch {
    return ensureFinanceiroShape(null);
  }
}

function collectPreservedDetalhe(
  report: ProjectReport
): Partial<Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>> {
  const out: Partial<Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>> = {};
  for (const l of report.financeiro?.linhas ?? []) {
    if (l.key === "iva" || l.key === "total" || l.key === "margemGanho") continue;
    if ((l.detalhe?.length ?? 0) > 0) {
      out[l.key as FinanceiroCustoKey] = l.detalhe;
    }
  }
  return out;
}

/** Substitui o bloco financeiro do relatório pelo SSOT ADMIN (live) + detalhe preservado. */
export function withLiveFinanceiro(
  report: ProjectReport,
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = loadMaterialsForFinanceiro()
): ProjectReport {
  const live = buildLiveReportFinanceiro(state, materials, {
    lineOverrides: report.financeiro?.lineOverrides,
    attachChapasDetalhe: true,
    projectId: report.projectId,
    preserveDetalheByKey: collectPreservedDetalhe(report),
    ferragensOverrides: report.financeiro?.overrides?.ferragens,
    margemGanho: report.financeiro?.margemGanho,
  });
  return {
    ...report,
    financeiro: live,
    painelContagens: buildRelatorioPainelContagens(report, state),
  };
}
