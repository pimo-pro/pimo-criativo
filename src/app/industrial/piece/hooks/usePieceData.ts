import { useCallback, useEffect, useState } from 'react';

import { resolveIndustrialPieceRef } from '@/core/cutlayout/cutLayoutProPieceNaming';
import { buildEtiquetaQrPayloadV5 } from '@/core/etiquetas/qr/etiquetaCodeV5';
import { resolveAuthoritativeLabelNumber } from '@/core/qrcode/panelLabelNumber';
import { useAuth } from '@/auth/useAuth';
import {
  loadPieceOperations,
  loadPieceRemates,
  loadPieceTransforms,
  updatePieceOperationState,
  updatePieceQuality,
  updatePieceTime,
} from '@/industrial/api/pieceActions';
import { getEvents } from '@/industrial/core/events/actions';
import { updatePieceOperationStatus } from '@/industrial/core/piece-operations/actions';
import type { PieceOperation } from '@/industrial/core/piece-operations/types';
import type { QualityInspection } from '@/industrial/core/quality/types';
import { createQualityInspection } from '@/industrial/core/quality/actions';
import type { QualityDecision } from '@/industrial/core/quality/types';
import type { ReworkRequest } from '@/industrial/core/rework/types';
import { createReworkRequest } from '@/industrial/core/rework/actions';
import type { TimeTrackingEntry } from '@/industrial/core/time-tracking/types';
import { startTimeTracking, stopTimeTracking } from '@/industrial/core/time-tracking/actions';
import { resolvePieceTracking } from '../../../../industrial/tracking/resolvePieceTracking';
import type { IndustrialSystemEvent } from '@/industrial/infra/supabase/events';
import { loadPieceQuality } from '@/industrial/persistence/piece/savePieceQuality';
import { loadPieceTimeTracking } from '@/industrial/persistence/piece/savePieceTimeTracking';
import type { TrackingAction } from '@/industrial/persistence/tracking/updateTrackingState';

import type { PieceDataState, PieceTransformMap } from '../types';
import { resolvePieceContext } from '../utils/resolvePieceContext';

function eventMatchesPiece(event: IndustrialSystemEvent, pieceId: string): boolean {
  const meta = event.metadata ?? {};
  const values = [meta.piece_id, meta.pieceId, meta.source_item_id, meta.sourceItemId];
  return values.some((value) => String(value ?? '') === pieceId);
}

function mergeOperations(base: PieceOperation[], persisted: Awaited<ReturnType<typeof loadPieceOperations>>): PieceOperation[] {
  const byId = new Map(persisted.map((row) => [row.operationId, row]));
  return base.map((operation) => {
    const saved = byId.get(operation.id);
    if (!saved) return operation;
    return updatePieceOperationStatus(
      { ...operation, ...((saved.payload ?? {}) as Partial<PieceOperation>) },
      saved.status,
    );
  });
}

function parseQualityFromEvents(events: IndustrialSystemEvent[], pieceId: string): QualityInspection[] {
  return events
    .filter((e) => e.metadata?.quality_inspection || e.metadata?.quality)
    .map((event) => {
      const raw = event.metadata?.quality_inspection ?? event.metadata?.quality;
      if (!raw || typeof raw !== 'object') return null;
      const data = raw as Record<string, unknown>;
      return createQualityInspection({
        id: String(data.id ?? `${pieceId}:quality:${event.created_at}`),
        pieceId,
        decision: (data.decision as QualityInspection['decision']) ?? 'approved',
        points: Array.isArray(data.points) ? (data.points as QualityInspection['points']) : [],
        inspectorId: typeof data.inspectorId === 'string' ? data.inspectorId : event.user_id,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        notes: typeof data.notes === 'string' ? data.notes : undefined,
        createdAt: String(data.createdAt ?? event.created_at),
      });
    })
    .filter((item): item is QualityInspection => item !== null);
}

function parseReworkFromEvents(events: IndustrialSystemEvent[], pieceId: string): ReworkRequest[] {
  return events
    .filter(
      (e) =>
        eventMatchesPiece(e, pieceId) &&
        (String(e.type) === 'rework_requested' || Boolean(e.metadata?.rework)),
    )
    .map((event) => {
      const raw = event.metadata?.rework_request ?? event.metadata?.rework;
      const data = (raw && typeof raw === 'object' ? raw : event.metadata) as Record<string, unknown>;
      const request = createReworkRequest({
        id: String(data.id ?? `${pieceId}:rework:${event.created_at}`),
        pieceId,
        reason: String(data.reason ?? 'Retrabalho'),
        origin: (data.origin as ReworkRequest['origin']) ?? 'quality',
        createdAt: String(data.createdAt ?? event.created_at),
      });
      return {
        ...request,
        status: (data.status as ReworkRequest['status']) ?? request.status ?? 'open',
      };
    });
}

function persistedQualityToInspections(
  rows: Awaited<ReturnType<typeof loadPieceQuality>>,
  pieceId: string,
): QualityInspection[] {
  return rows.map((row, index) =>
    createQualityInspection({
      id: `${pieceId}:persisted-quality:${index}`,
      pieceId,
      decision: row.decision,
      reason: typeof row.payload?.reason === 'string' ? row.payload.reason : undefined,
      notes: typeof row.payload?.notes === 'string' ? row.payload.notes : undefined,
      createdAt: new Date().toISOString(),
    }),
  );
}

function persistedTimeToEntries(
  rows: Awaited<ReturnType<typeof loadPieceTimeTracking>>,
  pieceId: string,
): TimeTrackingEntry[] {
  return rows
    .map((row, index) => {
      const payload = row.payload;
      if (!payload || typeof payload !== 'object') return null;
      const started = startTimeTracking({
        id: String(payload.id ?? `${pieceId}:time:${index}`),
        pieceId,
        operationId: typeof payload.operationId === 'string' ? payload.operationId : undefined,
        workOrderId: typeof payload.workOrderId === 'string' ? payload.workOrderId : undefined,
        userId: String(payload.userId ?? 'operator'),
        stationId: typeof payload.stationId === 'string' ? payload.stationId : undefined,
        startedAt: String(payload.startedAt ?? new Date().toISOString()),
      });
      return payload.stoppedAt
        ? stopTimeTracking({ ...started, stoppedAt: String(payload.stoppedAt) })
        : started;
    })
    .filter((item): item is TimeTrackingEntry => item !== null);
}

function buildQrPayload(
  pieceId: string,
  context: ReturnType<typeof resolvePieceContext>,
): string {
  const item = context.cutlistItem;
  const projectName = context.projectName ?? 'PROJETO';
  const boxName = context.boxName;
  const pieceSeq = item ? resolveAuthoritativeLabelNumber(item) ?? 1 : 1;
  const industrialRef = item
    ? resolveIndustrialPieceRef(item, boxName, projectName)
    : (context.piece.name || pieceId);
  return buildEtiquetaQrPayloadV5({ industrialPieceRef: industrialRef, pieceSeq });
}

function transformsFromPersisted(rows: Awaited<ReturnType<typeof loadPieceTransforms>>): PieceTransformMap {
  return rows.reduce<PieceTransformMap>((acc, row) => {
    acc[row.entityId] = { position: row.position, rotation: row.rotation };
    return acc;
  }, {});
}

export function usePieceData(pieceId: string | undefined): PieceDataState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeTrackingEntry | null>(null);
  const [data, setData] = useState<Omit<PieceDataState, 'loading' | 'error' | 'saving' | 'reload' | 'runTrackingAction' | 'runQualityDecision' | 'startTime' | 'stopTime'>>({
    piece: null,
    operations: [],
    tracking: null,
    events: [],
    quality: [],
    rework: [],
    timeEntries: [],
    remates: [],
    rodapes: [],
    persistedTransforms: {},
    qrPayload: '',
  });

  const load = useCallback(async () => {
    if (!pieceId) {
      setLoading(false);
      setError('ID da peça em falta.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const context = resolvePieceContext(pieceId);
      const [
        allEvents,
        persistedTransforms,
        persistedOperations,
        persistedRemates,
        persistedQuality,
        persistedTime,
      ] = await Promise.all([
        getEvents({ limit: 250 }),
        loadPieceTransforms(pieceId).catch(() => []),
        loadPieceOperations(pieceId).catch(() => []),
        loadPieceRemates(pieceId).catch(() => []),
        loadPieceQuality(pieceId).catch(() => []),
        loadPieceTimeTracking(pieceId).catch(() => []),
      ]);

      const pieceEvents = allEvents.filter((event) => eventMatchesPiece(event, pieceId));
      const tracking = await resolvePieceTracking(pieceId, context.piece.workOrderId);

      const operations = mergeOperations(context.operations, persistedOperations);
      const quality = [
        ...persistedQualityToInspections(persistedQuality, pieceId),
        ...parseQualityFromEvents(pieceEvents, pieceId),
      ];
      const rework = parseReworkFromEvents(pieceEvents, pieceId);
      const timeEntries = [
        ...persistedTimeToEntries(persistedTime, pieceId),
        ...pieceEvents
          .filter((e) => e.metadata?.time_entry)
          .map((e) => e.metadata?.time_entry as TimeTrackingEntry),
      ].filter(Boolean);

      const remateOverrides = new Map(
        persistedRemates.filter((r) => r.entityType === 'remate').map((r) => [r.entityId, r.payload]),
      );
      const rodapeOverrides = new Map(
        persistedRemates.filter((r) => r.entityType === 'rodape').map((r) => [r.entityId, r.payload]),
      );

      setData({
        piece: context.piece,
        operations,
        tracking,
        events: pieceEvents,
        quality,
        rework,
        timeEntries,
        remates: context.remates.map((remate) => ({
          ...remate,
          ...(remateOverrides.get(remate.id) as Partial<typeof remate> | undefined),
        })),
        rodapes: context.rodapes.map((rodape) => ({
          ...rodape,
          ...(rodapeOverrides.get(rodape.id) as Partial<typeof rodape> | undefined),
        })),
        persistedTransforms: transformsFromPersisted(persistedTransforms),
        projectId: context.projectId,
        projectName: context.projectName,
        boxName: context.boxName,
        qrPayload: buildQrPayload(pieceId, context),
      });

      const running = timeEntries.find((entry) => !entry.stoppedAt);
      setActiveTimeEntry(running ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados da peça.');
    } finally {
      setLoading(false);
    }
  }, [pieceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runTrackingAction = useCallback(
    async (operationId: string, action: TrackingAction, reason?: string) => {
      if (!pieceId || !data.piece) return;
      const operation = data.operations.find((op) => op.id === operationId);
      if (!operation) return;
      setSaving(true);
      try {
        await updatePieceOperationState(pieceId, operation, action, {
          workOrderId: data.piece.workOrderId,
          userId: user?.id,
          reason,
        });
        await load();
      } finally {
        setSaving(false);
      }
    },
    [data.operations, data.piece, load, pieceId, user?.id],
  );

  const runQualityDecision = useCallback(
    async (decision: QualityDecision, reason?: string) => {
      if (!pieceId) return;
      setSaving(true);
      try {
        await updatePieceQuality(pieceId, decision, {
          inspectorId: user?.id,
          reason,
          workOrderId: data.piece?.workOrderId,
        });
        await load();
      } finally {
        setSaving(false);
      }
    },
    [data.piece?.workOrderId, load, pieceId, user?.id],
  );

  const startTime = useCallback(
    async (operationId?: string) => {
      if (!pieceId) return;
      setSaving(true);
      try {
        const entry = await updatePieceTime(
          pieceId,
          {
            operationId,
            userId: user?.id ?? 'operator',
            stationId: operationId,
          },
          'start',
          { workOrderId: data.piece?.workOrderId, userId: user?.id },
        );
        setActiveTimeEntry(entry);
        await load();
      } finally {
        setSaving(false);
      }
    },
    [data.piece?.workOrderId, load, pieceId, user?.id],
  );

  const stopTime = useCallback(async () => {
    if (!pieceId || !activeTimeEntry) return;
    setSaving(true);
    try {
      await updatePieceTime(pieceId, activeTimeEntry, 'stop', {
        workOrderId: data.piece?.workOrderId,
        userId: user?.id,
      });
      setActiveTimeEntry(null);
      await load();
    } finally {
      setSaving(false);
    }
  }, [activeTimeEntry, data.piece?.workOrderId, load, pieceId, user?.id]);

  return {
    ...data,
    loading,
    saving,
    error,
    reload: () => {
      void load();
    },
    runTrackingAction,
    runQualityDecision,
    startTime,
    stopTime,
  };
}
