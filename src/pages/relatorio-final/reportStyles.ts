import type { CSSProperties } from "react";
import type { ReportStyle } from "@/core/projectReport";

export const reportPageShell = (style: ReportStyle): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: style === "cards" ? 20 : 16,
  padding: "8px 0 32px",
  maxWidth: 1100,
  margin: "0 auto",
  width: "100%",
  color: "var(--text-main)",
  fontFamily: "var(--ui-font-family, system-ui, sans-serif)",
});

export const reportSection = (style: ReportStyle): CSSProperties =>
  style === "cards"
    ? {
        background: "var(--card-bg, var(--ui-color-surface))",
        border: "1px solid var(--card-border, var(--ui-color-surface-border))",
        borderRadius: 12,
        padding: 18,
        boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
      }
    : {
        background: "transparent",
        border: "1px solid var(--border, rgba(127,127,127,0.25))",
        borderRadius: 8,
        padding: 14,
      };

export const reportSectionTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text-main)",
};

export const reportGrid3: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

export const reportLabel: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
};

export const reportInput: CSSProperties = {
  width: "100%",
  minHeight: 38,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--input-border, var(--ui-color-input-border))",
  background: "var(--input-bg, var(--ui-color-input-bg))",
  color: "var(--text-main)",
  fontSize: 14,
  boxSizing: "border-box",
};

export const reportTextarea: CSSProperties = {
  ...reportInput,
  minHeight: 72,
  resize: "vertical" as const,
};

export const reportTableWrap: CSSProperties = {
  overflowX: "auto",
  width: "100%",
};

export const reportTable: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

export const reportTh: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border, rgba(127,127,127,0.3))",
  background: "rgba(127,127,127,0.08)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export const reportTd: CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid var(--border, rgba(127,127,127,0.15))",
  verticalAlign: "middle",
};

export const reportClickable: CSSProperties = {
  cursor: "pointer",
  color: "var(--blue-light, #3b82f6)",
  fontWeight: 700,
  textDecoration: "underline",
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
};

export const reportModalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  zIndex: 50000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  pointerEvents: "auto",
};

export const reportModalPanel: CSSProperties = {
  background: "var(--card-bg, #ffffff)",
  color: "var(--text-main, #111111)",
  borderRadius: 12,
  border: "1px solid var(--card-border, rgba(0,0,0,0.12))",
  maxWidth: 920,
  width: "100%",
  maxHeight: "85vh",
  overflow: "auto",
  padding: 18,
  boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
  position: "relative",
  zIndex: 50001,
  pointerEvents: "auto",
};

export const printHideClass = "report-no-print";
