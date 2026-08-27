/**
 * Contexto para notificações toast (alertas automáticos).
 */

/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { drainProductionReleaseOutbox } from "../core/industrial/productionReleasePersist";

export type ToastMessage = {
  id: string;
  text: string;
  type?: "error" | "warning" | "info" | "success";
  duration?: number;
};

export type LoadingMessage = {
  id: string;
  label: string;
};

type ToastContextValue = {
  toasts: ToastMessage[];
  loading: LoadingMessage[];
  isLoading: boolean;
  showToast: (_text: string, _type?: ToastMessage["type"], _duration?: number) => void;
  startLoading: (_label?: string) => string;
  stopLoading: (_id: string) => void;
  clearLoading: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;
let loadingIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState<LoadingMessage[]>([]);

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

  useEffect(() => {
    drainProductionReleaseOutbox(showToast);
  }, [showToast]);

  const startLoading = useCallback((label = "A processar...") => {
    const id = `loading-${++loadingIdCounter}`;
    setLoading((prev) => [...prev, { id, label }]);
    return id;
  }, []);

  const stopLoading = useCallback((id: string) => {
    setLoading((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearLoading = useCallback(() => {
    setLoading([]);
  }, []);

  const isLoading = loading.length > 0;

  return (
    <ToastContext.Provider value={{ toasts, loading, isLoading, showToast, startLoading, stopLoading, clearLoading }}>
      {children}
      {isLoading && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.25)",
            zIndex: 9998,
            pointerEvents: "none",
          }}
        />
      )}
      {isLoading && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 10001,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {loading.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.92)",
                color: "#fff",
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(0,0,0,0.22)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#ffffff",
                  animation: "spin 0.9s linear infinite",
                  display: "inline-block",
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
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
              background:
                t.type === "error"
                  ? "rgba(239,68,68,0.95)"
                  : t.type === "warning"
                    ? "rgba(245,158,11,0.95)"
                    : t.type === "success"
                      ? "rgba(22,163,74,0.95)"
                      : "rgba(30,41,59,0.95)",
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
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return {
    toasts: [],
    loading: [],
    isLoading: false,
    showToast: () => {},
    startLoading: () => "",
    stopLoading: () => {},
    clearLoading: () => {},
  };
  return ctx;
}
