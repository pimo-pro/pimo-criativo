import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { resolveProjectIdentity } from '@/core/projects/projectIdentity';
import {
  resolvePieceByCode,
  resolvePieceByCodeAsync,
} from '@/industrial/operador/resolvePieceByCode';
import { loadSupervisorDashboardSnapshot } from '@/industrial/persistence/supervisor/loadSupervisorData';
import type { SupervisorDashboardSnapshot } from '@/industrial/persistence/supervisor/types';
import { useIndustrialRealtime } from '@/industrial/realtime';
import { INDUSTRIAL_STATIONS, type IndustrialStation } from '@/industrial/work-orders/types';
import { resolveOrderProjectCode } from '@/industrial/work-orders/resolveWorkOrderPiece';
import { useIndustrialPageState } from '@/industrial/ui/components';

export type SupervisorMainMode = 'canvas' | 'chat' | 'info' | 'alerts';
export type SupervisorRailView = 'overview' | 'stations' | 'projects' | 'quality' | 'time' | 'chat' | 'alerts';

export type UseSupervisorDashboardOptions = {
  /** Slug / nome / id — pré-selecciona o projecto. */
  initialProjectKey?: string | null;
};

export function useSupervisorDashboard(options: UseSupervisorDashboardOptions = {}) {
  useIndustrialPageState();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stationFromQuery = searchParams.get('station');
  const pieceFromQuery = searchParams.get('piece');
  const initialIdentity = useMemo(
    () => (options.initialProjectKey?.trim() ? resolveProjectIdentity(options.initialProjectKey) : null),
    [options.initialProjectKey],
  );

  const [snapshot, setSnapshot] = useState<SupervisorDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainMode, setMainMode] = useState<SupervisorMainMode>('canvas');
  const [railView, setRailView] = useState<SupervisorRailView>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => initialIdentity?.persistenceId ?? null,
  );
  const [selectedStation, setSelectedStation] = useState<IndustrialStation | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [detailModal, setDetailModal] = useState<{ title: string; body: string } | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadRef = useRef<() => Promise<void>>(async () => undefined);

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      void reloadRef.current();
    }, 800);
  }, []);

  const realtime = useIndustrialRealtime({
    mode: 'supervisor',
    onDataRefresh: scheduleReload,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadSupervisorDashboardSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar supervisor.');
    } finally {
      setLoading(false);
    }
  }, []);

  reloadRef.current = reload;

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (initialIdentity?.persistenceId) {
      setSelectedProjectId(initialIdentity.persistenceId);
      setRailView('projects');
      setMainMode('info');
    }
  }, [initialIdentity?.persistenceId]);

  useEffect(() => {
    if (stationFromQuery && INDUSTRIAL_STATIONS.includes(stationFromQuery as IndustrialStation)) {
      setSelectedStation(stationFromQuery as IndustrialStation);
      setRailView('stations');
      setMainMode('info');
    }
  }, [stationFromQuery]);

  useEffect(() => {
    if (!pieceFromQuery || !snapshot) return;
    const task =
      snapshot.tasks.find((t) => t.pieceId === pieceFromQuery) ??
      snapshot.tasks.find((t) => t.display?.nqrCode === pieceFromQuery);
    if (task) setSelectedTaskId(task.id);
  }, [pieceFromQuery, snapshot]);

  const alerts = useMemo(() => {
    const snapshotAlerts = snapshot?.alerts ?? [];
    const merged = [...realtime.realtimeAlerts, ...snapshotAlerts];
    const seen = new Set<string>();
    const unique = merged.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    return unique.filter((a) => !dismissedAlerts.includes(a.id));
  }, [snapshot?.alerts, realtime.realtimeAlerts, dismissedAlerts]);

  const filteredTasks = useMemo(() => {
    if (!snapshot) return [];
    const filterIdentity = selectedProjectId
      ? resolveProjectIdentity(selectedProjectId) ?? initialIdentity
      : initialIdentity;
    return snapshot.tasks.filter((task) => {
      if (selectedProjectId || filterIdentity) {
        const order = snapshot.orders.find((o) => o.id === task.workOrderId);
        if (!order) return false;
        const ids = new Set(
          [
            selectedProjectId,
            filterIdentity?.localId,
            filterIdentity?.remoteId,
            filterIdentity?.persistenceId,
          ].filter(Boolean) as string[],
        );
        const idMatch = ids.has(order.projectId);
        const codeMatch = filterIdentity?.projectCode
          ? resolveOrderProjectCode(order).toUpperCase() === filterIdentity.projectCode
          : false;
        if (!idMatch && !codeMatch) return false;
      }
      if (selectedStation && task.operationType !== selectedStation) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      return true;
    });
  }, [snapshot, selectedProjectId, selectedStation, statusFilter, initialIdentity]);

  const selectedTask = useMemo(
    () => snapshot?.tasks.find((t) => t.id === selectedTaskId) ?? null,
    [snapshot?.tasks, selectedTaskId],
  );

  const openDetail = useCallback((title: string, body: string) => {
    setDetailModal({ title, body });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => [...prev, id]);
  }, []);

  const selectRail = useCallback((view: SupervisorRailView) => {
    setRailView(view);
    if (view === 'chat') setMainMode('chat');
    else if (view === 'alerts') setMainMode('alerts');
    else if (view === 'overview') setMainMode('canvas');
    else setMainMode('info');
  }, []);

  const submitNqr = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;

      const lookup = resolvePieceByCode(code) ?? (await resolvePieceByCodeAsync(code));
      const pieceKey = lookup?.pieceId ?? lookup?.etiquetaCode ?? code;
      const task =
        snapshot?.tasks.find(
          (t) =>
            t.pieceId === pieceKey ||
            t.display?.nqrCode === code ||
            t.display?.nqrCode === pieceKey ||
            t.display?.fullIndustrialName === code,
        ) ?? null;

      if (task) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('piece', pieceKey);
            return next;
          },
          { replace: true },
        );
        setSelectedTaskId(task.id);
        setRailView('overview');
        setMainMode('info');
        return;
      }

      if (lookup?.pieceId) {
        navigate(`/industrial/piece/${encodeURIComponent(lookup.pieceId)}`);
        return;
      }

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('piece', code);
          return next;
        },
        { replace: true },
      );
    },
    [navigate, setSearchParams, snapshot?.tasks],
  );

  return {
    snapshot,
    loading,
    error,
    mainMode,
    setMainMode,
    railView,
    selectRail,
    selectedProjectId,
    setSelectedProjectId,
    selectedStation,
    setSelectedStation,
    selectedTaskId,
    setSelectedTaskId,
    statusFilter,
    setStatusFilter,
    filteredTasks,
    selectedTask,
    alerts,
    notificationsOpen,
    setNotificationsOpen,
    dismissAlert,
    detailModal,
    setDetailModal,
    openDetail,
    reload,
    realtimeConnected: realtime.connected,
    stationStatuses: realtime.stationStatuses,
    canvasRevision: realtime.canvasRevision,
    lastThreeSync: realtime.lastThreeSync,
    typingUsers: realtime.typingUsers,
    sendRealtimeChat: realtime.sendChatMessage,
    sendRealtimeTyping: realtime.sendTyping,
    mergeChatConversations: realtime.mergeChatConversations,
    submitNqr,
  };
}

export type UseSupervisorDashboardReturn = ReturnType<typeof useSupervisorDashboard>;
