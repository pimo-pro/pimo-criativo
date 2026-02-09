import { wallStore } from "../../stores/wallStore";

function NumberField({ label, value, onChange, min = 1 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <input
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          width: "100%",
          padding: "6px 8px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 6,
          color: "var(--text-main)",
          fontSize: 12,
        }}
      />
    </label>
  );
}

export default function WallDimensions({ wall }) {
  const handleChange = (patch) => wallStore.getState().updateWall(wall.id, patch);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Comprimento, altura, espessura (cm)</div>
      <NumberField
        label="Comprimento"
        value={wall.lengthCm}
        onChange={(value) => handleChange({ lengthCm: value })}
      />
      <NumberField
        label="Altura"
        value={wall.heightCm}
        onChange={(value) => handleChange({ heightCm: value })}
      />
      <NumberField
        label="Espessura"
        value={wall.thicknessCm}
        onChange={(value) => handleChange({ thicknessCm: value })}
      />
      <NumberField
        label="Ângulo (graus)"
        value={wall.rotation ?? 0}
        onChange={(value) => handleChange({ rotation: value })}
      />
    </div>
  );
}
