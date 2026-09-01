/**
 * Importacao leve PIMO TRAK - apenas leitura de work-orders/tasks.
 * Nao altera ordens nem estados industriais.
 */

import { fetchWorkOrderDetail, fetchWorkOrders } from "@/industrial/api/workOrderActions";
import type { IndustrialWorkOrderTask } from "@/industrial/work-orders/types";

import {
  emptyMetricas,
  emptyMontagem,
  emptyProducao,
  makeReportId,
  type ProjectReportMetricas,
  type ProjectReportMontagem,
  type ProjectReportProducao,
  type ReportOperador,
} from "./types";

export type TrakImportSnapshot = {
  metricas: ProjectReportMetricas;
  producaoPatch: Pick<
    ProjectReportProducao,
    "dataInicio" | "dataFim" | "horasEfetivas" | "operadores"
  >;
  montagemPatch: Pick<ProjectReportMontagem, "dataInicio" | "dataFim" | "instaladores">;
  ordersCount: number;
};

function toDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function hoursBetween(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round(((b - a) / 3_600_000) * 100) / 100;
}

function isMontagemStation(station: string, operationType?: string): boolean {
  const s = station.toLowerCase();
  const op = (operationType ?? "").toLowerCase();
  return s === "montagem" || op === "montagem";
}

function emptySnapshot(): TrakImportSnapshot {
  return {
    metricas: emptyMetricas(),
    producaoPatch: {
      dataInicio: "",
      dataFim: "",
      horasEfetivas: 0,
      operadores: [],
    },
    montagemPatch: {
      dataInicio: "",
      dataFim: "",
      instaladores: [],
    },
    ordersCount: 0,
  };
}

/**
 * Le work-orders + tasks do projeto e deriva metricas / datas / horas / operadores.
 * Falhas de rede/Supabase devolvem snapshot vazio (campos manuais cobrem).
 */
export async function importTrakSnapshot(projectId: string): Promise<TrakImportSnapshot> {
  const id = projectId.trim();
  if (!id) return emptySnapshot();

  try {
    const orders = await fetchWorkOrders({ projectId: id });
    const details = await Promise.all(
      orders.slice(0, 40).map(async (order) => {
        try {
          return await fetchWorkOrderDetail(order.id);
        } catch {
          return { order, tasks: [] as IndustrialWorkOrderTask[] };
        }
      })
    );

    const metricas = emptyMetricas();
    metricas.ordensTrabalho = orders.length;
    metricas.tarefasConcluidas = orders.filter((o) => o.status === "completed").length;

    const rejectedTasks = details.flatMap((d) =>
      d.tasks.filter((t) => t.status === "rejected")
    );
    metricas.erros = rejectedTasks.length;

    const operatorMap = new Map<string, ReportOperador>();
    let prodStart = "";
    let prodEnd = "";
    let montStart = "";
    let montEnd = "";
    let horasProd = 0;
    let _horasMont = 0;

    const bumpDate = (cur: string, iso: string | undefined, mode: "min" | "max") => {
      const next = toDateInput(iso);
      if (!next) return cur;
      if (!cur) return next;
      return mode === "min" ? (next < cur ? next : cur) : next > cur ? next : cur;
    };

    for (const { order, tasks } of details) {
      const station = order.station;
      for (const task of tasks) {
        const montagem = isMontagemStation(station, task.operationType);
        if (montagem) {
          montStart = bumpDate(montStart, task.startedAt ?? order.createdAt, "min");
          montEnd = bumpDate(montEnd, task.completedAt ?? order.updatedAt, "max");
          _horasMont += hoursBetween(task.startedAt, task.completedAt);
        } else {
          prodStart = bumpDate(prodStart, task.startedAt ?? order.createdAt, "min");
          prodEnd = bumpDate(prodEnd, task.completedAt ?? order.updatedAt, "max");
          horasProd += hoursBetween(task.startedAt, task.completedAt);
        }

        const opId = (task.operatorId ?? "").trim();
        if (!opId) continue;
        const prev = operatorMap.get(opId);
        const h = hoursBetween(task.startedAt, task.completedAt);
        const tarefa = `${station}/${task.operationType}`;
        if (prev) {
          prev.horas = Math.round((prev.horas + h) * 100) / 100;
          if (!prev.tarefas.includes(tarefa)) {
            prev.tarefas = prev.tarefas ? `${prev.tarefas}; ${tarefa}` : tarefa;
          }
        } else {
          operatorMap.set(opId, {
            id: makeReportId("op"),
            nome: opId,
            horas: h,
            tarefas: tarefa,
          });
        }
      }

      // fallback datas da ordem se nao houver tasks
      if (tasks.length === 0) {
        if (isMontagemStation(station)) {
          montStart = bumpDate(montStart, order.createdAt, "min");
          montEnd = bumpDate(montEnd, order.updatedAt, "max");
        } else {
          prodStart = bumpDate(prodStart, order.createdAt, "min");
          prodEnd = bumpDate(prodEnd, order.updatedAt, "max");
        }
      }
    }

    const operadores = Array.from(operatorMap.values());
    metricas.colaboradores = operadores.length;

    // Separar instaladores (tarefas montagem) vs producao: por agora mesma lista se so houver operatorId
    const instaladores = operadores.filter((o) =>
      o.tarefas.toLowerCase().includes("montagem")
    );

    return {
      metricas,
      producaoPatch: {
        dataInicio: prodStart,
        dataFim: prodEnd,
        horasEfetivas: Math.round(horasProd * 100) / 100,
        operadores,
      },
      montagemPatch: {
        dataInicio: montStart,
        dataFim: montEnd,
        instaladores: instaladores.length ? instaladores : [],
      },
      ordersCount: orders.length,
    };
  } catch {
    return emptySnapshot();
  }
}

/** Aplica patch TRAK respeitando manualPaths. */
export function applyTrakToReportParts(
  existing: {
    metricas: ProjectReportMetricas;
    producao: ProjectReportProducao;
    montagem: ProjectReportMontagem;
  },
  snap: TrakImportSnapshot,
  isManual: (path: string) => boolean
): {
  metricas: ProjectReportMetricas;
  producao: ProjectReportProducao;
  montagem: ProjectReportMontagem;
} {
  // Ordens / tarefas: cache TRAK (erros/melhorias/colaboradores sao derivados depois).
  const metricas = { ...existing.metricas };
  metricas.ordensTrabalho = Math.max(metricas.ordensTrabalho, snap.metricas.ordensTrabalho);
  metricas.tarefasConcluidas = Math.max(
    metricas.tarefasConcluidas,
    snap.metricas.tarefasConcluidas
  );

  const producao = { ...existing.producao };
  if (!isManual("producao.dataInicio") && !producao.dataInicio) {
    producao.dataInicio = snap.producaoPatch.dataInicio;
  }
  if (!isManual("producao.dataFim") && !producao.dataFim) {
    producao.dataFim = snap.producaoPatch.dataFim;
  }
  if (!isManual("producao.horasEfetivas") && !producao.horasEfetivas) {
    producao.horasEfetivas = snap.producaoPatch.horasEfetivas;
  }
  if (!isManual("producao.operadores") && producao.operadores.length === 0) {
    producao.operadores = snap.producaoPatch.operadores;
  }

  const montagem = { ...existing.montagem };
  if (!isManual("montagem.dataInicio") && !montagem.dataInicio) {
    montagem.dataInicio = snap.montagemPatch.dataInicio;
  }
  if (!isManual("montagem.dataFim") && !montagem.dataFim) {
    montagem.dataFim = snap.montagemPatch.dataFim;
  }
  if (!isManual("montagem.instaladores") && montagem.instaladores.length === 0) {
    montagem.instaladores = snap.montagemPatch.instaladores;
  }

  return { metricas, producao, montagem };
}

/** Helper tipado para seed inicial. */
export function trakIntoEmptyProducao(snap: TrakImportSnapshot): ProjectReportProducao {
  return {
    ...emptyProducao(),
    dataInicio: snap.producaoPatch.dataInicio,
    dataFim: snap.producaoPatch.dataFim,
    horasEfetivas: snap.producaoPatch.horasEfetivas,
    operadores: snap.producaoPatch.operadores,
  };
}

export function trakIntoEmptyMontagem(snap: TrakImportSnapshot): ProjectReportMontagem {
  return {
    ...emptyMontagem(),
    dataInicio: snap.montagemPatch.dataInicio,
    dataFim: snap.montagemPatch.dataFim,
    instaladores: snap.montagemPatch.instaladores,
  };
}
