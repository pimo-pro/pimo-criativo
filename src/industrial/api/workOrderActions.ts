import {
  asObject,
  buildPimoProjectDataFromRequest,
  nowIso,
  toMetaFromProjectData,
  toRecordFromProjectData,
} from '@/core/projects/projectsMappers';
import { remoteLoadProjectRecord } from '@/core/projects/projectsApi';
import { supabase } from '@/industrial/infra/db';
import { createWorkOrdersForProject } from '@/industrial/work-orders/createWorkOrdersForProject';
import { resolveProjectCutlist } from '@/industrial/work-orders/resolveProjectCutlist';
import { resolveProjectCutlistFromRecord } from '@/industrial/work-orders/resolveProjectCutlistFromRecord';
import {
  buildWorkOrderDisplayMapFromContext,
  displayToTaskMetadata,
  readDisplayFromMetadata,
} from '@/industrial/work-orders/resolveWorkOrderPiece';
import type { IndustrialStation, WorkOrderTaskStatus } from '@/industrial/work-orders/types';
import { WORK_ORDER_TABLES } from '@/industrial/persistence/work-orders/tables';
import {
  loadTaskById,
  loadTasksByPiece,
  loadTasksByStation,
  loadTasksByWorkOrder,
  loadWorkOrderById,
  loadWorkOrders,
} from '@/industrial/persistence/work-orders/loadWorkOrders';
import { logWorkOrderEvent } from '@/industrial/persistence/work-orders/logWorkOrderEvent';
import { resolveIndustrialUserId } from '@/industrial/persistence/users/getOrCreateIndustrialUser';
import {
  notifyWorkOrderSyncError,
  validateWorkOrderBeforeEvent,
  WORK_ORDER_SYNC_ERROR_MESSAGE,
} from '@/industrial/persistence/work-orders/validateWorkOrderBeforeEvent';
import {
  assignTaskOperator,
  syncWorkOrderStatusFromTasks,
  syncWorkOrdersStatusFromTasks,
  patchWorkOrderTaskMetadata,
  updateTaskState,
  updateWorkOrderStatus,
} from '@/industrial/persistence/work-orders/updateTaskState';
import {
  loadPieceOperations,
  logPieceEventAction,
  updatePieceOperationState,
  updatePieceQuality,
  updatePieceTime,
} from '@/industrial/api/pieceActions';
import type { PieceOperation, PieceOperationType } from '@/industrial/core/piece-operations/types';
import type { IndustrialWorkOrder, IndustrialWorkOrderTask } from '@/industrial/work-orders/types';

/** Concorrência máxima no processamento em lote (Iniciar / Concluir / Rejeitar). */
const BULK_CONCURRENCY = 6;

export type TaskActionOptions = {
  station?: string;
  skipWorkOrderSync?: boolean;
  /** Já resolvido — evita SELECT users repetido. */
  resolvedUserId?: string;
};

export type BulkTaskResult = {
  ok: IndustrialWorkOrderTask[];
  failures: Array<{ taskId: string; pieceId?: string; error: string }>;
};

type ApplyOptions = TaskActionOptions & {
  stationEventType?: string;
  stationEventMetadata?: Record<string, unknown>;
};

export async function generateProjectWorkOrders(projectId: string) {
  return createWorkOrdersForProject(projectId);
}

export async function fetchWorkOrders(filters?: {
  projectId?: string;
  projectCode?: string;
  station?: IndustrialStation;
  /** Lista de gestão: incluir canceladas. Filas de estação: omitir (default). */
  includeCancelled?: boolean;
}) {
  return loadWorkOrders(filters);
}

export async function fetchWorkOrderDetail(workOrderId: string) {
  const [order, tasks] = await Promise.all([
    loadWorkOrderById(workOrderId),
    loadTasksByWorkOrder(workOrderId),
  ]);
  return { order, tasks };
}

export async function fetchStationTasks(station: IndustrialStation) {
  return loadTasksByStation(station);
}

export async function fetchPieceWorkOrderTasks(pieceId: string) {
  return loadTasksByPiece(pieceId);
}

const PIECE_OPERATION_TYPES = new Set<PieceOperationType>([
  'nesting',
  'cnc',
  'drill',
  'orlar',
  'montagem',
  'embalagem',
  'limpeza',
]);

function isPieceOperationType(value: string): value is PieceOperationType {
  return PIECE_OPERATION_TYPES.has(value as PieceOperationType);
}

async function resolvePieceOperation(pieceId: string, operationType: string): Promise<PieceOperation | null> {
  if (!isPieceOperationType(operationType)) return null;

  const persisted = await loadPieceOperations(pieceId);
  const match = persisted.find((row) => row.operationId.includes(operationType));
  if (match) {
    return {
      id: match.operationId,
      pieceId,
      type: operationType,
      status: match.status,
    };
  }

  return {
    id: `${pieceId}:${operationType}`,
    pieceId,
    type: operationType,
    status: 'queued',
  };
}

async function requireTask(taskId: string): Promise<IndustrialWorkOrderTask> {
  const task = await loadTaskById(taskId);
  if (!task) throw new Error(`Tarefa não encontrada: ${taskId}`);
  return task;
}

async function syncPieceOnTaskAction(
  task: IndustrialWorkOrderTask,
  action: 'start' | 'complete' | 'reject',
  industrialUserId: string,
  reason?: string,
) {
  const validation = await validateWorkOrderBeforeEvent(
    task.workOrderId,
    `syncPiece:task=${task.id}:piece=${task.pieceId}`,
  );
  if (!validation.ok) {
    notifyWorkOrderSyncError();
    throw new Error(validation.message ?? WORK_ORDER_SYNC_ERROR_MESSAGE);
  }

  const validatedWorkOrderId = validation.workOrderId!;
  const workOrderContext = { workOrderId: validatedWorkOrderId };
  const pieceOperation = await resolvePieceOperation(task.pieceId, task.operationType);

  if (pieceOperation) {
    if (action === 'start') {
      await updatePieceOperationState(task.pieceId, pieceOperation, 'start', {
        ...workOrderContext,
        userId: industrialUserId,
      });
      await updatePieceTime(
        task.pieceId,
        {
          operationId: pieceOperation.id,
          userId: industrialUserId,
          stationId: pieceOperation.type,
        },
        'start',
        { ...workOrderContext, userId: industrialUserId },
      );
    } else if (action === 'complete') {
      await updatePieceOperationState(task.pieceId, pieceOperation, 'finish', {
        ...workOrderContext,
        userId: industrialUserId,
      });
      await updatePieceTime(
        task.pieceId,
        { operationId: pieceOperation.id, userId: industrialUserId },
        'stop',
        { ...workOrderContext, userId: industrialUserId },
      );
    } else if (action === 'reject') {
      await updatePieceOperationState(task.pieceId, pieceOperation, 'reject', {
        ...workOrderContext,
        userId: industrialUserId,
        reason,
      });
    }
  }

  if (action === 'complete' && (task.operationType === 'embalagem' || task.operationType === 'montagem')) {
    await updatePieceQuality(task.pieceId, 'approved', {
      inspectorId: industrialUserId,
      ...workOrderContext,
      notes: `Aprovação automática na estação ${task.operationType}`,
    });
  }

  await logPieceEventAction(task.pieceId, {
    type: `work_order_task_${action}`,
    workOrderId: validatedWorkOrderId,
    userId: industrialUserId,
    metadata: {
      taskId: task.id,
      operationType: task.operationType,
      station: task.operationType,
      reason,
    },
  });
}

async function applyTaskStatus(
  task: IndustrialWorkOrderTask,
  status: WorkOrderTaskStatus,
  action: 'start' | 'complete' | 'reject',
  operatorId?: string,
  reason?: string,
  options: ApplyOptions = {},
) {
  const industrialUserId =
    options.resolvedUserId ?? (await resolveIndustrialUserId(operatorId));

  const updated = await updateTaskState({
    taskId: task.id,
    status,
    operatorId: industrialUserId,
    reason,
  });

  await logWorkOrderEvent({
    workOrderId: task.workOrderId,
    taskId: task.id,
    eventType: `task_${action}`,
    operatorId: industrialUserId,
    metadata: { pieceId: task.pieceId, operationType: task.operationType, reason },
  });

  // Evento de estação no mesmo fluxo (evita logTaskEvent extra + requireTask).
  if (options.stationEventType) {
    await logWorkOrderEvent({
      workOrderId: task.workOrderId,
      taskId: task.id,
      eventType: options.stationEventType,
      operatorId: industrialUserId,
      metadata: {
        pieceId: task.pieceId,
        operationType: task.operationType,
        ...(options.stationEventMetadata ?? {}),
      },
    });
  }

  await syncPieceOnTaskAction(task, action, industrialUserId, reason);

  if (!options.skipWorkOrderSync && task.workOrderId) {
    await syncWorkOrderStatusFromTasks(task.workOrderId);
  }
  return updated;
}

function stationApplyOptions(
  options: TaskActionOptions | undefined,
  stationEventType: string,
): ApplyOptions {
  return {
    skipWorkOrderSync: options?.skipWorkOrderSync,
    resolvedUserId: options?.resolvedUserId,
    stationEventType: options?.station ? stationEventType : undefined,
    stationEventMetadata: options?.station
      ? { station: options.station, bulk: true }
      : undefined,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        const value = await worker(items[index]!);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

function collectBulkResult(
  taskIds: string[],
  settled: PromiseSettledResult<IndustrialWorkOrderTask>[],
  pieceIdByTaskId?: Map<string, string>,
): BulkTaskResult {
  const ok: IndustrialWorkOrderTask[] = [];
  const failures: BulkTaskResult['failures'] = [];

  settled.forEach((result, index) => {
    const taskId = taskIds[index]!;
    if (result.status === 'fulfilled') {
      ok.push(result.value);
      return;
    }
    const msg = result.reason instanceof Error ? result.reason.message : 'Falha';
    failures.push({
      taskId,
      pieceId: pieceIdByTaskId?.get(taskId),
      error: msg,
    });
  });

  return { ok, failures };
}

export async function startTask(
  taskId: string,
  operatorId?: string,
  options?: TaskActionOptions,
) {
  const task = await requireTask(taskId);
  if (task.status !== 'pending') {
    throw new Error('Apenas tarefas pendentes podem ser iniciadas.');
  }
  const industrialUserId =
    options?.resolvedUserId ?? (await resolveIndustrialUserId(operatorId));
  return applyTaskStatus(
    task,
    'in_progress',
    'start',
    industrialUserId,
    undefined,
    {
      ...stationApplyOptions({ ...options, resolvedUserId: industrialUserId }, 'station_started'),
    },
  );
}

export async function finishTask(
  taskId: string,
  operatorId?: string,
  options?: TaskActionOptions,
) {
  const task = await requireTask(taskId);
  if (task.status === 'completed' || task.status === 'rejected') {
    throw new Error('Tarefa já finalizada.');
  }

  const industrialUserId =
    options?.resolvedUserId ?? (await resolveIndustrialUserId(operatorId));
  const applyOpts = stationApplyOptions(
    { ...options, resolvedUserId: industrialUserId },
    'station_confirmed',
  );

  if (task.status === 'pending') {
    await applyTaskStatus(task, 'in_progress', 'start', industrialUserId, undefined, {
      ...applyOpts,
      skipWorkOrderSync: true,
      stationEventType: undefined,
      stationEventMetadata: undefined,
    });
  }

  const current = task.status === 'pending' ? await requireTask(taskId) : task;
  return applyTaskStatus(current, 'completed', 'complete', industrialUserId, undefined, applyOpts);
}

export async function rejectTask(
  taskId: string,
  reason?: string,
  operatorId?: string,
  options?: TaskActionOptions,
) {
  const task = await requireTask(taskId);
  if (task.status === 'completed' || task.status === 'rejected') {
    throw new Error('Tarefa já finalizada.');
  }
  const industrialUserId =
    options?.resolvedUserId ?? (await resolveIndustrialUserId(operatorId));
  return applyTaskStatus(
    task,
    'rejected',
    'reject',
    industrialUserId,
    reason,
    stationApplyOptions({ ...options, resolvedUserId: industrialUserId }, 'station_rejected'),
  );
}

export async function startTasks(
  taskIds: string[],
  operatorId?: string,
  options?: { station?: string; concurrency?: number },
): Promise<BulkTaskResult> {
  if (taskIds.length === 0) return { ok: [], failures: [] };

  const industrialUserId = await resolveIndustrialUserId(operatorId);
  const concurrency = options?.concurrency ?? BULK_CONCURRENCY;
  const pieceIdByTaskId = new Map<string, string>();

  const settled = await mapPool(taskIds, concurrency, async (taskId) => {
    const updated = await startTask(taskId, industrialUserId, {
      station: options?.station,
      skipWorkOrderSync: true,
      resolvedUserId: industrialUserId,
    });
    pieceIdByTaskId.set(taskId, updated.pieceId);
    return updated;
  });

  const result = collectBulkResult(taskIds, settled, pieceIdByTaskId);
  const touchedOrders = Array.from(
    new Set(result.ok.map((task) => task.workOrderId).filter(Boolean)),
  );
  await syncWorkOrdersStatusFromTasks(touchedOrders);
  return result;
}

export async function finishTasks(
  taskIds: string[],
  operatorId?: string,
  options?: { station?: string; concurrency?: number },
): Promise<BulkTaskResult> {
  if (taskIds.length === 0) return { ok: [], failures: [] };

  const industrialUserId = await resolveIndustrialUserId(operatorId);
  const concurrency = options?.concurrency ?? BULK_CONCURRENCY;
  const pieceIdByTaskId = new Map<string, string>();

  const settled = await mapPool(taskIds, concurrency, async (taskId) => {
    const updated = await finishTask(taskId, industrialUserId, {
      station: options?.station,
      skipWorkOrderSync: true,
      resolvedUserId: industrialUserId,
    });
    pieceIdByTaskId.set(taskId, updated.pieceId);
    return updated;
  });

  const result = collectBulkResult(taskIds, settled, pieceIdByTaskId);
  const touchedOrders = Array.from(
    new Set(result.ok.map((task) => task.workOrderId).filter(Boolean)),
  );
  await syncWorkOrdersStatusFromTasks(touchedOrders);
  return result;
}

export async function rejectTasks(
  taskIds: string[],
  reason?: string,
  operatorId?: string,
  options?: { station?: string; concurrency?: number },
): Promise<BulkTaskResult> {
  if (taskIds.length === 0) return { ok: [], failures: [] };

  const industrialUserId = await resolveIndustrialUserId(operatorId);
  const concurrency = options?.concurrency ?? BULK_CONCURRENCY;
  const pieceIdByTaskId = new Map<string, string>();

  const settled = await mapPool(taskIds, concurrency, async (taskId) => {
    const updated = await rejectTask(taskId, reason, industrialUserId, {
      station: options?.station,
      skipWorkOrderSync: true,
      resolvedUserId: industrialUserId,
    });
    pieceIdByTaskId.set(taskId, updated.pieceId);
    return updated;
  });

  const result = collectBulkResult(taskIds, settled, pieceIdByTaskId);
  const touchedOrders = Array.from(
    new Set(result.ok.map((task) => task.workOrderId).filter(Boolean)),
  );
  await syncWorkOrdersStatusFromTasks(touchedOrders);
  return result;
}

export async function logTaskEvent(
  taskId: string,
  event: string,
  metadata?: Record<string, unknown>,
  operatorId?: string,
) {
  const task = await requireTask(taskId);
  return logWorkOrderEvent({
    workOrderId: task.workOrderId,
    taskId: task.id,
    eventType: event,
    operatorId,
    metadata: { pieceId: task.pieceId, operationType: task.operationType, ...metadata },
  });
}

export async function assignOperator(taskId: string, operatorId: string) {
  const task = await assignTaskOperator(taskId, operatorId);
  await logTaskEvent(taskId, 'operator_assigned', { operatorId }, operatorId);
  return task;
}

/**
 * Soft-cancel: marca a ordem como `cancelled` em `industrial_work_orders`.
 * Preserva tasks, eventos, tracking, tempo e qualidade.
 * Não usa o delete legado de `work_orders`.
 */
export async function cancelWorkOrder(
  workOrderId: string,
  operatorId?: string,
): Promise<IndustrialWorkOrder> {
  const order = await loadWorkOrderById(workOrderId);
  if (!order) throw new Error('Ordem de trabalho não encontrada.');
  if (order.status === 'cancelled') return order;
  if (order.status === 'completed') {
    throw new Error('Ordem já concluída — não pode ser cancelada.');
  }

  const industrialUserId = await resolveIndustrialUserId(operatorId);
  await updateWorkOrderStatus(workOrderId, 'cancelled');
  await logWorkOrderEvent({
    workOrderId,
    eventType: 'work_order_cancelled',
    operatorId: industrialUserId,
    metadata: {
      previousStatus: order.status,
      station: order.station,
      softCancel: true,
    },
  });

  const updated = await loadWorkOrderById(workOrderId);
  if (!updated) throw new Error('Ordem cancelada mas não foi possível recarregar.');
  return updated;
}

export interface ExecuteTaskInput {
  taskId: string;
  workOrderId: string;
  pieceId: string;
  operationType: string;
  action: 'start' | 'complete' | 'reject';
  operatorId?: string;
  reason?: string;
}

/** @deprecated Preferir startTask / finishTask / rejectTask */
export async function executeWorkOrderTask(input: ExecuteTaskInput) {
  if (input.action === 'start') return startTask(input.taskId, input.operatorId);
  if (input.action === 'complete') return finishTask(input.taskId, input.operatorId);
  return rejectTask(input.taskId, input.reason, input.operatorId);
}

const projectsApiDeps = {
  buildPimoProjectDataFromRequest,
  asObject,
  toMetaFromProjectData,
  toRecordFromProjectData,
  nowIso,
};

export type NqrMetadataRegenTaskUpdate = {
  taskId: string;
  workOrderId: string;
  pieceId: string;
  beforeNqr: string;
  afterNqr: string;
};

export type NqrMetadataRegenProjectReport = {
  projectId: string;
  projectName: string;
  workOrderIds: string[];
  updatedTasks: NqrMetadataRegenTaskUpdate[];
  skippedTasks: number;
};

export type NqrMetadataRegenReport = {
  affectedProjects: NqrMetadataRegenProjectReport[];
  regeneratedWorkOrderIds: string[];
  finalMetadataSamples: Array<{ taskId: string; nqrCode: string; fullIndustrialName: string }>;
  failures: Array<{ projectId: string; reason: string }>;
};

function mergeTaskMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, string>,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...patch };
}

function isStaleNqrMetadata(storedNqr: string, expectedNqr: string): boolean {
  const stored = storedNqr.trim();
  const expected = expectedNqr.trim();
  if (!stored || !expected) return stored !== expected;
  if (stored === expected) return false;

  const storedSeq = stored.match(/-(\d+)$/)?.[1];
  const expectedSeq = expected.match(/-(\d+)$/)?.[1];
  if (storedSeq === '1' && expectedSeq && expectedSeq !== '1') return true;

  return stored !== expected;
}

async function resolveCutlistContextForNqrRegen(projectId: string) {
  const local = resolveProjectCutlist(projectId);
  if (local) return local;

  const record = await remoteLoadProjectRecord(projectId, projectsApiDeps);
  if (!record) return null;
  return resolveProjectCutlistFromRecord(record);
}

/** Regenera metadata N‑QR v5 das tasks de um projeto (preserva estado operacional). */
export async function regenerateProjectWorkOrderNqrMetadata(
  projectId: string,
): Promise<NqrMetadataRegenProjectReport | null> {
  const context = await resolveCutlistContextForNqrRegen(projectId);
  if (!context) return null;

  const displayByPieceId = buildWorkOrderDisplayMapFromContext(context);

  const { data: orders, error: ordersError } = await supabase
    .from(WORK_ORDER_TABLES.orders)
    .select('id, station, status')
    .eq('project_id', projectId)
    .neq('status', 'cancelled');

  if (ordersError) throw new Error(ordersError.message);

  const workOrderIds = (orders ?? []).map((row) => String(row.id));
  if (workOrderIds.length === 0) {
    return {
      projectId,
      projectName: context.projectName,
      workOrderIds: [],
      updatedTasks: [],
      skippedTasks: 0,
    };
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from(WORK_ORDER_TABLES.tasks)
    .select('id, work_order_id, piece_id, metadata')
    .in('work_order_id', workOrderIds);

  if (tasksError) throw new Error(tasksError.message);

  const updatedTasks: NqrMetadataRegenTaskUpdate[] = [];
  let skippedTasks = 0;

  for (const row of taskRows ?? []) {
    const taskId = String(row.id);
    const pieceId = String(row.piece_id ?? '');
    const workOrderId = String(row.work_order_id ?? '');
    const display = displayByPieceId.get(pieceId);
    if (!display) {
      skippedTasks += 1;
      continue;
    }

    const expected = displayToTaskMetadata(display);
    const currentMeta = asObject(row.metadata) ?? {};
    const currentDisplay = readDisplayFromMetadata(currentMeta);
    const beforeNqr = currentDisplay?.nqrCode ?? String(currentMeta.nqr_code ?? '');

    const needsUpdate =
      isStaleNqrMetadata(beforeNqr, expected.nqr_code) ||
      String(currentMeta.full_industrial_name ?? '').trim() !== expected.full_industrial_name;

    if (!needsUpdate) {
      skippedTasks += 1;
      continue;
    }

    await patchWorkOrderTaskMetadata(taskId, mergeTaskMetadata(currentMeta, expected));
    updatedTasks.push({
      taskId,
      workOrderId,
      pieceId,
      beforeNqr,
      afterNqr: expected.nqr_code,
    });
  }

  return {
    projectId,
    projectName: context.projectName,
    workOrderIds,
    updatedTasks,
    skippedTasks,
  };
}

/** Regenera metadata N‑QR v5 de todas as WOs activas com seq legado incorrecto. */
export async function regenerateAllStaleWorkOrderNqrMetadata(): Promise<NqrMetadataRegenReport> {
  const { data: orderRows, error } = await supabase
    .from(WORK_ORDER_TABLES.orders)
    .select('id, project_id')
    .neq('status', 'cancelled');

  if (error) throw new Error(error.message);

  const projectIds = Array.from(
    new Set((orderRows ?? []).map((row) => String(row.project_id ?? '')).filter(Boolean)),
  );

  const affectedProjects: NqrMetadataRegenProjectReport[] = [];
  const regeneratedWorkOrderIds = new Set<string>();
  const finalMetadataSamples: NqrMetadataRegenReport['finalMetadataSamples'] = [];
  const failures: NqrMetadataRegenReport['failures'] = [];

  for (const projectId of projectIds) {
    try {
      const report = await regenerateProjectWorkOrderNqrMetadata(projectId);
      if (!report) {
        failures.push({ projectId, reason: 'Cutlist indisponível (offline + remoto).' });
        continue;
      }
      if (report.updatedTasks.length === 0) continue;

      affectedProjects.push(report);
      for (const woId of report.workOrderIds) regeneratedWorkOrderIds.add(woId);
      for (const update of report.updatedTasks.slice(0, 2)) {
        finalMetadataSamples.push({
          taskId: update.taskId,
          nqrCode: update.afterNqr,
          fullIndustrialName: '',
        });
      }
    } catch (err) {
      failures.push({
        projectId,
        reason: err instanceof Error ? err.message : 'Falha desconhecida.',
      });
    }
  }

  // Amostra final com nome industrial completo
  if (finalMetadataSamples.length > 0) {
    const taskIds = finalMetadataSamples.map((row) => row.taskId);
    const { data: refreshed } = await supabase
      .from(WORK_ORDER_TABLES.tasks)
      .select('id, metadata')
      .in('id', taskIds);
    for (const row of refreshed ?? []) {
      const sample = finalMetadataSamples.find((item) => item.taskId === String(row.id));
      if (!sample) continue;
      const meta = asObject(row.metadata);
      sample.fullIndustrialName = String(meta?.full_industrial_name ?? '').trim();
    }
  }

  return {
    affectedProjects,
    regeneratedWorkOrderIds: Array.from(regeneratedWorkOrderIds),
    finalMetadataSamples,
    failures,
  };
}
