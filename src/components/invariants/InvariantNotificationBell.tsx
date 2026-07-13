// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { useState } from "react";
import { Icon } from "@/components/icons";
import { useInvariantNotifications } from "../../stores/invariantNotificationStore";
import InvariantNotificationsModal from "./InvariantNotificationsModal";

const bellButtonStyle = {
  position: "relative" as const,
  display: "inline-flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  width: 32,
  height: 29,
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--button-ghost-bg)",
  color: "var(--text-main)",
  cursor: "pointer" as const,
};

export default function InvariantNotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useInvariantNotifications((s) => s.unreadCount());
  const setPanelOpen = useInvariantNotifications((s) => s.setPanelOpen);
  const markAllRead = useInvariantNotifications((s) => s.markAllRead);

  const handleOpen = () => {
    setOpen(true);
    setPanelOpen(true);
    markAllRead();
  };

  return (
    <>
      <button
        type="button"
        title="Notificações de invariantes"
        aria-label={`Notificações${unread > 0 ? `, ${unread} não lidas` : ""}`}
        onClick={handleOpen}
        style={bellButtonStyle}
      >
        <Icon name="bell" size={18} aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#ef4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              boxShadow: "0 0 0 2px var(--black, #0f172a)",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      <InvariantNotificationsModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setPanelOpen(false);
        }}
      />
    </>
  );
}
