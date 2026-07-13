// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { InvariantIssue, InvariantSeverity } from "../core/invariants/types";

const STORAGE_KEY = "pimo_invariant_notifications_v1";
const MAX_NOTIFICATIONS = 500;

export type InvariantNotification = {
  id: string;
  timestamp: number;
  ruleId: string;
  ruleName: string;
  severity: InvariantSeverity;
  message: string;
  context: InvariantIssue["context"];
  read: boolean;
};

type InvariantNotificationState = {
  notifications: InvariantNotification[];
  panelOpen: boolean;
  addIssue: (issue: InvariantIssue) => void;
  addIssues: (issues: InvariantIssue[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
  unreadCount: () => number;
};

function loadNotifications(): InvariantNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InvariantNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistNotifications(notifications: InvariantNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    /* quota */
  }
}

function makeId(): string {
  return `inv-notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function issueFingerprint(issue: InvariantIssue): string {
  return `${issue.ruleId}|${issue.message}|${issue.context.pieceId ?? ""}|${issue.context.boxId ?? ""}`;
}

export const invariantNotificationStore = createStore<InvariantNotificationState>((set, get) => ({
  notifications: loadNotifications(),
  panelOpen: false,

  addIssue: (issue) => {
    const fp = issueFingerprint(issue);
    const existing = get().notifications;
    const recentDup = existing.find(
      (n) =>
        issueFingerprint({
          ruleId: n.ruleId,
          message: n.message,
          context: n.context,
        } as InvariantIssue) === fp && Date.now() - n.timestamp < 60_000
    );
    if (recentDup) return;

    const notification: InvariantNotification = {
      id: makeId(),
      timestamp: Date.now(),
      ruleId: issue.ruleId,
      ruleName: issue.ruleName,
      severity: issue.severity,
      message: issue.message,
      context: issue.context,
      read: false,
    };

    const next = [notification, ...existing].slice(0, MAX_NOTIFICATIONS);
    persistNotifications(next);
    set({ notifications: next });
  },

  addIssues: (issues) => {
    for (const issue of issues) {
      get().addIssue(issue);
    }
  },

  markRead: (id) => {
    const next = get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    persistNotifications(next);
    set({ notifications: next });
  },

  markAllRead: () => {
    const next = get().notifications.map((n) => ({ ...n, read: true }));
    persistNotifications(next);
    set({ notifications: next });
  },

  clearAll: () => {
    persistNotifications([]);
    set({ notifications: [] });
  },

  removeNotification: (id) => {
    const next = get().notifications.filter((n) => n.id !== id);
    persistNotifications(next);
    set({ notifications: next });
  },

  setPanelOpen: (open) => set({ panelOpen: open }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));

export function useInvariantNotifications<T>(selector: (s: InvariantNotificationState) => T): T {
  return useStore(invariantNotificationStore, selector);
}
