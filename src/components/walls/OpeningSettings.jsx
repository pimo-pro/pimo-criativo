import { wallStore } from "../../stores/wallStore";
import { clampOpeningNoOverlap } from "../../utils/openingConstraints";

function NumberField({ label, value, onChange, min = 0 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <input
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
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

export default function OpeningSettings({ opening, wallId }) {
  if (!opening || !wallId) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Nenhuma abertura selecionada.
      </div>
    );
  }

  const updateOpening = (patch) => {
    const state = wallStore.getState();
    const wall = state.walls.find((w) => w.id === wallId);
    if (!wall) return;
    const wallLengthMm = wall.lengthCm * 10;
    const wallHeightMm = wall.heightCm * 10;
    const merged = { ...opening, ...patch };
    const { horizontalOffsetMm, floorOffsetMm } = clampOpeningNoOverlap(
      merged,
      opening.id,
      wall.openings ?? [],
      wallLengthMm,
      wallHeightMm
    );
    const openings = (wall.openings ?? []).map((o) =>
      o.id === opening.id
        ? { ...o, ...patch, horizontalOffsetMm, floorOffsetMm }
        : o
    );
    state.updateWall(wallId, { openings });
  };

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">
            {opening.type === "door" ? "Porta" : "Janela"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <NumberField
              label="Largura (mm)"
              value={opening.widthMm}
              onChange={(v) => updateOpening({ widthMm: v })}
              min={100}
            />
            <NumberField
              label="Altura (mm)"
              value={opening.heightMm}
              onChange={(v) => updateOpening({ heightMm: v })}
              min={100}
            />
            <NumberField
              label="Offset horizontal (mm)"
              value={opening.horizontalOffsetMm}
              onChange={(v) => updateOpening({ horizontalOffsetMm: v })}
            />
            <NumberField
              label="Altura do piso (mm)"
              value={opening.floorOffsetMm}
              onChange={(v) => updateOpening({ floorOffsetMm: v })}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
