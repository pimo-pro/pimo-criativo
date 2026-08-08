/**
 * Seed / helpers de Orla para o Relatório Final (metros × €/m).
 */

import type { ProjectState } from "@/context/projectTypes";
import type { CutListItem } from "@/core/types";
import { computeOrlaFerragem, syncOrlaPiecesForProject } from "@/core/orla/orlaCalculator";
import { DEFAULT_ORLA_PRESETS, normalizeOrlaPresets } from "@/core/orla/orlaPresets";

import { makeReportId, type ReportFinanceiroDetalhe } from "./types";

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Agrega linhas de orla por tipo (preset) para o detalhe financeiro. */
export function buildOrlaDetalheFromState(
  state: ProjectState | null
): ReportFinanceiroDetalhe[] {
  if (!state?.boxes?.length) return [];
  try {
    const orlaPresets = normalizeOrlaPresets(
      Array.isArray(state.orlaPresets) ? state.orlaPresets : DEFAULT_ORLA_PRESETS
    );
    const defaultOrlaId = orlaPresets[0]?.id ?? null;
    const cutlist = (state.boxes ?? []).flatMap((b) => b.cutList ?? []);
    const extrasByBoxId: Record<string, CutListItem[]> = {};
    for (const item of cutlist) {
      const bid = String((item as { boxId?: string }).boxId ?? "");
      if (!bid) continue;
      (extrasByBoxId[bid] ??= []).push(item);
    }
    const boxesForOrla = state.boxes.map((box) => {
      if ((box.cutList?.length ?? 0) > 0) return box;
      const fromCutlist = cutlist.filter(
        (i) => String((i as { boxId?: string }).boxId ?? "") === box.id
      );
      return { ...box, cutList: fromCutlist };
    });
    const orlaPieces = syncOrlaPiecesForProject(
      boxesForOrla,
      state.orlaPieces ?? {},
      defaultOrlaId,
      extrasByBoxId,
      orlaPresets
    );
    const ferragem = computeOrlaFerragem({
      boxes: boxesForOrla,
      orlaPresets,
      orlaPieces,
      orlaJuntoPairs: state.orlaJuntoPairs ?? [],
      extraCutListItems: cutlist as Array<CutListItem & { boxId?: string; boxNome?: string }>,
    });

    const byPreset = new Map<
      string,
      { tipo: string; metros: number; custo: number; precoPorMetro: number }
    >();
    for (const linha of ferragem.linhas) {
      const key = linha.presetId || linha.presetNome;
      const preset = orlaPresets.find((p) => p.id === linha.presetId);
      const precoPorMetro = Number(preset?.precoPorMetro) || 0;
      const prev = byPreset.get(key);
      if (prev) {
        prev.metros += Number(linha.metros) || 0;
        prev.custo += Number(linha.custo) || 0;
      } else {
        byPreset.set(key, {
          tipo: linha.presetNome || "Orla",
          metros: Number(linha.metros) || 0,
          custo: Number(linha.custo) || 0,
          precoPorMetro,
        });
      }
    }

    return [...byPreset.values()]
      .filter((r) => r.metros > 0 || r.custo > 0)
      .map((r) => {
        const quantidade = round2(r.metros);
        const precoUnitario =
          r.precoPorMetro > 0
            ? round2(r.precoPorMetro)
            : quantidade > 0
              ? round2(r.custo / quantidade)
              : 0;
        return {
          id: makeReportId("or"),
          tipo: r.tipo,
          dimensoes: "m",
          quantidade,
          precoUnitario,
          total: round2(quantidade * precoUnitario),
        };
      });
  } catch {
    return [];
  }
}

export function recalcOrlaDetalhe(d: ReportFinanceiroDetalhe): ReportFinanceiroDetalhe {
  const quantidade = Math.max(0, Number(d.quantidade) || 0);
  const precoUnitario = Math.max(0, Number(d.precoUnitario) || 0);
  return {
    ...d,
    dimensoes: d.dimensoes || "m",
    quantidade,
    precoUnitario,
    total: round2(quantidade * precoUnitario),
  };
}
