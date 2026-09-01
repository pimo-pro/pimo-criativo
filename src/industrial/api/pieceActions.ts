import type { QualityDecision } from '@/industrial/core/quality/types';
import type { RematePiece } from '@/core/remate/remateTypes';
import type { ProjectRodape } from '@/core/rodape/rodapeTypes';

import { logPieceEvent } from '@/industrial/persistence/events/logEvent';
import { savePieceEdges, type SavePieceEdgesInput } from '@/industrial/persistence/piece/savePieceEdges';
import { savePieceEvents } from '@/industrial/persistence/piece/savePieceEvents';
import {
  loadPieceOperations,
  savePieceOperations,
} from '@/industrial/persistence/piece/savePieceOperations';
import { savePieceQuality } from '@/industrial/persistence/piece/savePieceQuality';
import {
  loadPieceRemates,
  savePieceRemates,
  type SavePieceRematesInput,
} from '@/industrial/persistence/piece/savePieceRemates';
import { savePieceTimeTracking } from '@/industrial/persistence/piece/savePieceTimeTracking';
import {
  loadPieceTransforms,
  savePieceTransform,
  type SavePieceTransformInput,
} from '@/industrial/persistence/piece/savePieceTransform';
import { updateQualityState } from '@/industrial/persistence/quality/updateQualityState';
import { startPieceTime, stopPieceTime } from '@/industrial/persistence/time/updateTimeTracking';
import {
  updateTrackingState,
  type TrackingAction,
} from '@/industrial/persistence/tracking/updateTrackingState';
import type { PieceEventPayload } from '@/industrial/persistence/shared/types';
import type { PieceOperation } from '@/industrial/core/piece-operations/types';
import type { TimeTrackingEntry } from '@/industrial/core/time-tracking/types';

export async function updatePieceTransform(pieceId: string, transform: SavePieceTransformInput) {
  return savePieceTransform(pieceId, transform);
}

export async function updatePieceOperationState(
  pieceId: string,
  operation: PieceOperation,
  action: TrackingAction,
  context?: { workOrderId?: string; userId?: string; reason?: string },
) {
  return updateTrackingState(pieceId, operation, action, context);
}

export async function updatePieceQuality(
  pieceId: string,
  decision: QualityDecision,
  context?: { inspectorId?: string; reason?: string; notes?: string; workOrderId?: string },
) {
  return updateQualityState(pieceId, decision, context);
}

export async function updatePieceTime(
  pieceId: string,
  timePayload: Record<string, unknown> | TimeTrackingEntry,
  action: 'start' | 'stop',
  context?: { workOrderId?: string; userId?: string },
) {
  if (action === 'start') {
    return startPieceTime(pieceId, {
      operationId: typeof timePayload.operationId === 'string' ? timePayload.operationId : undefined,
      workOrderId: context?.workOrderId,
      userId: String(timePayload.userId ?? context?.userId ?? 'operator'),
      stationId: typeof timePayload.stationId === 'string' ? timePayload.stationId : undefined,
    });
  }
  return stopPieceTime(pieceId, timePayload as TimeTrackingEntry, context);
}

export async function logPieceEventAction(pieceId: string, eventPayload: PieceEventPayload) {
  return savePieceEvents(pieceId, eventPayload);
}

export async function updatePieceRemates(
  pieceId: string,
  rematesPayload: {
    remates?: RematePiece[];
    rodapes?: ProjectRodape[];
    entity?: SavePieceRematesInput;
  },
) {
  if (rematesPayload.entity) {
    return savePieceRemates(pieceId, rematesPayload.entity);
  }

  const results: unknown[] = [];
  for (const remate of rematesPayload.remates ?? []) {
    const saved = await savePieceRemates(pieceId, {
      entityId: remate.id,
      entityType: 'remate',
      payload: remate as unknown as Record<string, unknown>,
    });
    if (!saved.ok) return saved;
    results.push(saved.data);
  }
  for (const rodape of rematesPayload.rodapes ?? []) {
    const saved = await savePieceRemates(pieceId, {
      entityId: rodape.id,
      entityType: 'rodape',
      payload: rodape as unknown as Record<string, unknown>,
    });
    if (!saved.ok) return saved;
    results.push(saved.data);
  }
  return { ok: true as const, data: results };
}

export async function updatePieceEdgeSelection(pieceId: string, input: SavePieceEdgesInput) {
  await savePieceEdges(pieceId, input);
  return logPieceEvent(pieceId, {
    type: 'piece_selected',
    metadata: input.payload,
  });
}

export {
  loadPieceTransforms,
  loadPieceRemates,
  loadPieceOperations,
  savePieceOperations,
  savePieceQuality,
  savePieceTimeTracking,
};
