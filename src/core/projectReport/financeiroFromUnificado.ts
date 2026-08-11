/**
 * P3.17 — Mapper SSOT Unificado → shape do Relatório Final.
 * Totais/IVA copiados do snapshot (sem reprecificação nem detalhe que altere totais).
 */

import type { ProjectState } from "@/context/projectTypes";
import { computeFinanceiroUnificado } from "@/core/financeiro/financeiroUnificado";
import {
  FINANCEIRO_CUSTO_KEYS,
  type FinanceiroUnificadoSnapshot,
} from "@/core/financeiro/financeiroUnificadoTypes";
import type { MaterialIndustrial } from "@/core/manufacturing/materials";
import { listIndustrialWoodMaterials } from "@/core/materials/materials.api";
import { safeGetItem } from "@/utils/storage";

import { ensureFinanceiroShape } from "./financeReportCalc";
import {
  FINANCEIRO_REPORT_LABELS,
  PROJECT_REPORT_IVA_DEFAULT,
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

/**
 * Converte o snapshot do Financeiro Unificado (ADMIN) no formato do Relatório Final.
 * Fonte única: `custosEffective` + `subtotal` / `ivaValor` / `totalProjeto` do snap.
 */
export function snapshotToReportFinanceiro(
  snap: FinanceiroUnificadoSnapshot
): ProjectReportFinanceiro {
  const linhas: ReportFinanceiroLinha[] = FINANCEIRO_CUSTO_KEYS.map((key) => ({
    key,
    label: FINANCEIRO_REPORT_LABELS[key],
    quantidade: null,
    precoUnitario: null,
    total: round2(snap.custosEffective[key] ?? 0),
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
  };
}

/** Financeiro do Relatório sempre live a partir do Unificado (P3.17). */
export function buildLiveReportFinanceiro(
  state: ProjectState | null | undefined,
  materials: MaterialIndustrial[] = loadMaterialsForFinanceiro()
): ProjectReportFinanceiro {
  if (!state) return ensureFinanceiroShape(null);
  try {
    return snapshotToReportFinanceiro(computeFinanceiroUnificado(state, materials));
  } catch {
    return ensureFinanceiroShape(null);
  }
}
