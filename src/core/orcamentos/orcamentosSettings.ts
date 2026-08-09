/**
 * P3.9 — defaults + normalização Orçamentos.
 * Day-1: tarifas industriais a 0 / flags off;
 * madeira = chapas reais; ferragens unificadas (catálogo = Secção 4).
 */

import type {
  OrcamentosMargemModo,
  OrcamentosMaterialCostMode,
  OrcamentosMontagemAvancadaModo,
  OrcamentosOperacoesAvancadasSettings,
  OrcamentosSettings,
  OperacaoAvancada,
} from "./orcamentosTypes";
import { ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT } from "./chapasReaisActivation";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOperacoesExtras(raw: unknown): OperacaoAvancada[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: OperacaoAvancada[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) continue;
    out.push({
      id,
      label: typeof item.label === "string" ? item.label : id,
      preco: num(item.preco, 0),
    });
  }
  return out.length > 0 ? out : undefined;
}

export function defaultOperacoesAvancadasSettings(): OrcamentosOperacoesAvancadasSettings {
  return {
    precoForo5mm: 0,
    precoForoCavilha10x13: 0,
    precoForoCavilha10x30: 0,
    precoForoCalcoGrupo: 0,
    precoForoDobradicaGrupo: 0,
    precoRasgoGaveta: 0,
    precoCorteManualPorMetro: 0,
    precoMeQuadrilha: 0,
  };
}

export function defaultOrcamentosSettings(): OrcamentosSettings {
  return {
    perfuracoes: {
      drillEurPorFuro: 0,
      nestingEurPorOperacao: 0,
    },
    custosIndustriais: {
      desperdicioEurPorM2: 0,
      serragemEurPorM2: 0,
      custoChapaReal: 0,
      custoOperacoesEspeciais: 0,
      valorHoraMaquina: 0,
      custoLogisticaPorKg: 0,
      custoMontagemPorPeca: 15,
      materialCostMode: ORCAMENTOS_MATERIAL_COST_MODE_DEFAULT,
      enableDesperdicio: false,
      enableSerragem: false,
      enableLogistica: false,
      enableMaoDeObra: false,
    },
    operacoesAvancadas: defaultOperacoesAvancadasSettings(),
    montagemAvancada: {
      modo: "off",
      precoPorM2: 0,
      precoPorCaixa: 0,
      precoGavetas: 0,
      precoRemate: 0,
      precoFerragensMontagem: 0,
    },
    margemGanho: {
      enabled: false,
      modo: "percentual",
      valor: 0,
    },
    ferragens: {
      enableUnificacao: true,
    },
  };
}

const MATERIAL_MODES: OrcamentosMaterialCostMode[] = ["por_peca", "por_chapas_reais"];
const MONTAGEM_MODOS: OrcamentosMontagemAvancadaModo[] = ["off", "m2", "caixa", "peca"];
const MARGEM_MODOS: OrcamentosMargemModo[] = ["percentual", "fixo"];

export function normalizeOperacoesAvancadasSettings(
  raw: unknown
): OrcamentosOperacoesAvancadasSettings {
  const d = defaultOperacoesAvancadasSettings();
  if (!isObject(raw)) return d;
  const extras = normalizeOperacoesExtras(raw.operacoesExtras);
  return {
    precoForo5mm: num(raw.precoForo5mm, d.precoForo5mm),
    precoForoCavilha10x13: num(raw.precoForoCavilha10x13, d.precoForoCavilha10x13),
    precoForoCavilha10x30: num(raw.precoForoCavilha10x30, d.precoForoCavilha10x30),
    precoForoCalcoGrupo: num(raw.precoForoCalcoGrupo, d.precoForoCalcoGrupo),
    precoForoDobradicaGrupo: num(raw.precoForoDobradicaGrupo, d.precoForoDobradicaGrupo),
    precoRasgoGaveta: num(raw.precoRasgoGaveta, d.precoRasgoGaveta),
    precoCorteManualPorMetro: num(raw.precoCorteManualPorMetro, d.precoCorteManualPorMetro),
    precoMeQuadrilha: num(raw.precoMeQuadrilha, d.precoMeQuadrilha),
    ...(extras ? { operacoesExtras: extras } : {}),
  };
}

export function normalizeOrcamentosSettings(raw: unknown): OrcamentosSettings {
  const d = defaultOrcamentosSettings();
  if (!isObject(raw)) return d;

  const perf = isObject(raw.perfuracoes) ? raw.perfuracoes : {};
  const custos = isObject(raw.custosIndustriais) ? raw.custosIndustriais : {};
  const opsAdv = raw.operacoesAvancadas;
  const mont = isObject(raw.montagemAvancada) ? raw.montagemAvancada : {};
  const margem = isObject(raw.margemGanho) ? raw.margemGanho : {};
  const ferr = isObject(raw.ferragens) ? raw.ferragens : {};

  const materialCostMode = MATERIAL_MODES.includes(
    custos.materialCostMode as OrcamentosMaterialCostMode
  )
    ? (custos.materialCostMode as OrcamentosMaterialCostMode)
    : d.custosIndustriais.materialCostMode;

  const montModo = MONTAGEM_MODOS.includes(mont.modo as OrcamentosMontagemAvancadaModo)
    ? (mont.modo as OrcamentosMontagemAvancadaModo)
    : d.montagemAvancada.modo;

  const margemModo = MARGEM_MODOS.includes(margem.modo as OrcamentosMargemModo)
    ? (margem.modo as OrcamentosMargemModo)
    : d.margemGanho.modo;

  return {
    perfuracoes: {
      drillEurPorFuro: num(perf.drillEurPorFuro, d.perfuracoes.drillEurPorFuro),
      nestingEurPorOperacao: num(perf.nestingEurPorOperacao, d.perfuracoes.nestingEurPorOperacao),
    },
    custosIndustriais: {
      desperdicioEurPorM2: num(custos.desperdicioEurPorM2, d.custosIndustriais.desperdicioEurPorM2),
      serragemEurPorM2: num(custos.serragemEurPorM2, d.custosIndustriais.serragemEurPorM2),
      custoChapaReal: num(custos.custoChapaReal, d.custosIndustriais.custoChapaReal),
      custoOperacoesEspeciais: num(
        custos.custoOperacoesEspeciais,
        d.custosIndustriais.custoOperacoesEspeciais
      ),
      valorHoraMaquina: num(custos.valorHoraMaquina, d.custosIndustriais.valorHoraMaquina),
      custoLogisticaPorKg: num(custos.custoLogisticaPorKg, d.custosIndustriais.custoLogisticaPorKg),
      custoMontagemPorPeca: (() => {
        const v = num(custos.custoMontagemPorPeca, d.custosIndustriais.custoMontagemPorPeca);
        // Legado pré-mercado: 22 EUR → 15 EUR (SSOT pricing.json / Admin).
        return v === 22 ? 15 : v;
      })(),
      materialCostMode,
      enableDesperdicio: bool(custos.enableDesperdicio, d.custosIndustriais.enableDesperdicio),
      enableSerragem: bool(custos.enableSerragem, d.custosIndustriais.enableSerragem),
      enableLogistica: bool(custos.enableLogistica, d.custosIndustriais.enableLogistica),
      enableMaoDeObra: bool(custos.enableMaoDeObra, d.custosIndustriais.enableMaoDeObra),
    },
    operacoesAvancadas: normalizeOperacoesAvancadasSettings(opsAdv),
    montagemAvancada: {
      modo: montModo,
      precoPorM2: num(mont.precoPorM2, d.montagemAvancada.precoPorM2),
      precoPorCaixa: num(mont.precoPorCaixa, d.montagemAvancada.precoPorCaixa),
      precoGavetas: num(mont.precoGavetas, d.montagemAvancada.precoGavetas),
      precoRemate: num(mont.precoRemate, d.montagemAvancada.precoRemate),
      precoFerragensMontagem: num(
        mont.precoFerragensMontagem,
        d.montagemAvancada.precoFerragensMontagem
      ),
    },
    margemGanho: {
      enabled: bool(margem.enabled, d.margemGanho.enabled),
      modo: margemModo,
      valor: num(margem.valor, d.margemGanho.valor),
    },
    ferragens: {
      enableUnificacao: bool(ferr.enableUnificacao, d.ferragens.enableUnificacao),
    },
  };
}

export function mergeOrcamentosSettings(
  base: OrcamentosSettings,
  patch: unknown
): OrcamentosSettings {
  if (!isObject(patch)) return normalizeOrcamentosSettings(base);
  const perf = isObject(patch.perfuracoes) ? patch.perfuracoes : {};
  const custos = isObject(patch.custosIndustriais) ? patch.custosIndustriais : {};
  const opsAdv = isObject(patch.operacoesAvancadas) ? patch.operacoesAvancadas : {};
  const mont = isObject(patch.montagemAvancada) ? patch.montagemAvancada : {};
  const margem = isObject(patch.margemGanho) ? patch.margemGanho : {};
  const ferr = isObject(patch.ferragens) ? patch.ferragens : {};
  return normalizeOrcamentosSettings({
    ...base,
    ...patch,
    perfuracoes: { ...base.perfuracoes, ...perf },
    custosIndustriais: { ...base.custosIndustriais, ...custos },
    operacoesAvancadas: { ...base.operacoesAvancadas, ...opsAdv },
    montagemAvancada: { ...base.montagemAvancada, ...mont },
    margemGanho: { ...base.margemGanho, ...margem },
    ferragens: { ...base.ferragens, ...ferr },
  });
}

/**
 * Stub day-1 (pré-pricing.json): flags industriais off + tarifas 0.
 * Usado no boot para substituir por `orcamentosDefaultsFromCentral()`.
 */
export function isOrcamentosDay1IndustrialStub(raw: unknown): boolean {
  const o = normalizeOrcamentosSettings(raw);
  const c = o.custosIndustriais;
  return (
    c.enableDesperdicio === false &&
    c.enableSerragem === false &&
    c.enableMaoDeObra === false &&
    c.valorHoraMaquina === 0 &&
    c.serragemEurPorM2 === 0 &&
    o.perfuracoes.drillEurPorFuro === 0
  );
}
