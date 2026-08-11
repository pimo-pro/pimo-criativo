/**
 * Contagens úteis do Painel gráfico do Relatório Final (P3.18 — só UI).
 */

import type { ProjectReport, ReportPeca } from "./types";

function sumQtdMatching(pecas: ReportPeca[], re: RegExp): number {
  return pecas.reduce((s, p) => {
    const hay = `${p.peca} ${p.ref}`.toLowerCase();
    if (!re.test(hay)) return s;
    return s + Math.max(1, Number(p.qtd) || 1);
  }, 0);
}

function isGavetaPiece(hay: string): boolean {
  return /gav[_-]|gaveta|drawer/.test(hay);
}

function isPortaPiece(hay: string): boolean {
  if (isGavetaPiece(hay)) return false;
  return /porta|door|(^|[^a-z])frente([^a-z]|$)/.test(hay);
}

function sumQtdBy(pecas: ReportPeca[], pred: (hay: string) => boolean): number {
  return pecas.reduce((s, p) => {
    const hay = `${p.peca} ${p.ref}`.toLowerCase();
    if (!pred(hay)) return s;
    return s + Math.max(1, Number(p.qtd) || 1);
  }, 0);
}

export type RelatorioPainelContagens = {
  caixas: number;
  pecas: number;
  modulos: number;
  portas: number;
  gavetas: number;
};

/** Contagens para o painel: caixas, peças, módulos, portas, gavetas (sem tempo). */
export function buildRelatorioPainelContagens(
  report: ProjectReport
): RelatorioPainelContagens {
  const caixas = report.producao?.caixas?.length ?? 0;
  const pecasList = report.producao?.pecas ?? [];
  const pecas = pecasList.reduce((s, p) => s + Math.max(1, Number(p.qtd) || 1), 0);
  return {
    caixas,
    pecas,
    modulos: caixas,
    portas: sumQtdBy(pecasList, isPortaPiece),
    gavetas: sumQtdMatching(pecasList, /gav[_-]|gaveta|drawer/i),
  };
}
