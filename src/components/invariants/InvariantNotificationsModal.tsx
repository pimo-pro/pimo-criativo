// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { useState } from "react";
import { ModalPortal } from "../ui/ModalPortal";
import { Icon } from "@/components/icons";
import {
  useInvariantNotifications,
  type InvariantNotification,
} from "../../stores/invariantNotificationStore";

const severityColor: Record<InvariantNotification["severity"], string> = {
  info: "#60a5fa",
  warning: "#fbbf24",
  error: "#f87171",
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function InvariantNotificationsModal({ isOpen, onClose }: Props) {
  const notifications = useInvariantNotifications((s) => s.notifications);
  const markRead = useInvariantNotifications((s) => s.markRead);
  const markAllRead = useInvariantNotifications((s) => s.markAllRead);
  const clearAll = useInvariantNotifications((s) => s.clearAll);
  const removeNotification = useInvariantNotifications((s) => s.removeNotification);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!isOpen) return null;

  const visible =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <ModalPortal>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 10000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "52px 16px 16px",
        }}
      >
        <div
          role="dialog"
          aria-label="Notificações de invariantes"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "min(420px, 100%)",
            maxHeight: "min(70vh, 560px)",
            display: "flex",
            flexDirection: "column",
            background: "var(--popover-bg, #1e293b)",
            border: "1px solid var(--popover-border, rgba(255,255,255,0.12))",
            borderRadius: 10,
            boxShadow: "var(--popover-shadow, 0 12px 40px rgba(0,0,0,0.35))",
            overflow: "hidden",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Notificações</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Invariantes industriais — persistentes
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  lineHeight: 1.35,
                  color: "var(--text-muted)",
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                }}
              >
                Notificações industriais — módulo em desenvolvimento · @pimo-soon
              </div>
            </div>
            <button type="button" className="button button-ghost button-sm" onClick={onClose} aria-label="Fechar">
              <Icon name="close" size={18} />
            </button>
          </header>

          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className={`button button-sm${filter === "all" ? " button-primary" : ""}`}
              onClick={() => setFilter("all")}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              className={`button button-sm${filter === "unread" ? " button-primary" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Não lidas
            </button>
            <button type="button" className="button button-sm" onClick={markAllRead}>
              Marcar lidas
            </button>
            <button type="button" className="button button-sm" onClick={clearAll}>
              Limpar
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {visible.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                Sem notificações.
              </div>
            ) : (
              visible.map((n) => (
                <article
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    padding: "10px 12px",
                    marginBottom: 6,
                    borderRadius: 8,
                    background: n.read ? "rgba(255,255,255,0.03)" : "rgba(77,163,255,0.08)",
                    border: `1px solid ${n.read ? "rgba(255,255,255,0.06)" : "rgba(77,163,255,0.2)"}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: severityColor[n.severity] }}>
                      {n.ruleName}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                      {formatTimestamp(n.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.4 }}>{n.message}</p>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {n.context.piece ? <span>Peça: {n.context.piece}</span> : null}
                    {n.context.box || n.context.boxId ? (
                      <span>Caixa: {n.context.box ?? n.context.boxId}</span>
                    ) : null}
                    {n.context.operation ? <span>Op: {n.context.operation}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="button button-ghost button-sm"
                    style={{ marginTop: 6, fontSize: 10, padding: "2px 6px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(n.id);
                    }}
                  >
                    Remover
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
