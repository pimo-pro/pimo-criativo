import { wallStore } from "../../stores/wallStore";

export default function WallColor({ wall }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cor</span>
      <input
        type="color"
        value={wall.color}
        onChange={(event) => wallStore.getState().updateWall(wall.id, { color: event.target.value })}
        style={{
          width: "100%",
          height: 32,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 6,
          background: "transparent",
          padding: 0,
          cursor: "pointer",
        }}
      />
    </label>
  );
}
