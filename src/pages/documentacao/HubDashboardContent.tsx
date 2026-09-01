/**
 * Secção Dashboard Avançado — KPIs + gráficos SVG (sem libs).
 */

import { useMemo } from "react";
import {
  loadHubDashboard,
  type DashboardBar,
  type DashboardGraph,
  type DashboardHealthItem,
  type DashboardKpi,
  type DashboardSlice,
  type DashboardTone,
} from "@/core/docs/dashboard";
import { AJUDA_PAGE_TOKENS as C } from "../ajuda/ajudaPageTokens";
import {
  applyHubProjectCount,
  useHubProjectCount,
} from "./useHubProjectCount";

const TONE: Record<DashboardTone, string> = {
  neutral: C.muted,
  blue: C.accent,
  green: "var(--status-done-color, var(--ci-success, #22c55e))",
  amber: "var(--status-progress-color, var(--ci-sienna-400, #f59e0b))",
};

const HEALTH_COLOR = {
  ok: "var(--status-done-color, var(--ci-success, #22c55e))",
  warn: "var(--status-progress-color, var(--ci-sienna-400, #f59e0b))",
  fail: "var(--ci-sienna-500, #ef4444)",
} as const;

export default function HubDashboardContent() {
  const data = useMemo(() => loadHubDashboard(), []);
  const totalProjects = useHubProjectCount();
  const kpis = useMemo(
    () => applyHubProjectCount(data.kpis, totalProjects),
    [data.kpis, totalProjects]
  );

  return (
    <div data-hub-dashboard style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Dashboard avançado — snapshot {data.generatedAtLabel}. Contadores:{" "}
        {data.counters.completed} concluídos · {data.counters.inProgress} andamento ·{" "}
        {data.counters.planned} planeados ({data.counters.completionPercent}%).
      </p>

      <div
        className="hub-dash-kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
          width: "100%",
        }}
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <div
        className="hub-dash-graph-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 12,
          width: "100%",
        }}
      >
        {data.graphs.map((g) => (
          <GraphCard key={g.id} graph={g} />
        ))}
      </div>

      <section
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.bg,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>
            Saúde do Hub
          </h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: HEALTH_COLOR[data.health.overall] }}>
            {data.health.overall.toUpperCase()}
          </span>
        </div>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {data.health.items.map((item) => (
            <HealthRow key={item.id} item={item} />
          ))}
        </ul>
      </section>

      <style>{`
        @media (max-width: 820px) {
          .hub-dash-kpi-grid,
          .hub-dash-graph-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function HealthRow({ item }: { item: DashboardHealthItem }) {
  return (
    <li style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, color: HEALTH_COLOR[item.status] }}>[{item.status}]</span>{" "}
      {item.label}
      <div style={{ color: C.muted }}>{item.detail}</div>
    </li>
  );
}

function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  const color = TONE[kpi.tone];
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.surface,
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: "0 0 auto",
          width: 4,
          alignSelf: "stretch",
          borderRadius: 999,
          background: color,
          minHeight: 36,
        }}
      />
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "4px 10px",
          }}
        >
          <span
            style={{
              fontSize: "clamp(1.15rem, 2.2vw, 1.4rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: C.text,
              lineHeight: 1.1,
            }}
          >
            {kpi.value}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
            {kpi.label}
          </span>
          {kpi.deltaLabel ? (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 700,
                color: TONE.green,
                whiteSpace: "nowrap",
              }}
            >
              {kpi.deltaLabel}
            </span>
          ) : null}
        </div>
        {kpi.hint ? (
          <div
            style={{
              marginTop: 3,
              fontSize: 11,
              color: C.muted,
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {kpi.hint}
          </div>
        ) : null}
      </div>
      <div style={{ flex: "0 0 auto", width: 72, opacity: 0.9 }}>
        <Sparkline values={kpi.sparkline} color={color} compact />
      </div>
    </article>
  );
}

function GraphCard({ graph }: { graph: DashboardGraph }) {
  return (
    <article
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.bg,
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: C.text }}>{graph.title}</h3>
      {graph.kind === "donut" ? (
        <DonutChart slices={graph.slices} />
      ) : graph.kind === "bars" ? (
        <BarChart bars={graph.bars} max={graph.max} />
      ) : (
        <LineChart series={graph.series} />
      )}
    </article>
  );
}

function Sparkline({
  values,
  color,
  compact = false,
}: {
  values: number[];
  color: string;
  compact?: boolean;
}) {
  const w = compact ? 72 : 120;
  const h = compact ? 24 : 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return x + "," + y;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.75" points={pts} />
    </svg>
  );
}

function LineChart({
  series,
}: {
  series: Extract<DashboardGraph, { kind: "timeline" | "line" }>["series"];
}) {
  const w = 320;
  const h = 140;
  const pad = 18;
  const all = series.flatMap((s) => s.points);
  const maxY = Math.max(...all.map((p) => p.y), 1);
  const maxX = Math.max(...all.map((p) => p.x), 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={160} role="img">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={C.border} />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={C.border} />
      {series.map((s) => {
        const pts = s.points
          .map((p) => {
            const x = pad + (p.x / maxX) * (w - pad * 2);
            const y = h - pad - (p.y / maxY) * (h - pad * 2);
            return x + "," + y;
          })
          .join(" ");
        return (
          <g key={s.id}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" points={pts} />
            {s.points.map((p, i) => {
              const x = pad + (p.x / maxX) * (w - pad * 2);
              const y = h - pad - (p.y / maxY) * (h - pad * 2);
              return (
                <g key={s.id + "-" + i}>
                  <circle cx={x} cy={y} r={3.5} fill={s.color} />
                  {p.label ? (
                    <text x={x} y={y - 8} textAnchor="middle" fontSize="9" fill={C.muted}>
                      {p.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function BarChart({ bars, max }: { bars: DashboardBar[]; max?: number }) {
  const w = 320;
  const h = 160;
  const pad = 16;
  const peak = max ?? Math.max(...bars.map((b) => b.value), 1);
  const gap = 6;
  const barW = Math.max(8, (w - pad * 2 - gap * Math.max(0, bars.length - 1)) / Math.max(1, bars.length));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={180} role="img">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={C.border} />
      {bars.map((b, i) => {
        const x = pad + i * (barW + gap);
        const bh = ((b.value / peak) * (h - pad * 2)) || 0;
        const y = h - pad - bh;
        return (
          <g key={b.id}>
            <rect x={x} y={y} width={barW} height={bh} rx={3} fill={b.color} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={h - 4}
              textAnchor="middle"
              fontSize="8"
              fill={C.muted}
            >
              {b.label.slice(0, 6)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ slices }: { slices: DashboardSlice[] }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 54;
  const stroke = 18;
  const total = slices.reduce((a, b) => a + b.value, 0) || 1;
  const circ = 2 * Math.PI * r;
  const arcs = slices.map((s, index) => {
    const len = (s.value / total) * circ;
    const strokeDashoffset = -slices
      .slice(0, index)
      .reduce((sum, prev) => sum + (prev.value / total) * circ, 0);
    return { ...s, len, strokeDashoffset };
  });
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={160} height={160} role="img">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        {arcs.map(({ id, color, len, strokeDashoffset }) => (
          <circle
            key={id}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={C.text}>
          {total}
        </text>
      </svg>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {slices.map((s) => (
          <li key={s.id} style={{ fontSize: 11, color: C.muted, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
            {s.label}: {s.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
