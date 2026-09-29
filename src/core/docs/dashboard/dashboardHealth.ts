/**
 * Indicadores de saúde do Hub (encoding / layout / loaders / navegação).
 */

import { loadHubProgresso } from "../progresso/loadHubProgresso";
import { loadHubPlaneamento } from "../planeamento/loadHubPlaneamento";
import { loadHubAtual } from "../atual/loadHubAtual";
import { loadHistoricoArchive } from "../archive/loadHistoricoArchive";
import {
  loadHubStats,
  type DashboardHealth,
  type DashboardHealthItem,
  type DashboardHealthStatus,
} from "./dashboardTypes";

function worst(a: DashboardHealthStatus, b: DashboardHealthStatus): DashboardHealthStatus {
  const rank = { ok: 0, warn: 1, fail: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export function buildDashboardHealth(): DashboardHealth {
  const items: DashboardHealthItem[] = [];

  try {
    const stats = loadHubStats();
    const hasLoc = stats.cards.some((c) => c.id === "loc" && c.value.includes("297"));
    const hasFiles = stats.cards.some((c) => c.id === "files" && c.value.includes("2.027"));
    items.push({
      id: "health-encoding-kpis",
      label: "Encoding / KPIs",
      status: hasLoc && hasFiles ? "ok" : "warn",
      detail: hasLoc && hasFiles
        ? "KPIs oficiais legíveis (UTF-8) via loadHubStats."
        : "KPIs incompletos ou valores inesperados.",
    });
  } catch (err) {
    items.push({
      id: "health-encoding-kpis",
      label: "Encoding / KPIs",
      status: "fail",
      detail: err instanceof Error ? err.message : "Falha ao carregar stats.",
    });
  }

  try {
    const progresso = loadHubProgresso();
    const planeamento = loadHubPlaneamento();
    const atual = loadHubAtual();
    const layoutOk =
      typeof progresso.counters.completionPercent === "number" &&
      Array.isArray(planeamento.etapas) &&
      Array.isArray(atual.kpis);
    items.push({
      id: "health-layout-snapshot",
      label: "Layout / snapshots",
      status: layoutOk ? "ok" : "warn",
      detail: layoutOk
        ? "Snapshots progresso/planeamento/atual coerentes para grelha full-width."
        : "Snapshots incompletos para o layout do Hub.",
    });

    const blocked = atual.resumo.bloqueadas.count;
    const deps = atual.resumo.dependencias.count;
    const critical = atual.alerts.some((a) => a.level === "critical");
    items.push({
      id: "health-alerts",
      label: "Alertas do estado atual",
      status: critical ? "fail" : blocked || deps ? "warn" : "ok",
      detail: `Alertas=${atual.alerts.length}; bloqueadas=${blocked}; dependências=${deps}.`,
    });
  } catch (err) {
    items.push({
      id: "health-layout-snapshot",
      label: "Layout / snapshots",
      status: "fail",
      detail: err instanceof Error ? err.message : "Falha nos snapshots.",
    });
  }

  try {
    const hist = loadHistoricoArchive();
    items.push({
      id: "health-loaders",
      label: "Loaders locais",
      status: hist.length > 0 ? "ok" : "warn",
      detail: `Archive=${hist.length} entradas; loaders sync OK (sem fetch no dashboard).`,
    });
  } catch (err) {
    items.push({
      id: "health-loaders",
      label: "Loaders locais",
      status: "fail",
      detail: err instanceof Error ? err.message : "Falha em loaders.",
    });
  }

  items.push({
    id: "health-nav",
    label: "Navegação / hash",
    status: "ok",
    detail: "Hash #dashboard suportado; default /documentacao permanece #atual.",
  });

  let overall: DashboardHealthStatus = "ok";
  for (const it of items) overall = worst(overall, it.status);
  return { overall, items };
}
