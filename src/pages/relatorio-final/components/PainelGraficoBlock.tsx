import type { CSSProperties, ReactNode } from "react";
import {
  deriveTempoTrabalhoHoras,
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
  suffix?: string;
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

function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 12.5 11 15l4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4 3.5 19h17L12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconFix() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.7 6.3a4 4 0 0 0-5.6 5.6L4 17l3 3 5.1-5.1a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.5-2.5 2.5-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19c.8-3 2.8-4.5 5.5-4.5S13.7 16 14.5 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 14.5c2 .3 3.5 1.6 4 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v5l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({ label, value, suffix, color, icon }: Omit<DashCard, "key">) {
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
        {suffix ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              marginLeft: 4,
              color: "var(--text-muted)",
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function PainelGraficoBlock({ style, metricas, report }: Props) {
  const tempo = deriveTempoTrabalhoHoras(report);

  const cards: DashCard[] = [
    {
      key: "ordens",
      label: R.ordensTrabalho,
      value: metricas.ordensTrabalho,
      color: "#7c3aed",
      icon: <IconClipboard />,
    },
    {
      key: "tarefas",
      label: R.tarefasConcluidas,
      value: metricas.tarefasConcluidas,
      color: "#16a34a",
      icon: <IconCheck />,
    },
    {
      key: "erros",
      label: R.erros,
      value: metricas.erros,
      color: "#dc2626",
      icon: <IconAlert />,
    },
    {
      key: "corrigidos",
      label: R.errosCorrigidos,
      value: metricas.errosCorrigidos,
      color: "#ea580c",
      icon: <IconFix />,
    },
    {
      key: "melhorias",
      label: R.melhoriasAplicadas,
      value: metricas.melhorias,
      color: "#2563eb",
      icon: <IconSpark />,
    },
    {
      key: "colabs",
      label: R.colaboradores,
      value: metricas.colaboradores,
      color: "#0891b2",
      icon: <IconUsers />,
    },
    {
      key: "tempo",
      label: R.tempoTrabalho,
      value: tempo,
      suffix: "h",
      color: "#64748b",
      icon: <IconClock />,
    },
  ];

  return (
    <section style={reportSection(style)}>
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
        >
          {cards.map((c) => (
            <StatCard
              key={c.key}
              label={c.label}
              value={c.value}
              suffix={c.suffix}
              color={c.color}
              icon={c.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
