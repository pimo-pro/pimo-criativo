/**
 * Tipos do hub — Secção Atual / Estado do Sistema (Fase 11).
 */

import type { HubStatCard } from "../dashboard/dashboardTypes";
import type { PlaneamentoEntry, PlaneamentoStage } from "../planeamento/planeamentoTypes";

export type AtualAlertLevel = "info" | "warn" | "critical";

export type AtualAlert = {
  id: string;
  level: AtualAlertLevel;
  title: string;
  detail: string;
};

export type AtualKpi = HubStatCard;

export type AtualPhaseSummary = {
  stage: PlaneamentoStage;
  label: string;
  count: number;
  items: Array<{ id: string; title: string; summary: string }>;
};

export type AtualResumo = {
  faseAtual: AtualPhaseSummary;
  proximaFase: AtualPhaseSummary;
  ultimaConcluida: AtualPhaseSummary;
  bloqueadas: AtualPhaseSummary;
  dependencias: AtualPhaseSummary;
  roadmapProgress: number;
  currentPhaseTitle: string | null;
  progressoCompletionPercent: number;
};

export type AtualHistoricoItem = {
  id: string;
  title: string;
  kind: string;
};

/** Alterações async preenchidas no UI via loaders existentes (sem fetch no loader atual). */
export type AtualRecentChange = {
  id: string;
  source: "novidades" | "removidos" | "historico";
  title: string;
  meta?: string;
};

export type AtualSnapshot = {
  generatedAtLabel: string;
  sourceLabel: string;
  kpis: AtualKpi[];
  resumo: AtualResumo;
  historicoRecent: AtualHistoricoItem[];
  alerts: AtualAlert[];
  /** Etapas brutas usadas para cruzamento (planeamento). */
  planeamentoEtapas: PlaneamentoEntry[];
};
