/**
 * Popover unificado para steppers, contadores e ações rápidas.
 * Usado em Prateleiras, Porta, Gaveta e outros controles.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type UnifiedPopoverProps = {
  /** Conteúdo do trigger (ex: botão ou label) */
  trigger: React.ReactNode;
  /** Conteúdo do popover */
  children: React.ReactNode;
  /** Alinhamento: "start" | "center" | "end" */
  align?: "start" | "center" | "end";
  /** ID para acessibilidade */
  id?: string;
  /** Classe CSS do container do trigger */
  className?: string;
};

export default function UnifiedPopover({
  trigger,
  children,
  align = "start",
  id,
  className,
}: UnifiedPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }} className={className}>
      <button
        type="button"
        id={id}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: "var(--text-main)",
          padding: "6px 10px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          aria-labelledby={id}
          style={{
            position: "absolute",
            top: "100%",
            left: align === "start" ? 0 : align === "end" ? "auto" : "50%",
            right: align === "end" ? 0 : undefined,
            transform: align === "center" ? "translateX(-50%)" : undefined,
            marginTop: 4,
            padding: 12,
            background: "var(--navy, #0f172a)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 1000,
            minWidth: 160,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Stepper para quantidade (prateleiras, gavetas, etc.) */
export function StepperPopover({
  label,
  value,
  min = 0,
  max = 99,
  onChange,
  id,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  id?: string;
}) {
  const v = Math.max(min, Math.min(max, Math.floor(value)));
  return (
    <UnifiedPopover
      id={id}
      trigger={
        <span>
          {label}: <strong>{v}</strong>
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onChange(Math.max(min, v - 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            −
          </button>
          <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{v}</span>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, v + 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      </div>
    </UnifiedPopover>
  );
}
