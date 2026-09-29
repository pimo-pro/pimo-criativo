/**
 * Snapshot Atual — estado do sistema no momento (agrega SSOTs existentes).
 * Sem fetch. Não altera loaders de progresso/planeamento/stats/archive.
 */

import { loadHubStats } from "../dashboard/dashboardTypes";
import { loadHubProgresso } from "../progresso/loadHubProgresso";
import { loadHubPlaneamento } from "../planeamento/loadHubPlaneamento";
import { loadHistoricoArchive } from "../archive/loadHistoricoArchive";
import type { PlaneamentoEntry, PlaneamentoStage } from "../planeamento/planeamentoTypes";
import type {
  AtualAlert,
  AtualPhaseSummary,
  AtualSnapshot,
} from "./atualTypes";

const STAGE_LABEL: Record<PlaneamentoStage, string> = {
  futura: "Próxima / futura",
  em_andamento: "Fase atual (em andamento)",
  "concluída": "Última concluída",
  bloqueada: "Bloqueadas",
  dependente: "Dependências",
};

function norm(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function overlap(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length > 4));
  const wb = nb.split(" ").filter((w) => w.length > 4);
  let hit = 0;
  for (const w of wb) if (wa.has(w)) hit += 1;
  return hit >= 2;
}

function toPhaseSummary(
  stage: PlaneamentoStage,
  items: PlaneamentoEntry[],
  limit = 8
): AtualPhaseSummary {
  return {
    stage,
    label: STAGE_LABEL[stage],
    count: items.length,
    items: items.slice(0, limit).map((e) => ({
      id: e.id,
      title: e.title,
      summary: e.summary,
    })),
  };
}

function buildAlerts(
  stages: Record<PlaneamentoStage, PlaneamentoEntry[]>,
  progressoEmAndamento: Array<{ id: string; titulo: string }>,
  progressoProximas: Array<{ id: string; titulo: string }>,
  roadmapProgress: number,
  progressoRoadmapProgress: number
): AtualAlert[] {
  const alerts: AtualAlert[] = [];

  if (stages.bloqueada.length > 0) {
    alerts.push({
      id: "alert-bloqueada",
      level: "warn",
      title: "Fase(s) bloqueada(s)",
      detail: `Existem ${stages.bloqueada.length} etapa(s) bloqueada(s) no planeamento (ex.: ${stages.bloqueada[0].title}).`,
    });
  }

  if (stages.dependente.length > 0) {
    alerts.push({
      id: "alert-dependente",
      level: "warn",
      title: "Dependência(s) não resolvida(s)",
      detail: `Existem ${stages.dependente.length} dependência(s) pendente(s) (ex.: ${stages.dependente[0].title}).`,
    });
  }

  const missingAndamento = progressoEmAndamento.filter(
    (p) => !stages.em_andamento.some((e) => overlap(e.title, p.titulo))
  );
  const missingFutura = progressoProximas.filter(
    (p) => !stages.futura.some((e) => overlap(e.title, p.titulo))
  );

  if (missingAndamento.length > 0 || missingFutura.length > 0) {
    alerts.push({
      id: "alert-inconsistencia",
      level: "critical",
      title: "Inconsistência progresso × planeamento",
      detail: [
        missingAndamento.length
          ? `Em andamento sem espelho no planeamento: ${missingAndamento.length}`
          : null,
        missingFutura.length
          ? `Próximas sem espelho no planeamento: ${missingFutura.length}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (Math.abs(roadmapProgress - progressoRoadmapProgress) > 0) {
    alerts.push({
      id: "alert-roadmap-drift",
      level: "info",
      title: "Drift de progresso do roadmap",
      detail: `Planeamento ${roadmapProgress}% vs Progresso ${progressoRoadmapProgress}%.`,
    });
  }

  return alerts;
}

/** Constrói o snapshot atual a partir dos SSOTs do Hub. */
export function buildAtualSnapshot(): AtualSnapshot {
  const stats = loadHubStats();
  const progresso = loadHubProgresso();
  const planeamento = loadHubPlaneamento();
  const historico = loadHistoricoArchive();

  const stages = planeamento.stages;

  const projectsValue = stats.totalProjects.toLocaleString("pt-PT");
  const kpis = stats.cards.map((card) =>
    card.id === "projects"
      ? {
          ...card,
          value: projectsValue,
          hint: "Din\u00e2mico \u2014 alinhado a /PROJETOS",
        }
      : card
  );

  return {
    generatedAtLabel: new Date().toLocaleString("pt-PT", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    sourceLabel: `${stats.sourceLabel} \u00b7 progresso \u00b7 planeamento \u00b7 archive`,
    kpis,
    resumo: {
      faseAtual: toPhaseSummary("em_andamento", stages.em_andamento),
      proximaFase: toPhaseSummary("futura", stages.futura),
      ultimaConcluida: toPhaseSummary("concluída", stages["concluída"]),
      bloqueadas: toPhaseSummary("bloqueada", stages.bloqueada),
      dependencias: toPhaseSummary("dependente", stages.dependente),
      roadmapProgress: planeamento.roadmapProgress,
      currentPhaseTitle: progresso.roadmap.currentPhaseTitle,
      progressoCompletionPercent: progresso.counters.completionPercent,
    },
    historicoRecent: historico.slice(0, 5).map((h) => ({
      id: h.id,
      title: h.title,
      kind: h.kind,
    })),
    alerts: buildAlerts(
      stages,
      progresso.emAndamento,
      progresso.proximas,
      planeamento.roadmapProgress,
      progresso.roadmap.progress
    ),
    planeamentoEtapas: planeamento.etapas,
  };
}
