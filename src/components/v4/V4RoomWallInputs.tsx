import type { V4RoomShape } from "../../v4/state/V4RoomShapes";

// Colour dot per wall label
const WALL_COLORS: Record<string, string> = {
  A: "#3b82f6", // azul
  B: "#ef4444", // vermelho
  C: "#eab308", // amarelo
  D: "#a855f7", // roxo
  E: "#22c55e", // verde
  F: "#f97316", // laranja
};

interface V4RoomWallInputsProps {
  shape: V4RoomShape;
  wallValues: Record<string, number>;
  height: number;
  onChange: (wallId: string, value: number) => void;
  onHeightChange: (value: number) => void;
}

function WallRow({
  wallId,
  label,
  value,
  onChange,
}: {
  wallId: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const dot = WALL_COLORS[wallId] ?? "#8b949e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: dot, flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, color: "var(--v4-text-muted)", flex: 1, minWidth: 0 }}>{label}</span>
      <input
        type="number"
        min={10}
        max={5000}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 60, textAlign: "right", fontSize: 12,
          background: "var(--v4-surface-2, #161b22)",
          border: "1px solid var(--v4-border, #30363d)",
          borderRadius: 4, padding: "2px 4px",
          color: "var(--v4-text, #e6edf3)",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--v4-text-subtle, #8b949e)", width: 14 }}>cm</span>
    </div>
  );
}

export function V4RoomWallInputs({
  shape,
  wallValues,
  height,
  onChange,
  onHeightChange,
}: V4RoomWallInputsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {shape.walls.map((wall) => (
        <WallRow
          key={wall.id}
          wallId={wall.id}
          label={wall.label}
          value={wallValues[wall.id] ?? wall.defaultLength}
          onChange={(v) => onChange(wall.id, v)}
        />
      ))}

      {/* Divider */}
      <div style={{ height: 1, background: "var(--v4-border, #30363d)", margin: "2px 0" }} />

      {/* Height row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--v4-text-subtle, #8b949e)", flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, color: "var(--v4-text-muted)", flex: 1 }}>Altura</span>
        <input
          type="number"
          min={50}
          max={1000}
          step={0.1}
          value={height}
          onChange={(e) => onHeightChange(Number(e.target.value))}
          style={{
            width: 60, textAlign: "right", fontSize: 12,
            background: "var(--v4-surface-2, #161b22)",
            border: "1px solid var(--v4-border, #30363d)",
            borderRadius: 4, padding: "2px 4px",
            color: "var(--v4-text, #e6edf3)",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--v4-text-subtle, #8b949e)", width: 14 }}>cm</span>
      </div>
    </div>
  );
}
