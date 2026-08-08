import { buildCircleChartMetrics, type ProjectReportMetricas } from "@/core/projectReport";

type Props = {
  metricas: ProjectReportMetricas;
  size?: number;
};

/** Grafico circular (donut) SVG — cores alinhadas a chartMetrics. */
export default function ProgressCircle({ metricas, size = 200 }: Props) {
  const items = buildCircleChartMetrics(metricas);
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments =
    total <= 0
      ? []
      : items
          .filter((i) => i.value > 0)
          .map((item) => {
            const len = (item.value / total) * circumference;
            const seg = {
              ...item,
              dash: len,
              gap: circumference - len,
              offset,
            };
            offset += len;
            return seg;
          });

  return (
    <div style={{ display: "grid", gap: 12, justifyContent: "start" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Painel grafico">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border, rgba(127,127,127,0.25))"
            strokeWidth={stroke}
          />
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </circle>
          ))}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            style={{ fontSize: 22, fontWeight: 700, fill: "var(--text-main)" }}
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            style={{ fontSize: 11, fill: "var(--text-muted)" }}
          >
            total
          </text>
        </svg>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 6,
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        {items.map((item) => (
          <div key={`leg-${item.key}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: item.color,
                flexShrink: 0,
              }}
            />
            <span>
              {item.label}: <strong style={{ color: "var(--text-main)" }}>{item.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
