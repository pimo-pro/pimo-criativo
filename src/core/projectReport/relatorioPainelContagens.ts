/**
 * Contagens úteis do Painel gráfico do Relatório Final (P3.18 — só UI).
 * Portas/gavetas: unidades reais das caixas Unificado, não peças de cutlist.
 */

import type { ProjectState } from "@/context/projectTypes";
import { resolveActiveGavetasCount } from "@/core/drawers/drawerModeloAGate";
import type { BoxModule } from "@/core/types";

import type { ProjectReport, RelatorioPainelContagensPersistidas, ReportPeca } from "./types";

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
  return /porta|door/.test(hay);
}

/** Frente de gaveta = 1 gaveta (fallback sem estado Unificado). */
function isGavetaUnidade(hay: string): boolean {
  return /gaveta_frente|gav_frente|drawer.?front/.test(hay);
}

function sumQtdBy(pecas: ReportPeca[], pred: (hay: string) => boolean): number {
  return pecas.reduce((s, p) => {
    const hay = `${p.peca} ${p.ref}`.toLowerCase();
    if (!pred(hay)) return s;
    return s + Math.max(1, Number(p.qtd) || 1);
  }, 0);
}

export type RelatorioPainelContagens = RelatorioPainelContagensPersistidas & {
  /** Mantido só para compatibilidade; o painel já não renderiza Caixas. */
  caixas: number;
};

export type PainelContagensBox = Pick<BoxModule, "portaTipo" | "gavetas"> & {
  doorsLayer?: BoxModule["doorsLayer"] | null;
  drawersLayer?: BoxModule["drawersLayer"] | null;
};

/** Portas reais do módulo (folhas), não peças internas. */
export function countPortasModulo(box: PainelContagensBox): number {
  if (!box.portaTipo || box.portaTipo === "sem_porta") return 0;
  const doors = box.doorsLayer ?? [];
  if (doors.length > 0) return doors.length;
  return box.portaTipo === "porta_dupla" ? 2 : 1;
}

/** Gavetas reais do módulo (unidades), não peças internas. */
export function countGavetasModulo(box: PainelContagensBox): number {
  return resolveActiveGavetasCount(box);
}

export function countPainelFromBoxes(boxes: PainelContagensBox[] | null | undefined): {
  modulos: number;
  portas: number;
  gavetas: number;
} {
  const list = boxes ?? [];
  return {
    modulos: list.length,
    portas: list.reduce((s, b) => s + countPortasModulo(b), 0),
    gavetas: list.reduce((s, b) => s + countGavetasModulo(b), 0),
  };
}

/** Contagens para o painel: módulos, peças, portas, gavetas (sem tempo; sem Caixas). */
export function buildRelatorioPainelContagens(
  report: ProjectReport,
  state?: ProjectState | null
): RelatorioPainelContagens {
  const pecasList = report.producao?.pecas ?? [];
  const pecas = pecasList.reduce((s, p) => s + Math.max(1, Number(p.qtd) || 1), 0);

  if (state?.boxes && state.boxes.length > 0) {
    const fromBoxes = countPainelFromBoxes(state.boxes);
    return {
      caixas: fromBoxes.modulos,
      pecas,
      modulos: fromBoxes.modulos,
      portas: fromBoxes.portas,
      gavetas: fromBoxes.gavetas,
    };
  }

  if (report.painelContagens) {
    return {
      caixas: report.painelContagens.modulos,
      pecas: report.painelContagens.pecas,
      modulos: report.painelContagens.modulos,
      portas: report.painelContagens.portas,
      gavetas: report.painelContagens.gavetas,
    };
  }

  const caixas = report.producao?.caixas?.length ?? 0;
  return {
    caixas,
    pecas,
    modulos: caixas,
    portas: sumQtdBy(pecasList, isPortaPiece),
    gavetas: sumQtdBy(pecasList, isGavetaUnidade) || sumQtdMatching(pecasList, /gav[_-]|gaveta|drawer/i),
  };
}
