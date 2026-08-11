/**
 * Secção 4 Materiais = fonte única da linha Ferragens do Financeiro.
 */

import type { Ferragem } from "@/core/ferragens/ferragens";

import { sanitizeFinanceiroDetalhe, isInvalidFinanceiroDetalheTipo } from "./financeiroDetalheSanitize";
import { recalcFinanceiro, updateFinanceiroLinha } from "./financeReportCalc";
import {
  makeReportId,
  type ProjectReportFinanceiro,
  type ReportFinanceiroDetalhe,
  type ReportMaterialLinha,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function getFerragensDetalhe(fin: ProjectReportFinanceiro): ReportFinanceiroDetalhe[] {
  return fin.linhas.find((l) => l.key === "ferragens")?.detalhe ?? [];
}

export function materiaisFromFerragensDetalhe(
  detalhe: ReportFinanceiroDetalhe[]
): ReportMaterialLinha[] {
  return detalhe.map((d) => ({
    id: d.id,
    sourceId: d.id,
    tipo: d.tipo,
    quantidade: d.quantidade,
    observacoes: d.dimensoes || "",
    temErro: false,
    substituicao: "",
  }));
}

export function ferragensDetalheFromMateriais(
  materiais: ReportMaterialLinha[],
  catalog: Ferragem[] = []
): ReportFinanceiroDetalhe[] {
  return materiais
    .filter((m) => !isInvalidFinanceiroDetalheTipo(m.tipo))
    .map((m) => {
      const match = catalog.find(
        (f) =>
          f.nome.toLowerCase() === m.tipo.toLowerCase() ||
          f.id.toLowerCase() === String(m.sourceId ?? "").toLowerCase()
      );
      const precoUnitario = Number(match?.precoUnitario) || 0;
      const quantidade = Math.max(0, Number(m.quantidade) || 0);
      return {
        id: m.id || makeReportId("fd"),
        tipo: m.tipo,
        dimensoes: match?.medidas ?? m.observacoes ?? "",
        quantidade,
        precoUnitario,
        total: round2(quantidade * precoUnitario),
      };
    });
}

/** Atualiza linha ferragens a partir do detalhe e devolve financeiro + espelho materiais. */
export function applyFerragensDetalhe(
  fin: ProjectReportFinanceiro,
  detalhe: ReportFinanceiroDetalhe[]
): { financeiro: ProjectReportFinanceiro; materiais: ReportMaterialLinha[] } {
  const financeiro = updateFinanceiroLinha(fin, "ferragens", { detalhe });
  return {
    financeiro,
    materiais: materiaisFromFerragensDetalhe(getFerragensDetalhe(financeiro)),
  };
}

/** Se ferragens.detalhe vazio e há materiais seed, popula detalhe. */
export function ensureFerragensFromMateriais(
  fin: ProjectReportFinanceiro,
  materiais: ReportMaterialLinha[],
  catalog: Ferragem[] = []
): { financeiro: ProjectReportFinanceiro; materiais: ReportMaterialLinha[] } {
  const existing = sanitizeFinanceiroDetalhe(getFerragensDetalhe(fin));
  if (existing.length > 0) {
    const cleaned = applyFerragensDetalhe(fin, existing);
    return {
      financeiro: recalcFinanceiro(cleaned.financeiro),
      materiais: cleaned.materiais,
    };
  }
  if (materiais.length === 0) {
    return { financeiro: recalcFinanceiro(fin), materiais: [] };
  }
  const detalhe = ferragensDetalheFromMateriais(materiais, catalog);
  return applyFerragensDetalhe(fin, detalhe);
}
