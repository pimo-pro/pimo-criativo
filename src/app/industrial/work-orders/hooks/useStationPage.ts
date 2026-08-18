import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useAuth } from '@/auth/useAuth';
import { parseBarcode } from '@/industrial/core/barcode/actions';
import { useIndustrialRealtime } from '@/industrial/realtime';
import {
  fetchStationTasks,
  fetchWorkOrders,
  finishTasks,
  logTaskEvent,
  rejectTasks,
  startTasks,
} from '@/industrial/api/workOrderActions';
import type {
  IndustrialStation,
  IndustrialWorkOrder,
  IndustrialWorkOrderTask,
  WorkOrderTaskStatus,
} from '@/industrial/work-orders/types';
import { STATION_LABELS } from '@/industrial/work-orders/types';
import type {
  StationActionFeedback,
  StationBulkAction,
  StationChatConversation,
  StationNotification,
  StationToolMode,
} from '@/industrial/ui/components/stationTypes';
import { useIndustrialPageState } from '@/industrial/ui/components';
import { resolveProjectIdentity } from '@/core/projects/projectIdentity';
import { resolveOrderProjectCode } from '@/industrial/work-orders/resolveWorkOrderPiece';

import { buildCanvasPieces, buildStationListSections } from '../utils/stationListData';
import { getStationConfig, getStationPageTitle } from '../stationConfigs';

function buildNotifications(
  _station: IndustrialStation,
  tasks: IndustrialWorkOrderTask[],
  enableSupervisor: boolean,
): StationNotification[] {
  const now = new Date().toISOString();
  const notes: StationNotification[] = [];
  const pending = tasks.filter((t) => t.status === 'pending');
  const running = tasks.filter((t) => t.status === 'in_progress');
  const rejected = tasks.filter((t) => t.status === 'rejected');

  if (pending.length > 0) {
    notes.push({
      id: 'task-pending',
      type: 'task',
      title: 'Tarefas pendentes',
      message: `${pending.length} tarefa(s) aguardam execução.`,
      createdAt: now,
    });
  }

  if (rejected.length > 0) {
    notes.push({
      id: 'quality-rejected',
      type: 'quality',
      title: 'Qualidade',
      message: `${rejected.length} tarefa(s) rejeitada(s).`,
      createdAt: now,
    });
  }

  if (running.length > 0) {
    notes.push({
      id: 'time-running',
      type: 'time',
      title: 'Tempo activo',
      message: `${running.length} operação(ões) em curso.`,
      createdAt: now,
    });
  }

  if (enableSupervisor) {
    notes.push({
      id: 'supervisor',
      type: 'supervisor',
      title: 'Supervisor disponível',
      message: 'Canal de chat activo para apoio de montagem.',
      createdAt: now,
    });
  }

  return notes;
}

function initialConversations(station: IndustrialStation, enableSupervisor: boolean): StationChatConversation[] {
  const base: StationChatConversation[] = [
    {
      id: 'station',
      title: 'Estação',
      messages: [
        {
          id: 'welcome',
          author: 'Sistema',
          body: `Estação ${station} pronta para execução.`,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ];

  if (enableSupervisor) {
    base.push({
      id: 'supervisor',
      title: 'Supervisor',
      messages: [
        {
          id: 'sup-welcome',
          author: 'Supervisor',
          body: 'Disponível para apoio na montagem.',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  return base;
}

const STATUS_LABEL: Record<IndustrialWorkOrderTask['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em execução',
  completed: 'Concluído',
  rejected: 'Rejeitado',
};

const ACTION_LABEL: Record<StationBulkAction, string> = {
  start: 'Iniciar',
  complete: 'Concluir',
  reject: 'Rejeitar',
};

export type UseStationPageOptions = {
  /** Quando definido, filtra ordens/tarefas à work order (página Ordem · Estação). */
  workOrderId?: string | null;
  /** Slug / nome do projecto — filtra por projectCode. */
  projectSlug?: string | null;
};

export function useStationPage(station: IndustrialStation, options: UseStationPageOptions = {}) {
  useIndustrialPageState();
  const { user } = useAuth();
  const config = getStationConfig(station);
  const workOrderId = options.workOrderId?.trim() || null;
  const projectIdentity = useMemo(
    () => (options.projectSlug?.trim() ? resolveProjectIdentity(options.projectSlug) : null),
    [options.projectSlug],
  );
  const projectCodeFilter = projectIdentity?.projectCode || null;

  const [orders, setOrders] = useState<IndustrialWorkOrder[]>([]);
  const [tasks, setTasks] = useState<IndustrialWorkOrderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [selectedTask, setSelectedTask] = useState<IndustrialWorkOrderTask | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<StationActionFeedback | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolMode, setToolMode] = useState<StationToolMode>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(config.enableSupervisorChat ?? false);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [conversations, setConversations] = useState<StationChatConversation[]>(() =>
    initialConversations(station, config.enableSupervisorChat ?? false),
  );
  const [activeConversationId, setActiveConversationId] = useState(
    config.enableSupervisorChat ? 'supervisor' : 'station',
  );
  const [eventLog, setEventLog] = useState<Array<{ id: string; type: string; at: string }>>([]);
  const reloadRef = useRef<(opts?: { quiet?: boolean }) => Promise<void>>(async () => undefined);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const busyRef = useRef(false);

  const scheduleReload = useCallback(() => {
    if (busyRef.current) return;
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      void reloadRef.current({ quiet: true });
    }, 800);
  }, []);

  const realtime = useIndustrialRealtime({
    mode: 'station',
    station,
    onDataRefresh: scheduleReload,
  });

  const reload = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const [orderRows, taskRows] = await Promise.all([
        fetchWorkOrders({
          station,
          projectCode: projectCodeFilter || undefined,
        }),
        fetchStationTasks(station),
      ]);
      let filteredOrders = workOrderId
        ? orderRows.filter((order) => order.id === workOrderId)
        : orderRows;
      if (projectCodeFilter) {
        filteredOrders = filteredOrders.filter(
          (order) => resolveOrderProjectCode(order).toUpperCase() === projectCodeFilter,
        );
      }
      const orderIds = new Set(filteredOrders.map((o) => o.id));
      let filteredTasks = workOrderId
        ? taskRows.filter((task) => task.workOrderId === workOrderId)
        : taskRows;
      if (projectCodeFilter || workOrderId) {
        filteredTasks = filteredTasks.filter((task) => orderIds.has(task.workOrderId));
      }
      setOrders(filteredOrders);
      setTasks(filteredTasks);
      setSelectedTask((current) => {
        if (!current) return null;
        return filteredTasks.find((t) => t.id === current.id) ?? null;
      });
      setSelectedTaskIds((prev) => prev.filter((id) => filteredTasks.some((t) => t.id === id)));
    } catch (err) {
      if (!opts?.quiet) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estação.');
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [station, workOrderId, projectCodeFilter]);

  reloadRef.current = reload;

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [tasks],
  );

  const sections = useMemo(
    () => buildStationListSections(station, tasks, orders),
    [station, tasks, orders],
  );

  const selectedTasks = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return selectedTaskIds.map((id) => byId.get(id)).filter((t): t is IndustrialWorkOrderTask => Boolean(t));
  }, [selectedTaskIds, tasks]);

  const selectedPieceIds = useMemo(
    () => Array.from(new Set(selectedTasks.map((t) => t.pieceId))),
    [selectedTasks],
  );

  const canvasPieces = useMemo(
    () => buildCanvasPieces(tasks, orders, selectedPieceIds.length > 0 ? selectedPieceIds : selectedPieceId),
    [tasks, orders, selectedPieceIds, selectedPieceId, realtime.canvasRevision],
  );

  const notifications = useMemo(() => {
    const base = buildNotifications(station, tasks, config.enableSupervisorChat ?? false);
    const merged = [...realtime.realtimeNotifications, ...base];
    const seen = new Set<string>();
    const unique = merged.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    return unique.filter((n) => !dismissedNotifications.includes(n.id));
  }, [station, tasks, config.enableSupervisorChat, realtime.realtimeNotifications, dismissedNotifications]);

  const liveConversations = useMemo(
    () => realtime.mergeChatConversations(conversations),
    [conversations, realtime],
  );

  const resolveTaskFromCode = useCallback(
    (raw: string): IndustrialWorkOrderTask | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const parsed = parseBarcode(trimmed);
      const pieceId = parsed?.entityType === 'piece' ? parsed.id : trimmed;
      const needle = trimmed.toLowerCase();
      const nameWithoutSeq = trimmed.replace(/-\d+$/, '').toLowerCase();

      const matchesDisplay = (task: IndustrialWorkOrderTask): boolean => {
        const d = task.display;
        if (!d) return false;
        const candidates = [d.nqrCode, d.fullIndustrialName, d.pieceCode, d.projectCode, d.boxCode];
        return candidates.some((value) => {
          const v = String(value ?? '').trim();
          if (!v) return false;
          const lower = v.toLowerCase();
          return (
            v === trimmed ||
            v === pieceId ||
            lower === needle ||
            lower === nameWithoutSeq ||
            trimmed.startsWith(`${v}-`) ||
            v.startsWith(`${trimmed}-`)
          );
        });
      };

      return (
        activeTasks.find((t) => t.pieceId === pieceId) ??
        activeTasks.find((t) => t.pieceId.includes(pieceId) || pieceId.includes(t.pieceId)) ??
        activeTasks.find((t) => t.display?.nqrCode === trimmed || t.display?.nqrCode === pieceId) ??
        activeTasks.find(matchesDisplay) ??
        null
      );
    },
    [activeTasks],
  );

  const focusTask = useCallback((task: IndustrialWorkOrderTask | null) => {
    setSelectedTask(task);
    setSelectedPieceId(task?.pieceId ?? null);
  }, []);

  /** Compat: selecção única (substitui lista). */
  const selectTask = useCallback(
    (task: IndustrialWorkOrderTask | null) => {
      if (!task) {
        setSelectedTaskIds([]);
        focusTask(null);
        return;
      }
      setSelectedTaskIds([task.id]);
      focusTask(task);
    },
    [focusTask],
  );

  const addTaskToSelection = useCallback(
    (task: IndustrialWorkOrderTask) => {
      setSelectedTaskIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));
      focusTask(task);
      setError(null);
      setActionFeedback(null);
    },
    [focusTask],
  );

  const toggleTaskSelection = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      setSelectedTaskIds((prev) => {
        if (prev.includes(taskId)) {
          const next = prev.filter((id) => id !== taskId);
          const lastId = next[next.length - 1];
          const last = lastId ? tasks.find((t) => t.id === lastId) ?? null : null;
          focusTask(last);
          return next;
        }
        focusTask(task);
        return [...prev, taskId];
      });
      setError(null);
      setActionFeedback(null);
    },
    [focusTask, tasks],
  );

  const removeFromSelection = useCallback(
    (taskId: string) => {
      setSelectedTaskIds((prev) => {
        const next = prev.filter((id) => id !== taskId);
        const lastId = next[next.length - 1];
        const last = lastId ? tasks.find((t) => t.id === lastId) ?? null : null;
        focusTask(last);
        return next;
      });
    },
    [focusTask, tasks],
  );

  const clearSelection = useCallback(() => {
    setSelectedTaskIds([]);
    focusTask(null);
    setActionFeedback(null);
  }, [focusTask]);

  /** Marca todas as tarefas activas do filtro actual (ordem / projecto / estação). */
  const selectAllTasks = useCallback(() => {
    const ids = activeTasks.map((task) => task.id);
    setSelectedTaskIds(ids);
    focusTask(activeTasks[activeTasks.length - 1] ?? null);
    setError(null);
    setActionFeedback(null);
  }, [activeTasks, focusTask]);

  const addCodeToSelection = useCallback(
    (raw?: string) => {
      setError(null);
      setActionFeedback(null);
      const code = (raw ?? codeInput).trim();
      if (!code) {
        setError('Introduza um código QR ou barcode.');
        return false;
      }

      // Suporta colagem de vários códigos (linhas / vírgulas / espaços).
      const parts = code
        .split(/[\n\r,;\t]+/)
        .map((p) => p.trim())
        .filter(Boolean);

      if (parts.length > 1) {
        let added = 0;
        let last: IndustrialWorkOrderTask | null = null;
        const missing: string[] = [];
        for (const part of parts) {
          const match = resolveTaskFromCode(part);
          if (!match) {
            missing.push(part);
            continue;
          }
          setSelectedTaskIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
          last = match;
          added += 1;
        }
        if (last) focusTask(last);
        setCodeInput('');
        if (added === 0) {
          setError('Nenhuma tarefa activa encontrada para os códigos.');
          return false;
        }
        if (missing.length > 0) {
          setError(`${added} adicionada(s); não encontradas: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`);
        }
        requestAnimationFrame(() => codeInputRef.current?.focus());
        return true;
      }

      const match = resolveTaskFromCode(code);
      if (!match) {
        setError('Nenhuma tarefa activa encontrada para este código.');
        return false;
      }
      addTaskToSelection(match);
      setCodeInput('');
      requestAnimationFrame(() => codeInputRef.current?.focus());
      return true;
    },
    [addTaskToSelection, codeInput, focusTask, resolveTaskFromCode],
  );

  const handleCodeSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      addCodeToSelection();
    },
    [addCodeToSelection],
  );

  const handleBulkAction = useCallback(
    async (action: StationBulkAction) => {
      if (selectedTaskIds.length === 0) {
        setError('Seleccione pelo menos uma peça (QR ou checkbox).');
        setActionFeedback({ ok: false, message: 'Nenhuma peça seleccionada.' });
        return;
      }

      const targetIds = [...selectedTaskIds];
      const targets = targetIds
        .map((id) => tasks.find((t) => t.id === id))
        .filter((t): t is IndustrialWorkOrderTask => Boolean(t));
      const pieceByTaskId = new Map(targets.map((t) => [t.id, t.pieceId]));

      const optimisticStatus: WorkOrderTaskStatus =
        action === 'start' ? 'in_progress' : action === 'complete' ? 'completed' : 'rejected';

      busyRef.current = true;
      setBusy(true);
      setError(null);
      setActionFeedback(null);

      // UI optimista: o operador vê o resultado de imediato.
      setTasks((prev) =>
        prev.map((task) =>
          targetIds.includes(task.id) ? { ...task, status: optimisticStatus } : task,
        ),
      );
      setEventLog((prev) => [
        {
          id: `${Date.now()}-bulk-${action}`,
          type: `${action}:bulk:${targetIds.length}`,
          at: new Date().toISOString(),
        },
        ...prev,
      ]);

      try {
        const result =
          action === 'start'
            ? await startTasks(targetIds, user?.id, { station })
            : action === 'complete'
              ? await finishTasks(targetIds, user?.id, { station })
              : await rejectTasks(targetIds, 'Rejeitado em grupo na estação', user?.id, {
                  station,
                });

        const okCount = result.ok.length;
        const failures = result.failures.map((failure) => {
          const pieceId = failure.pieceId ?? pieceByTaskId.get(failure.taskId) ?? failure.taskId;
          return `${pieceId}: ${failure.error}`;
        });
        const label = ACTION_LABEL[action];

        if (failures.length === 0) {
          setActionFeedback({
            ok: true,
            message: `${label}: ${okCount} peça(s) actualizada(s).`,
          });
          setSelectedTaskIds([]);
          focusTask(null);
          setCodeInput('');
        } else if (okCount > 0) {
          const failedIds = new Set(result.failures.map((f) => f.taskId));
          setActionFeedback({
            ok: false,
            message: `${label}: ${okCount} ok, ${failures.length} falha(s). ${failures[0]}`,
          });
          setError(failures.slice(0, 2).join(' · '));
          setSelectedTaskIds(targetIds.filter((id) => failedIds.has(id)));
        } else {
          setActionFeedback({
            ok: false,
            message: `${label} falhou: ${failures[0] ?? 'erro desconhecido'}`,
          });
          setError(failures[0] ?? `${label} falhou.`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha no processamento em lote.';
        setActionFeedback({ ok: false, message: msg });
        setError(msg);
      } finally {
        try {
          await reload({ quiet: true });
        } finally {
          busyRef.current = false;
          setBusy(false);
          requestAnimationFrame(() => codeInputRef.current?.focus());
        }
      }
    },
    [focusTask, reload, selectedTaskIds, station, tasks, user?.id],
  );

  /** Compat legado: concluir a peça em foco / seleccionadas. */
  const handleConfirm = useCallback(async () => {
    await handleBulkAction('complete');
  }, [handleBulkAction]);

  const handleReject = useCallback(async () => {
    await handleBulkAction('reject');
  }, [handleBulkAction]);

  const handleStart = useCallback(async () => {
    await handleBulkAction('start');
  }, [handleBulkAction]);

  const handleSendChatMessage = useCallback(
    (body: string, eventAttachment?: string) => {
      const convId = activeConversationId;
      const author = user?.id ?? 'Operador';
      const scopeId =
        convId === 'supervisor'
          ? 'supervisor'
          : selectedTask?.pieceId ?? station;
      const scope = convId === 'supervisor' ? 'supervisor' : selectedTask ? 'piece' : 'station';

      realtime.sendRealtimeChat({
        conversationId: convId,
        author,
        body,
        scope,
        scopeId,
        eventAttachment,
      });

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === convId
            ? {
                ...conv,
                messages: [
                  ...conv.messages,
                  {
                    id: `${Date.now()}`,
                    author,
                    body,
                    createdAt: new Date().toISOString(),
                    eventAttachment,
                  },
                ],
              }
            : conv,
        ),
      );
      if (selectedTask && eventAttachment) {
        void logTaskEvent(selectedTask.id, 'chat_event', { event: eventAttachment }, user?.id);
      }
    },
    [activeConversationId, selectedTask, user?.id, station, realtime],
  );

  const togglePieceOnCanvas = useCallback(
    (pieceId: string) => {
      const task = activeTasks.find((t) => t.pieceId === pieceId);
      if (!task) {
        setSelectedPieceId(pieceId);
        return;
      }
      toggleTaskSelection(task.id);
    },
    [activeTasks, toggleTaskSelection],
  );

  const title = workOrderId
    ? `Ordem · ${STATION_LABELS[station]}`
    : getStationPageTitle(station);

  return {
    config,
    title,
    workOrderId,
    description: loading
      ? 'A carregar fila de trabalho…'
      : `${activeTasks.length} tarefa(s) activa(s) · ${orders.length} ordem(ns) · ${realtime.stationOnline ? 'online' : 'offline'}`,
    loading,
    busy,
    error,
    codeInput,
    setCodeInput,
    codeInputRef,
    selectedTask,
    selectedTaskIds,
    selectedTasks,
    selectedPieceId,
    selectedPieceIds,
    setSelectedPieceId,
    actionFeedback,
    statusLabel: STATUS_LABEL,
    sidebarOpen,
    setSidebarOpen,
    toolMode,
    setToolMode,
    snapEnabled,
    setSnapEnabled,
    notificationsOpen,
    setNotificationsOpen,
    chatOpen,
    setChatOpen,
    notifications,
    dismissedNotifications,
    setDismissedNotifications,
    conversations: liveConversations,
    activeConversationId,
    setActiveConversationId,
    sections,
    canvasPieces,
    eventLog,
    tasks,
    orders,
    handleCodeSubmit,
    addCodeToSelection,
    handleConfirm,
    handleReject,
    handleStart,
    handleBulkAction,
    handleSendChatMessage,
    reload,
    selectTask,
    addTaskToSelection,
    toggleTaskSelection,
    removeFromSelection,
    clearSelection,
    selectAllTasks,
    togglePieceOnCanvas,
    stationOnline: realtime.stationOnline,
    realtimeConnected: realtime.connected,
    canvasRevision: realtime.canvasRevision,
    typingUsers: realtime.typingUsers,
  };
}
