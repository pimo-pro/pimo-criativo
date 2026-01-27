// src/components/ui/Panel.tsx

import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export default function Panel({ title, description, children }: PanelProps) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "var(--radius)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
        backdropFilter: "blur(6px)",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-main)",
          }}
        >
          {title}
        </div>
      )}

      {description && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          {description}
        </div>
      )}

      {children}
    </div>
  );
}