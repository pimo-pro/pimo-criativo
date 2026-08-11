/**
 * P3.22 — financeiroIndustrialRules (fluxo original do Relatório Final).
 * Aplica regras industriais de UI: chapas em Painéis, orla, portas/remates=0.
 * NÃO chama computeFinanceiroUnificado.
 */

import type { ProjectState } from "@/context/projectTypes";
import type { Ferragem } from "@/core/ferragens/ferragens";
import { computeChapasReal } from "@/core/industrial/computeChapasReal";
import { findOfflineProjectByAnyKey } from "@/core/projects/projectIdentity";
import { toSavedRecordFromOffline } from "@/core/projects/projectsMappers";
import { resolveProjectCutlistFromRecord } from "@/industrial/work-orders/resolveProjectCutlistFromRecord";

import { aggregateChapasByEspessura } from "./chapasReport";
import type { FinanceiroAdapterModel } from "./financeiroAdapter";
import { adapterModelToFinanceiroShape } from "./financeiroAdapter";
import { updateFinanceiroLinha } from "./financeReportCalc";
import { ensureFerragensFromMateriais } from "./materiaisSync";
import { buildOrlaDetalheFromState } from "./orlaReport";
import {
  FINANCEIRO_REPORT_LABELS,
  makeReportId,
  type ProjectReportFinanceiro,
  type ReportMaterialLinha,
} from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type FinanceiroIndustrialRulesInput = {
  model: FinanceiroAdapterModel;
  materiais?: ReportMaterialLinha[];
  ferragensCatalog?: Ferragem[];
};

export function seedChapasDetalhe(
  fin: ProjectReportFinanceiro,
  projectId: string,
  state: ProjectState | null
): ProjectReportFinanceiro {
  const paineis = fin.linhas.find((l) => l.key === "paineis");
  const chapasLegado = fin.linhas.find((l) => l.key === "chapasReais");
  if ((paineis?.detalhe?.length ?? 0) === 0 && (chapasLegado?.detalhe?.length ?? 0) > 0) {
    return updateFinanceiroLinha(fin, "paineis", { detalhe: chapasLegado!.detalhe });
  }
  if ((paineis?.detalhe?.length ?? 0) > 0) return fin;

  const offline = findOfflineProjectByAnyKey(projectId);
  if (!offline && !state) return fin;
  try {
    const ctx = offline
      ? resolveProjectCutlistFromRecord(toSavedRecordFromOffline(offline))
      : null;
    const cutlist = (ctx?.cutListItems ?? []).map((item) => ({
      ...item,
      precoUnitario: Number((item as { precoUnitario?: number }).precoUnitario) || 0,
      precoTotal: Number((item as { precoTotal?: number }).precoTotal) || 0,
    }));
    const boxes = (state?.boxes ?? []).map((b) => ({ id: b.id }));
    const chapas = computeChapasReal(
      cutlist,
      state?.projectName || projectId,
      boxes
    );
    if (chapas.mode !== "real" || chapas.sheets.length === 0) return fin;
    const detalhe = aggregateChapasByEspessura(chapas.sheets);
    if (detalhe.length === 0) return fin;
    return updateFinanceiroLinha(fin, "paineis", { detalhe });
  } catch {
    return fin;
  }
}

export function seedOrlaDetalhe(
  fin: ProjectReportFinanceiro,
  state: ProjectState | null
): ProjectReportFinanceiro {
  const orla = fin.linhas.find((l) => l.key === "orla");
  if ((orla?.detalhe?.length ?? 0) > 0) return fin;
  const detalhe = buildOrlaDetalheFromState(state);
  if (detalhe.length === 0) {
    const total = Number(orla?.total) || 0;
    if (!(total > 0)) return fin;
    return updateFinanceiroLinha(fin, "orla", {
      detalhe: [
        {
          id: makeReportId("or"),
          tipo: "Orla",
          dimensoes: "m",
          quantidade: Number(orla?.quantidade) || 1,
          precoUnitario:
            orla?.precoUnitario != null
              ? Number(orla.precoUnitario)
              : Number(orla?.quantidade)
                ? round2(total / Number(orla.quantidade))
                : total,
          total,
        },
      ],
    });
  }
  return updateFinanceiroLinha(fin, "orla", { detalhe });
}

/** Portas/Remates = 0 €; labels industriais. */
export function applyIndustrialReportLinhas(fin: ProjectReportFinanceiro): ProjectReportFinanceiro {
  return {
    ...fin,
    linhas: fin.linhas.map((l) => {
      const label =
        l.key in FINANCEIRO_REPORT_LABELS
          ? FINANCEIRO_REPORT_LABELS[l.key as keyof typeof FINANCEIRO_REPORT_LABELS]
          : l.label;
      if (l.key === "portas" || l.key === "remates") {
        return {
          ...l,
          label,
          quantidade: null,
          precoUnitario: null,
          total: 0,
          detalhe: [],
        };
      }
      return { ...l, label };
    }),
  };
}

/**
 * Aplica regras industriais ao modelo adaptado → shape de relatório com detalhe UI.
 */
export function financeiroIndustrialRules(
  input: FinanceiroIndustrialRulesInput
): ProjectReportFinanceiro {
  const { model, materiais = [], ferragensCatalog = [] } = input;
  let fin = adapterModelToFinanceiroShape(model);
  fin = seedChapasDetalhe(fin, model.projectId, model.state);
  fin = seedOrlaDetalhe(fin, model.state);
  fin = applyIndustrialReportLinhas(fin);
  const ferr = ensureFerragensFromMateriais(fin, materiais, ferragensCatalog);
  return ferr.financeiro;
}
