import { useCallback, useEffect, useRef, useState } from 'react';

import type { SupervisorAlertItem } from '@/industrial/persistence/supervisor/types';
import type { IndustrialStation } from '@/industrial/work-orders/types';
import type { StationChatConversation, StationNotification } from '@/industrial/ui/components/stationTypes';

import { alertsEngine } from '../AlertsEngine';
import { chatRealtimeAdapter } from '../ChatRealtimeAdapter';
import { isRtoEngineEnabled } from '../config';
import { loadRealtimeAlertsConfig } from '../realtimeAlertsConfigStore';
import { industrialRealtimeGateway } from '../IndustrialRealtimeGateway';
import { stationHeartbeatMonitor } from '../StationHeartbeatMonitor';
import { threeSyncAdapter } from '../ThreeSyncAdapter';
import type { RtoAlertPayload, RtoChatPayload, RtoThreeSyncPayload } from '../types';

export interface UseIndustrialRealtimeOptions {
  mode: 'supervisor' | 'station' | 'operator';
  station?: IndustrialStation;
  onDataRefresh?: () => void;
}

function alertToNotification(alert: RtoAlertPayload): StationNotification {
  const type =
    alert.alertCode?.includes('quality') || alert.alertCode?.includes('rejection')
      ? 'quality'
      : alert.alertCode?.includes('delay') || alert.alertCode?.includes('idle')
        ? 'time'
        : alert.alertCode?.includes('station')
          ? 'supervisor'
          : 'task';

  return {
    id: alert.id,
    type,
    title: alert.title,
    message: alert.message,
    createdAt: alert.createdAt,
  };
}

function alertToSupervisor(alert: RtoAlertPayload): SupervisorAlertItem {
  return {
    id: alert.id,
    level: alert.level,
    title: alert.title,
    message: alert.message,
    createdAt: alert.createdAt,
    station: alert.station,
    projectId: alert.projectId,
    pieceId: alert.pieceId,
  };
}

/**
 * Hook unificado RTO-Engine — liga gateway, heartbeat, alertas, chat e 3D sync.
 */
export function useIndustrialRealtime(options: UseIndustrialRealtimeOptions) {
  const { mode, station, onDataRefresh } = options;
  const onDataRefreshRef = useRef(onDataRefresh);

  useEffect(() => {
    onDataRefreshRef.current = onDataRefresh;
  }, [onDataRefresh]);

  const [connected, setConnected] = useState(false);
  const [realtimeAlerts, setRealtimeAlerts] = useState<SupervisorAlertItem[]>([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState<StationNotification[]>([]);
  const [stationOnline, setStationOnline] = useState(true);
  const [stationStatuses, setStationStatuses] = useState<Record<IndustrialStation, boolean> | null>(null);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [lastThreeSync, setLastThreeSync] = useState<RtoThreeSyncPayload | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [incomingChat, setIncomingChat] = useState<RtoChatPayload[]>([]);

  const handleAlert = useCallback(
    (alert: RtoAlertPayload) => {
      if (mode === 'supervisor') {
        setRealtimeAlerts((prev) => [alertToSupervisor(alert), ...prev.filter((a) => a.id !== alert.id)].slice(0, 50));
      }
      if (mode === 'station') {
        setRealtimeNotifications((prev) =>
          [alertToNotification(alert), ...prev.filter((n) => n.id !== alert.id)].slice(0, 30),
        );
      }
      if (mode === 'operator') {
        setRealtimeNotifications((prev) =>
          [alertToNotification(alert), ...prev.filter((n) => n.id !== alert.id)].slice(0, 20),
        );
      }
    },
    [mode],
  );

  const handleChat = useCallback(
    (message: RtoChatPayload) => {
      if (message.typing) {
        setTypingUsers((prev) => [...new Set([...prev, message.author])].slice(0, 5));
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== message.author));
        }, 3_000);
        return;
      }
      setIncomingChat((prev) => [...prev, message].slice(-100));
      onDataRefreshRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (!isRtoEngineEnabled()) return;

    let cancelled = false;
    let stopAlerts: (() => void) | undefined;
    let stopThree: (() => void) | undefined;
    let stopHeartbeat: (() => void) | undefined;
    let stopMonitor: (() => void) | undefined;
    const unsubs: Array<() => void> = [];

    void (async () => {
      await loadRealtimeAlertsConfig();
      if (cancelled) return;

      industrialRealtimeGateway.connect();
      setConnected(industrialRealtimeGateway.isConnected);

      stopAlerts = alertsEngine.start();
      stopThree = threeSyncAdapter.start();

      unsubs.push(
        industrialRealtimeGateway.on<RtoAlertPayload>('alert.critical', handleAlert),
        industrialRealtimeGateway.on<RtoChatPayload>('chat.message', handleChat),
        industrialRealtimeGateway.on<RtoThreeSyncPayload>('three.sync', (sync) => {
          setCanvasRevision(threeSyncAdapter.getRevision());
          setLastThreeSync(sync);
          onDataRefreshRef.current?.();
        }),
        industrialRealtimeGateway.on('task.updated', () => onDataRefreshRef.current?.()),
        industrialRealtimeGateway.on('piece.updated', () => onDataRefreshRef.current?.()),
      );

      if (mode === 'station' && station) {
        stopHeartbeat = stationHeartbeatMonitor.startSending(station);
        unsubs.push(
          industrialRealtimeGateway.on<{ station: IndustrialStation; online: boolean }>(
            'heartbeat.status',
            (payload) => {
              if (payload.station === station) setStationOnline(payload.online);
            },
          ),
        );
      }

      if (mode === 'supervisor') {
        stopMonitor = stationHeartbeatMonitor.startMonitoring();
        const statusInterval = setInterval(() => {
          setStationStatuses(stationHeartbeatMonitor.getAllStatuses());
        }, 2_000);
        unsubs.push(() => clearInterval(statusInterval));
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      stopAlerts?.();
      stopThree?.();
      stopHeartbeat?.();
      stopMonitor?.();
      industrialRealtimeGateway.disconnect();
      setConnected(false);
    };
  }, [mode, station, handleAlert, handleChat]);

  const sendChatMessage = useCallback(
    (options: {
      conversationId: string;
      author: string;
      body: string;
      scope: RtoChatPayload['scope'];
      scopeId: string;
      eventAttachment?: string;
    }) => chatRealtimeAdapter.sendMessage(options),
    [],
  );

  const sendTyping = useCallback(
    (conversationId: string, author: string, scope: RtoChatPayload['scope'], scopeId: string) => {
      chatRealtimeAdapter.sendTyping(conversationId, author, scope, scopeId);
    },
    [],
  );

  const mergeChatConversations = useCallback(
    (base: StationChatConversation[]): StationChatConversation[] => {
      if (incomingChat.length === 0) return base;
      const next = base.map((c) => ({ ...c, messages: [...c.messages] }));

      for (const msg of incomingChat) {
        const conv = next.find((c) => c.id === msg.conversationId);
        if (conv && !conv.messages.some((m) => m.id === msg.id)) {
          conv.messages.push({
            id: msg.id,
            author: msg.author,
            body: msg.body,
            createdAt: msg.createdAt,
            eventAttachment: msg.eventAttachment,
          });
        }
      }
      return next;
    },
    [incomingChat],
  );

  return {
    connected,
    realtimeAlerts,
    realtimeNotifications,
    stationOnline,
    stationStatuses,
    canvasRevision,
    lastThreeSync,
    typingUsers,
    sendChatMessage,
    sendRealtimeChat: sendChatMessage,
    sendTyping,
    mergeChatConversations,
    clearRealtimeAlerts: () => setRealtimeAlerts([]),
  };
}
