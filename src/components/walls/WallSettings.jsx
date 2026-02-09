import WallDimensions from "./WallDimensions";
import WallColor from "./WallColor";
import { wallStore } from "../../stores/wallStore";

export default function WallSettings({ selectedWall }) {
  if (!selectedWall) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Selecione uma parede para editar.
      </div>
    );
  }

  const addOpening = (type) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const openings = [...(selectedWall.openings ?? [])];
    if (type === "door") {
      openings.push({
        id,
        type: "door",
        widthMm: 900,
        heightMm: 2100,
        floorOffsetMm: 0,
        horizontalOffsetMm: 0,
      });
    } else {
      openings.push({
        id,
        type: "window",
        widthMm: 1200,
        heightMm: 1200,
        floorOffsetMm: 900,
        horizontalOffsetMm: 0,
      });
    }
    wallStore.getState().updateWall(selectedWall.id, { openings });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Configurações da parede</div>
      <WallDimensions wall={selectedWall} />
      <WallColor wall={selectedWall} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Porta / Janela</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => addOpening("door")}
            style={{ flex: 1 }}
          >
            Adicionar Porta
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => addOpening("window")}
            style={{ flex: 1 }}
          >
            Adicionar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
