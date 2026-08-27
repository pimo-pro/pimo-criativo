/**
 * P3.17 / P3.25 / P3.26 / P3.27 — Mapper SSOT Unificado → shape do Relatório Final.
 * Totais oficiais do Unificado; detalhe = camada visual (P3.27 / provenance Fase 2).
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

import { isReportFinanceiroProvenanceEnabled } from "../features";
import { ensureFinanceiroShape } from "./financeReportCalc";
import { syncWithUnificado } from "./financeiroDynamicEngine";
import {
  applyDetalheProvenanceForKey,
  buildLineOverrideMeta,
  classifyLegacyLineOverrides,
  filterFerragensOverridesToKeep,
  FINANCEIRO_PROVENANCE_VERSION,
  needsFinanceiroProvenanceMigration,
} from "./financeiroDetalheProvenance";
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
import { buildOrlaDetalheFromState } from "./orlaReport";
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

const PROVENANCE_SKIP_KEYS = new Set<string>([
  "iva",
  "total",
  "margemGanho",
  "paineis",
  "chapasReais",
  "ferragens",
]);

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
   * Flag off: preserve cego. Flag on: input de classificação provenance.
   */
  preserveDetalheByKey?: Partial<Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>>;
  /** Overrides de item Ferragens (camada visual). */
  ferragensOverrides?: ReportFerragensOverridesMap | null;
  /** Margem de ganho persistida no relatório. */
  margemGanho?: ReportMargemGanhoConfig | null;
  /** Financeiro de origem (provenanceVersion / 1ª migração). */
  sourceFinanceiro?: ProjectReportFinanceiro | null;
};

function ssotDetalheForKey(
  key: FinanceiroCustoKey,
  state: ProjectState
): ReportFinanceiroDetalhe[] {
  if (key === "orla") return buildOrlaDetalheFromState(state);
  return [];
}

function applyLineOverridesAndMargem(
  fin: ProjectReportFinanceiro,
  opts: BuildLiveReportFinanceiroOptions
): ProjectReportFinanceiro {
  let next = fin;
  const overrides = normalizeReportLineOverrides(
    opts.lineOverrides ?? next.lineOverrides
  );
  if (Object.keys(overrides).length > 0) {
    next = applyReportLineOverrides(next, overrides);
  }
  const margem =
    opts.margemGanho !== undefined ? opts.margemGanho ?? undefined : next.margemGanho;
  return finalizeReportFinanceiro({ ...next, margemGanho: margem });
}

/** Caminho legado P3.27 — preserve cego (flag off). */
function buildLiveLegacyPreserve(
  state: ProjectState,
  fin: ProjectReportFinanceiro,
  opts: BuildLiveReportFinanceiroOptions
): ProjectReportFinanceiro {
  let next = fin;
  const preservedPaineis = opts.preserveDetalheByKey?.paineis;
  if (preservedPaineis && preservedPaineis.length > 0) {
    next = withPaineisChapasDetalhe(next, preservedPaineis);
  } else if (opts.attachChapasDetalhe !== false) {
    const projectId =
      opts.projectId || String(state.projectName || "").trim() || "";
    if (projectId) {
      const detalhe = buildPaineisChapasDetalhe(projectId, state);
      if (detalhe.length > 0) {
        next = withPaineisChapasDetalhe(next, detalhe);
      }
    }
  }

  if (opts.preserveDetalheByKey) {
    next = {
      ...next,
      linhas: next.linhas.map((l) => {
        if (
          l.key === "iva" ||
          l.key === "total" ||
          l.key === "paineis" ||
          l.key === "ferragens"
        ) {
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

  const ferragensOv = opts.ferragensOverrides ?? next.overrides?.ferragens;
  const preservedFerragens = opts.preserveDetalheByKey?.ferragens;
  const unificadoFerragens = collectUnificadoFerragens(state);
  const hasFerragensOv = Boolean(ferragensOv && Object.keys(ferragensOv).length > 0);
  if (preservedFerragens && (preservedFerragens.length > 0 || hasFerragensOv)) {
    next = persistFerragensVisual(
      { ...next, overrides: { ...(next.overrides ?? {}), ferragens: ferragensOv } },
      preservedFerragens,
      unificadoFerragens
    );
  } else if (unificadoFerragens.length > 0) {
    const visual = buildFerragensVisual(unificadoFerragens, ferragensOv);
    next = persistFerragensVisual(next, visualToDetalhe(visual), unificadoFerragens);
  }

  return applyLineOverridesAndMargem(next, opts);
}

/** Caminho provenance (flag on): SSOT + merge; Ferragens = Fix 3. */
function buildLiveWithProvenance(
  state: ProjectState,
  fin: ProjectReportFinanceiro,
  opts: BuildLiveReportFinanceiroOptions
): ProjectReportFinanceiro {
  const legacy = opts.preserveDetalheByKey ?? {};
  const firstMigration = needsFinanceiroProvenanceMigration(opts.sourceFinanceiro);
  let next = fin;

  const projectId =
    opts.projectId || String(state.projectName || "").trim() || "";
  if (opts.attachChapasDetalhe !== false && projectId) {
    const ssotPaineis = buildPaineisChapasDetalhe(projectId, state);
    const mergedPaineis = applyDetalheProvenanceForKey({
      key: "paineis",
      legacy: legacy.paineis,
      ssot: ssotPaineis,
      firstMigration,
    });
    if (mergedPaineis.length > 0) {
      next = withPaineisChapasDetalhe(next, mergedPaineis);
    }
  }

  next = {
    ...next,
    linhas: next.linhas.map((l) => {
      if (PROVENANCE_SKIP_KEYS.has(String(l.key))) return l;
      const key = l.key as FinanceiroCustoKey;
      const ssotDetalhe = ssotDetalheForKey(key, state);
      const merged = applyDetalheProvenanceForKey({
        key,
        legacy: legacy[key],
        ssot: ssotDetalhe,
        firstMigration,
      });
      return { ...l, detalhe: merged };
    }),
  };

  const ferragensOv = filterFerragensOverridesToKeep(
    opts.ferragensOverrides ?? opts.sourceFinanceiro?.overrides?.ferragens
  );
  const unificadoFerragens = collectUnificadoFerragens(state);
  const visual = buildFerragensVisual(unificadoFerragens, ferragensOv);
  next = persistFerragensVisual(
    { ...next, overrides: { ...(next.overrides ?? {}), ferragens: ferragensOv } },
    visualToDetalhe(visual),
    unificadoFerragens
  );

  next = applyLineOverridesAndMargem(next, {
    ...opts,
    lineOverrides: opts.lineOverrides,
  });

  // Fase 3: meta informativa — NUNCA remove lineOverrides
  const ovMap = normalizeReportLineOverrides(
    opts.lineOverrides ?? next.lineOverrides
  );
  if (Object.keys(ovMap).length > 0) {
    const officialByKey: Partial<Record<FinanceiroCustoKey, number>> = {};
    for (const key of FINANCEIRO_CUSTO_KEYS) {
      const v = next.officialSnapshot?.[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        officialByKey[key] = v;
      }
    }
    const classifications = classifyLegacyLineOverrides(ovMap, officialByKey, {
      legacyDetalheByKey: legacy,
    });
    next = {
      ...next,
      lineOverrideMeta: buildLineOverrideMeta(classifications),
    };
  }

  if (firstMigration) {
    next = { ...next, provenanceVersion: FINANCEIRO_PROVENANCE_VERSION };
  } else if (opts.sourceFinanceiro?.provenanceVersion != null) {
    next = {
      ...next,
      provenanceVersion: opts.sourceFinanceiro.provenanceVersion,
    };
  }

  return next;
}

/** Financeiro do Relatório sempre live a partir do Unificado (P3.25–P3.27). */
export function buildLiveReportFinanceiro(
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = loadMaterialsForFinanceiro(),
  opts: BuildLiveReportFinanceiroOptions = {}
): ProjectReportFinanceiro {
  if (!state) return ensureFinanceiroShape(null);
  try {
    const snap = computeFinanceiroUnificado(state, materials);
    const fin = snapshotToReportFinanceiro(snap);

    if (isReportFinanceiroProvenanceEnabled()) {
      return buildLiveWithProvenance(state, fin, opts);
    }
    return buildLiveLegacyPreserve(state, fin, opts);
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

/** Substitui o bloco financeiro do relatório pelo SSOT ADMIN (live) + detalhe. */
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
    sourceFinanceiro: report.financeiro,
  });
  return {
    ...report,
    financeiro: live,
    painelContagens: buildRelatorioPainelContagens(report, state),
  };
}
