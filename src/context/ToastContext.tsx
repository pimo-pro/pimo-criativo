/**
 * Contexto para notificações toast (alertas automáticos).
 */

import { createContext, useCallback, useContext, useState } from "react";

export type ToastMessage = {
  id: string;
  text: string;
  type?: "error" | "warning" | "info";
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastMessage[];
  showToast: (text: string, type?: ToastMessage["type"], duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (text: string, type: ToastMessage["type"] = "info", duration = 4000) => {
      const id = `toast-${++toastIdCounter}`;
      const toast: ToastMessage = { id, text, type, duration };
      setToasts((prev) => [...prev, toast]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: t.type === "error" ? "rgba(239,68,68,0.95)" : t.type === "warning" ? "rgba(245,158,11,0.95)" : "rgba(30,41,59,0.95)",
              color: "#fff",
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              maxWidth: 320,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toasts: [], showToast: () => {} };
  return ctx;
}
