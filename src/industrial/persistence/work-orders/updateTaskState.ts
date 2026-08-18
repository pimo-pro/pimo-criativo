import { supabase } from '@/industrial/infra/db';
import type { WorkOrderStatus, WorkOrderTaskStatus } from '@/industrial/work-orders/types';

import { mapTaskRow } from './mappers';
import { WORK_ORDER_TABLES } from './tables';
import type { IndustrialWorkOrderTask } from '@/industrial/work-orders/types';

export interface UpdateTaskStateInput {
  taskId: string;
  status: WorkOrderTaskStatus;
  operatorId?: string;
  reason?: string;
}

function timestampFieldForStatus(status: WorkOrderTaskStatus): Partial<{
  started_at: string;
  completed_at: string;
  rejected_at: string;
}> {
  const now = new Date().toISOString();
  if (status === 'in_progress') return { started_at: now };
  if (status === 'completed') return { completed_at: now };
  if (status === 'rejected') return { rejected_at: now };
  return {};
}

export async function updateTaskState(input: UpdateTaskStateInput): Promise<IndustrialWorkOrderTask> {
  const now = new Date().toISOString();
  const patch = {
    status: input.status,
    operator_id: input.operatorId ?? null,
    updated_at: now,
    ...timestampFieldForStatus(input.status),
    ...(input.reason ? { metadata: { rejectReason: input.reason } } : {}),
  };

  const { data, error } = await supabase
    .from(WORK_ORDER_TABLES.tasks)
    .update(patch)
    .eq('id', input.taskId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Falha ao atualizar tarefa.');
  return mapTaskRow(data);
}

export async function assignTaskOperator(taskId: string, operatorId: string): Promise<IndustrialWorkOrderTask> {
  const { data, error } = await supabase
    .from(WORK_ORDER_TABLES.tasks)
    .update({
      operator_id: operatorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Falha ao atribuir operador.');
  return mapTaskRow(data);
}

export async function updateWorkOrderStatus(workOrderId: string, status: WorkOrderStatus): Promise<void> {
  const { error } = await supabase
    .from(WORK_ORDER_TABLES.orders)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', workOrderId);

  if (error) throw new Error(error.message);
}

export async function syncWorkOrderStatusFromTasks(workOrderId: string): Promise<WorkOrderStatus> {
  const { data: orderRow, error: orderError } = await supabase
    .from(WORK_ORDER_TABLES.orders)
    .select('status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (orderRow?.status === 'cancelled') return 'cancelled';

  const { data, error } = await supabase
    .from(WORK_ORDER_TABLES.tasks)
    .select('status')
    .eq('work_order_id', workOrderId);

  if (error) throw new Error(error.message);

  const statuses = (data ?? []).map((row) => row.status as WorkOrderTaskStatus);
  let next: WorkOrderStatus = 'pending';

  if (statuses.length > 0 && statuses.every((s) => s === 'completed' || s === 'rejected')) {
    next = 'completed';
  } else if (statuses.some((s) => s === 'in_progress' || s === 'completed' || s === 'rejected')) {
    next = 'in_progress';
  }

  await updateWorkOrderStatus(workOrderId, next);
  return next;
}

/** Sincroniza o status de várias WO — uma passagem por id único. */
export async function syncWorkOrdersStatusFromTasks(workOrderIds: string[]): Promise<void> {
  const unique = Array.from(new Set(workOrderIds.filter(Boolean)));
  for (const id of unique) {
    await syncWorkOrderStatusFromTasks(id);
  }
}

/** Reescreve metadata industrial da tarefa (N‑QR v5, nome completo, códigos). */
export async function patchWorkOrderTaskMetadata(
  taskId: string,
  metadata: Record<string, unknown>,
): Promise<IndustrialWorkOrderTask> {
  const { data, error } = await supabase
    .from(WORK_ORDER_TABLES.tasks)
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Falha ao actualizar metadata da tarefa.');
  return mapTaskRow(data);
}
