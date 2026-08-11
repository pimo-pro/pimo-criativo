/**
 * Painel gráfico — contagens úteis (P3.18). Sem tempo/horas.
 */

import type { CSSProperties, ReactNode } from "react";
import {
  buildRelatorioPainelContagens,
  type ProjectReport,
  type ProjectReportMetricas,
  type ReportStyle,
} from "@/core/projectReport";
import { reportSection, reportSectionTitle } from "../reportStyles";
import { R } from "../uiLabels";
import ProgressCircle from "./ProgressCircle";

type Props = {
  style: ReportStyle;
  metricas: ProjectReportMetricas;
  report: ProjectReport;
};

type DashCard = {
  key: string;
  label: string;
  value: string | number;
  color: string;
  icon: ReactNode;
};

const iconWrap = (color: string): CSSProperties => ({
  width: 36,
  height: 36,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: `${color}18`,
  color,
  flexShrink: 0,
});

function IconBox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 12v8M4 8.5l8 3.5 8-3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconPieces() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconModule() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 9h14M5 15h14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconDoor() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M4 20h16M15 12h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconDrawer() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="12" width="16" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 7.5h4M10 14.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value, color, icon }: Omit<DashCard, "key">) {
  return (
    <div
      style={{
        border: "1px solid var(--border, rgba(127,127,127,0.22))",
        borderRadius: 12,
        padding: "14px 14px 12px",
        background: "var(--card-bg, var(--ui-color-surface, transparent))",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 108,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={iconWrap(color)}>{icon}</div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

export default function PainelGraficoBlock({ style, metricas, report }: Props) {
  const contagens = buildRelatorioPainelContagens(report);

  const cards: DashCard[] = [
    {
      key: "caixas",
      label: R.caixas,
      value: contagens.caixas,
      color: "#7c3aed",
      icon: <IconBox />,
    },
    {
      key: "pecas",
      label: R.pecas,
      value: contagens.pecas,
      color: "#2563eb",
      icon: <IconPieces />,
    },
    {
      key: "modulos",
      label: R.modulos,
      value: contagens.modulos,
      color: "#0891b2",
      icon: <IconModule />,
    },
    {
      key: "portas",
      label: R.portasCount,
      value: contagens.portas,
      color: "#16a34a",
      icon: <IconDoor />,
    },
    {
      key: "gavetas",
      label: R.gavetasCount,
      value: contagens.gavetas,
      color: "#ea580c",
      icon: <IconDrawer />,
    },
  ];

  return (
    <section style={reportSection(style)} data-testid="painel-grafico">
      <h2 style={reportSectionTitle}>{R.painelGrafico}</h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "0 0 220px" }}>
          <ProgressCircle metricas={metricas} showLegend={false} />
        </div>
        <div
          style={{
            flex: "1 1 320px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
          data-testid="painel-contagens"
        >
          {cards.map((c) => (
            <StatCard
              key={c.key}
              label={c.label}
              value={c.value}
              color={c.color}
              icon={c.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
