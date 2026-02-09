import { useMemo } from "react";
import { useWallStore, wallStore } from "../../stores/wallStore";

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

export default function RoomSetupPanel({ onClear }) {
  const walls = useWallStore((state) => state.walls);
  const isOpen = useWallStore((state) => state.isOpen);

  const dims = useMemo(() => {
    if (walls.length >= 3) {
      const w0 = walls[0]?.lengthCm ?? 300;
      const w2 = walls[2]?.lengthCm ?? w0;
      const w1 = walls[1]?.lengthCm ?? w0;
      const w3 = walls[3]?.lengthCm ?? w1;
      const width = Math.round((w0 + w2) / 2);
      const depth = Math.round((w1 + w3) / 2);
      const height = Math.max(...walls.map((w) => w.heightCm ?? 0), 280);
      return { width, depth, height };
    }
    return { width: 300, depth: 300, height: 280 };
  }, [walls]);

  const ensureRoom = () => {
    if (!isOpen) wallStore.getState().setOpen(true);
    if (walls.length === 0) wallStore.getState().resetRoom();
  };

  const updateWidth = (value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    ensureRoom();
    const current = wallStore.getState().walls;
    const w0 = current[0];
    const w2 = current[2];
    if (w0) wallStore.getState().updateWall(w0.id, { lengthCm: value });
    if (w2) wallStore.getState().updateWall(w2.id, { lengthCm: value });
  };

  const updateDepth = (value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    ensureRoom();
    const current = wallStore.getState().walls;
    const w1 = current[1];
    const w3 = current[3];
    if (w1) wallStore.getState().updateWall(w1.id, { lengthCm: value });
    if (w3) wallStore.getState().updateWall(w3.id, { lengthCm: value });
  };

  const updateHeight = (value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    ensureRoom();
    wallStore.getState().walls.forEach((wall) => {
      wallStore.getState().updateWall(wall.id, { heightCm: value });
    });
  };

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Dimensões da Sala</div>
          <div style={{ display: "grid", gap: 8 }}>
            <NumberField label="Largura (cm)" value={dims.width} onChange={updateWidth} />
            <NumberField label="Profundidade (cm)" value={dims.depth} onChange={updateDepth} />
            <NumberField label="Altura (cm)" value={dims.height} onChange={updateHeight} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => {
                wallStore.getState().clearRoom();
                onClear?.();
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 500,
                color: "#fff",
                background: "var(--red-500, #ef4444)",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--red-600, #dc2626)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--red-500, #ef4444)";
              }}
            >
              Limpar Sala
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
