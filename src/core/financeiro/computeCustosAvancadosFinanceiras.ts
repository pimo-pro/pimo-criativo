/**
 * P3.9 F3c — chapas reais / mão de obra / logística (modos exclusivos).
 * Não altera CNC/TCN/cutlist/drill/PDFs industriais nem portes P3.6.
 */

import type { CutListItemComPreco } from "../types";
import { getSettings } from "../settings/settingsService";
import type {
  OrcamentosCustosIndustriaisSettings,
  OrcamentosMaterialCostMode,
} from "../orcamentos";

export type CustosAvancadosTarifas = Pick<
  OrcamentosCustosIndustriaisSettings,
  | "materialCostMode"
  | "custoChapaReal"
  | "valorHoraMaquina"
  | "custoLogisticaPorKg"
  | "enableMaoDeObra"
  | "enableLogistica"
>;

export type CustosAvancadosFinanceirasResult = {
  materialCostMode: OrcamentosMaterialCostMode;
  /** true → Unificado/Peças devem zerar paineis/portas/remates (não gavetas = montagem). */
  suppressPieceMaterial: boolean;
  chapasCount: number;
  precoChapasReais: number;
  /** Legado: deixou de estimar minutos; permanece 0 (MO = EUR manual). */
  minutosEstimados: number;
  precoMaoDeObra: number;
  pesoTotalKg: number;
  precoLogistica: number;
  chapasByPieceId: Map<string, number>;
  maoDeObraByPieceId: Map<string, number>;
  logisticaByPieceId: Map<string, number>;
  warnings: string[];
  /** Valor EUR manual aplicado (campo legado valorHoraMaquina). */
  valorHoraMaquinaUsed: number;
  /** Sempre false — fallback SystemSettings removido. */
  valorHoraFromSystemFallback: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function numTarifa(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function boolFlag(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function pieceAreaMm2(item: CutListItemComPreco): number {
  const w = item.dimensoes?.largura ?? 0;
  const h = item.dimensoes?.altura ?? 0;
  const qty = item.quantidade ?? 1;
  if (w <= 0 || h <= 0) return 0;
  return w * h * qty;
}

export function resolveCustosAvancadosTarifas(
  override?: Partial<CustosAvancadosTarifas> | null
): CustosAvancadosTarifas {
  const fromSettings = (() => {
    try {
      return getSettings().orcamentos?.custosIndustriais;
    } catch {
      return undefined;
    }
  })();
  const src = { ...fromSettings, ...override };
  const mode =
    src.materialCostMode === "por_chapas_reais" ? "por_chapas_reais" : "por_peca";
  return {
    materialCostMode: mode,
    // Legado Admin ignorado no cálculo; o valor efectivo vem de deriveCustoChapaReal.
    custoChapaReal: 0,
    valorHoraMaquina: numTarifa(src.valorHoraMaquina),
    custoLogisticaPorKg: numTarifa(src.custoLogisticaPorKg),
    enableMaoDeObra: boolFlag(src.enableMaoDeObra, false),
    enableLogistica: boolFlag(src.enableLogistica, false),
  };
}

function reconcileMaps(
  map: Map<string, number>,
  target: number,
  order: Array<{ id: string; weight: number }>
): void {
  if (!(target > 0) || map.size === 0) return;
  let sum = 0;
  for (const v of map.values()) sum += v;
  sum = round2(sum);
  const delta = round2(target - sum);
  if (Math.abs(delta) < 0.005) return;
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i].id;
    if (!(order[i].weight > 0) || !id || !map.has(id)) continue;
    map.set(id, round2((map.get(id) ?? 0) + delta));
    break;
  }
}

function rateioByWeight(
  cutlist: CutListItemComPreco[],
  totalEur: number,
  weightOf: (item: CutListItemComPreco) => number
): Map<string, number> {
  const map = new Map<string, number>();
  if (!(totalEur > 0) || cutlist.length === 0) return map;
  const rows = cutlist.map((item) => ({
    id: String(item.id ?? ""),
    weight: weightOf(item),
  }));
  const sumW = rows.reduce((s, r) => s + r.weight, 0);
  if (!(sumW > 0)) return map;
  for (const { id, weight } of rows) {
    if (!(weight > 0) || !id) continue;
    map.set(id, round2(totalEur * (weight / sumW)));
  }
  reconcileMaps(map, totalEur, rows);
  return map;
}

/**
 * Calcula chapas (oficial ou estimado preliminar) / MO / logística e rateios por peça.
 * `por_chapas_reais` + € de chapas → suppressPieceMaterial (anti double-count).
 */
export function computeCustosAvancadosFinanceiras(input: {
  cutlist: CutListItemComPreco[];
  /** Nº chapas (oficial ou estimado). 0 → sem monetização por chapas. */
  chapasCount: number;
  /** true se nesting oficial TCN/PRO (afeta só warnings; € usa N/sheets igualmente). */
  chapasModeReal: boolean;
  pesoTotalKg: number;
  /** Peso por pieceId (mesma base do Unificado). */
  pesoByPieceId?: Map<string, number>;
  tarifas?: Partial<CustosAvancadosTarifas> | null;
  /**
   * Custo €/chapa derivado de €/m² (Painéis) × área chapa padrão.
   * Sem este valor (e sem precoChapasSheetsEur), chapasReais permanece 0 no modo exclusivo.
   */
  custoChapaRealDerived?: number;
  /**
   * Quando há sheets oficiais: € = priceChapasSheetsEur(sheets).
   * Tem prioridade sobre N × custoChapaRealDerived.
   */
  precoChapasSheetsEur?: number;
}): CustosAvancadosFinanceirasResult {
  const tarifas = resolveCustosAvancadosTarifas(input.tarifas);
  const cutlist = input.cutlist ?? [];
  const chapasCount =
    typeof input.chapasCount === "number" && Number.isFinite(input.chapasCount)
      ? Math.max(0, Math.floor(input.chapasCount))
      : 0;
  const pesoTotalKg =
    typeof input.pesoTotalKg === "number" && Number.isFinite(input.pesoTotalKg)
      ? Math.max(0, input.pesoTotalKg)
      : 0;

  const warnings: string[] = [];
  const wantsChapasReais = tarifas.materialCostMode === "por_chapas_reais";

  // --- Chapas reais ---
  // Suppress quando há € de chapas (oficial TCN/PRO OU estimado preliminar).
  // Sem N e sem €/chapa → fallback Painéis por peça (avisos).
  let precoChapasReais = 0;
  const custoChapa =
    typeof input.custoChapaRealDerived === "number" && Number.isFinite(input.custoChapaRealDerived)
      ? Math.max(0, input.custoChapaRealDerived)
      : 0;
  const sheetsEur =
    typeof input.precoChapasSheetsEur === "number" && Number.isFinite(input.precoChapasSheetsEur)
      ? Math.max(0, input.precoChapasSheetsEur)
      : 0;
  if (wantsChapasReais) {
    if (sheetsEur > 0) {
      // Σ sheets × €/m² — oficial ou nesting fast estimado (sem desconto artificial).
      precoChapasReais = round2(sheetsEur);
      if (!input.chapasModeReal) {
        warnings.push(
          `estimado preliminar: Σ sheets × €/m² = ${precoChapasReais} € (pode diferir do TCN/PRO)`
        );
      }
    } else if (chapasCount > 0 && custoChapa > 0) {
      // N × €/chapa derivado — oficial sem sheetsEur, ou estimado por área/N.
      precoChapasReais = round2(chapasCount * custoChapa);
      if (!input.chapasModeReal) {
        warnings.push(
          `estimado preliminar: N=${chapasCount} × €/chapa=${custoChapa} (pode diferir do TCN/PRO)`
        );
      }
    } else if (!(chapasCount > 0)) {
      warnings.push(
        "materialCostMode=por_chapas_reais sem chapas reais → chapasReais=0; fallback Painéis por peça"
      );
    } else {
      warnings.push(
        "custoChapaReal derivado=0 (sem €/m² ou área chapa) → chapasReais=0; fallback Painéis por peça"
      );
    }
  }
  const suppressPieceMaterial = precoChapasReais > 0;

  // --- Mão de obra (EUR manual Admin; independente de tempo / montagem) ---
  // Campo legado `valorHoraMaquina` = total EUR manual (não €/h × minutos).
  // Sem valor Admin (>0) e flag off → sempre 0 (sem peças/furos/fallback).
  const minutosEstimados = 0;
  let precoMaoDeObra = 0;
  let valorHoraMaquinaUsed = 0;
  const valorHoraFromSystemFallback = false;
  const manualMoEur = tarifas.valorHoraMaquina;
  if (tarifas.enableMaoDeObra && manualMoEur > 0) {
    precoMaoDeObra = round2(manualMoEur);
    valorHoraMaquinaUsed = precoMaoDeObra;
  }

  // --- Logística (EUR manual Admin; independente de portes / peso) ---
  // Campo legado `custoLogisticaPorKg` = total EUR manual (não €/kg × peso).
  // Sem valor Admin (>0) e flag off → sempre 0 (sem peso × tarifa).
  let precoLogistica = 0;
  const manualLogEur = tarifas.custoLogisticaPorKg;
  if (tarifas.enableLogistica && manualLogEur > 0) {
    precoLogistica = round2(manualLogEur);
  }

  const chapasByPieceId = rateioByWeight(cutlist, precoChapasReais, pieceAreaMm2);
  const maoDeObraByPieceId = rateioByWeight(cutlist, precoMaoDeObra, pieceAreaMm2);
  const logisticaByPieceId = rateioByWeight(cutlist, precoLogistica, (item) => {
    const id = String(item.id ?? "");
    if (input.pesoByPieceId?.has(id)) return input.pesoByPieceId.get(id) ?? 0;
    return pieceAreaMm2(item); // fallback área se sem peso
  });

  return {
    materialCostMode: tarifas.materialCostMode,
    suppressPieceMaterial,
    chapasCount,
    precoChapasReais,
    minutosEstimados,
    precoMaoDeObra,
    pesoTotalKg,
    precoLogistica,
    chapasByPieceId,
    maoDeObraByPieceId,
    logisticaByPieceId,
    warnings,
    valorHoraMaquinaUsed,
    valorHoraFromSystemFallback,
  };
}

/** Assert de testes: material peça e chapas reais não coexistem. */
export function assertNoMaterialDoubleCount(input: {
  pieceMaterialSum: number;
  chapasReais: number;
}): void {
  const piece = Number(input.pieceMaterialSum) || 0;
  const chapas = Number(input.chapasReais) || 0;
  if (piece > 0 && chapas > 0) {
    throw new Error(
      `anti-double-count: pieceMaterial=${piece} e chapasReais=${chapas} não podem coexistir`
    );
  }
}
