/**
 * Documento de Relatorio Final do Projeto - isolado do ProjectState industrial.
 * Edicoes manuais vivem aqui; nunca sobrescrevem o projeto base.
 */

import type { FinanceiroCustoKey } from "../financeiro/financeiroUnificadoTypes";
import { FINANCEIRO_IVA_DEFAULT_PCT } from "../financeiro/financeiroUnificadoTypes";

export type ReportStyle = "classic" | "cards";

/** Item de texto livre (erros, solucoes, melhorias). */
export type ReportTextoItem = {
  id: string;
  texto: string;
};

export type ReportOperador = {
  id: string;
  nome: string;
  horas: number;
  tarefas: string;
};

export type ReportCaixa = {
  id: string;
  nome: string;
  dimensoes: string;
  tipo: string;
  sourceId?: string;
};

export type ReportPeca = {
  id: string;
  ref: string;
  peca: string;
  material: string;
  matRef: string;
  qtd: number;
  comp: number;
  larg: number;
  esp: number;
  cnc: string;
  drill: string;
  o2: string;
  o3: string;
  o4: string;
  o5: string;
  f2: string;
  f3: string;
  f4: string;
  f5: string;
  g: string;
  observacoes: string;
  noEtq: string;
  temErro: boolean;
  notasErro: string;
  propostaCorrecao: string;
  sourceId?: string;
};

export type ReportMaterialLinha = {
  id: string;
  tipo: string;
  quantidade: number;
  observacoes: string;
  temErro: boolean;
  substituicao: string;
  sourceId?: string;
};

export type ReportFinanceiroDetalhe = {
  id: string;
  tipo: string;
  dimensoes: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  /** Espessura em mm (chapas / painéis). */
  espessuraMm?: number;
  /** Comprimento da peça (mm) — preço linear. */
  comprimentoMm?: number;
  /** Largura da peça (mm). */
  larguraMm?: number;
  /** EUR por metro linear (comprimento). */
  precoPorMetro?: number;
  /** @deprecated legado €/m² — migrado para precoPorMetro. */
  precoPorM2?: number;
  /** @deprecated legado área chapa. */
  areaChapaM2?: number;
};

export type ReportFinanceiroLinha = {
  key: FinanceiroCustoKey | "iva" | "total";
  label: string;
  quantidade: number | null;
  precoUnitario: number | null;
  /** Sempre derivado (qty x preco ou valor fixo); nao editavel diretamente. */
  total: number;
  detalhe: ReportFinanceiroDetalhe[];
};

export type ProjectReportGerais = {
  nomeProjeto: string;
  designer: string;
  empresa: string;
  /** Descricao livre de materiais (seed a partir de ProjectState.materiaisProjeto). */
  materiaisDescricao: string;
  dataInicioExecucao: string;
  dataConclusaoExecucao: string;
};

export type ProjectReportMetricas = {
  tarefasConcluidas: number;
  erros: number;
  errosCorrigidos: number;
  melhorias: number;
  ordensTrabalho: number;
  colaboradores: number;
};

export type ProjectReportDesign = {
  dataInicio: string;
  dataConclusao: string;
  revisoesAntesProducao: number;
  revisoesAposProducao: number;
  errosDesign: ReportTextoItem[];
  solucoesAplicadas: ReportTextoItem[];
  melhoriasPropostas: ReportTextoItem[];
  melhoriasImplementadas: ReportTextoItem[];
};

export type ProjectReportProducao = {
  operadores: ReportOperador[];
  caixas: ReportCaixa[];
  pecas: ReportPeca[];
  dataInicio: string;
  dataFim: string;
  horasEfetivas: number;
  reProducoes: number;
  erros: ReportTextoItem[];
  solucoesAplicadas: ReportTextoItem[];
  melhoriasPropostas: ReportTextoItem[];
  melhoriasImplementadas: ReportTextoItem[];
};

export type ProjectReportMontagem = {
  dataEnvio: string;
  instaladores: ReportOperador[];
  dataInicio: string;
  dataFim: string;
  intervencoesPos: number;
  erros: ReportTextoItem[];
  solucoesAplicadas: ReportTextoItem[];
  melhoriasPropostas: ReportTextoItem[];
  melhoriasImplementadas: ReportTextoItem[];
};

/** Origem do preço de Painéis (badge UI) — só informativo. */
export type ReportPaineisOrigem =
  | "chapas_reais_m2_area"
  | "fallback_por_peca"
  | "estimado";

export type ProjectReportFinanceiro = {
  ivaPct: number;
  linhas: ReportFinanceiroLinha[];
  subtotal: number;
  ivaValor: number;
  totalProjeto: number;
  /**
   * Overrides manuais do Relatório (não recalculam a base Unificado).
   * Aplicados sobre totais SSOT; Portas/Remates ignorados.
   */
  lineOverrides?: Partial<Record<FinanceiroCustoKey, number>>;
  /** Badge de origem Painéis (SSOT). */
  paineisOrigem?: ReportPaineisOrigem;
};

export type ReportHistoryEntry = {
  id: string;
  timestamp: string;
  path: string;
  oldValue: string;
  newValue: string;
  user: string;
};

export type ReportNota = {
  id: string;
  autor: string;
  texto: string;
  timestamp: string;
};

export type ProjectReportQualidade = {
  rating: 1 | 2 | 3 | 4 | 5;
  observacoes: string[];
};

export type ProjectReport = {
  projectId: string;
  /** v2: listas de itens em design/producao/montagem. */
  version: 2;
  reportStyle: ReportStyle;
  createdAt: string;
  updatedAt: string;
  gerais: ProjectReportGerais;
  metricas: ProjectReportMetricas;
  design: ProjectReportDesign;
  producao: ProjectReportProducao;
  montagem: ProjectReportMontagem;
  /** Espelho legado da linha Ferragens (sincronizado a partir do detalhe financeiro). */
  materiais: ReportMaterialLinha[];
  financeiro: ProjectReportFinanceiro;
  /** Paths JSON tocados pelo utilizador - merge de seed nao os sobrescreve. */
  manualPaths: string[];
  history: ReportHistoryEntry[];
  notas: ReportNota[];
  qualidade: ProjectReportQualidade;
};

export const PROJECT_REPORT_STORAGE_KEY = "pimo_project_reports_v1";
export const PROJECT_REPORT_IVA_DEFAULT = FINANCEIRO_IVA_DEFAULT_PCT;
export const HISTORY_MAX_ENTRIES = 200;
export const PROJECT_REPORT_VERSION = 2 as const;

export const FINANCEIRO_REPORT_LABELS: Record<FinanceiroCustoKey, string> = {
  paineis: "Painéis",
  portas: "Portas",
  gavetas: "Gavetas",
  ferragens: "Ferragens",
  orla: "Orla",
  remates: "Remates / Rodapés",
  operacoes: "Operações (CNC/Drill)",
  desperdicio: "Desperdício",
  serragem: "Serragem",
  chapasReais: "Chapas reais",
  maoDeObra: "Mão de obra",
  logistica: "Logística",
  operacoesAvancadas: "Ops avançadas",
  adm: "ADM",
  montagem: "Montagem",
  portes: "Portes",
};

export function emptyGerais(): ProjectReportGerais {
  return {
    nomeProjeto: "",
    designer: "",
    empresa: "",
    materiaisDescricao: "",
    dataInicioExecucao: "",
    dataConclusaoExecucao: "",
  };
}

export function emptyMetricas(): ProjectReportMetricas {
  return {
    tarefasConcluidas: 0,
    erros: 0,
    errosCorrigidos: 0,
    melhorias: 0,
    ordensTrabalho: 0,
    colaboradores: 0,
  };
}

export function emptyDesign(): ProjectReportDesign {
  return {
    dataInicio: "",
    dataConclusao: "",
    revisoesAntesProducao: 0,
    revisoesAposProducao: 0,
    errosDesign: [],
    solucoesAplicadas: [],
    melhoriasPropostas: [],
    melhoriasImplementadas: [],
  };
}

export function emptyProducao(): ProjectReportProducao {
  return {
    operadores: [],
    caixas: [],
    pecas: [],
    dataInicio: "",
    dataFim: "",
    horasEfetivas: 0,
    reProducoes: 0,
    erros: [],
    solucoesAplicadas: [],
    melhoriasPropostas: [],
    melhoriasImplementadas: [],
  };
}

export function emptyMontagem(): ProjectReportMontagem {
  return {
    dataEnvio: "",
    instaladores: [],
    dataInicio: "",
    dataFim: "",
    intervencoesPos: 0,
    erros: [],
    solucoesAplicadas: [],
    melhoriasPropostas: [],
    melhoriasImplementadas: [],
  };
}

export function emptyFinanceiro(): ProjectReportFinanceiro {
  return {
    ivaPct: PROJECT_REPORT_IVA_DEFAULT,
    linhas: [],
    subtotal: 0,
    ivaValor: 0,
    totalProjeto: 0,
  };
}

export function emptyQualidade(): ProjectReportQualidade {
  return { rating: 3, observacoes: [] };
}

export function makeReportId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
