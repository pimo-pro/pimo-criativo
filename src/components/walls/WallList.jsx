import { useMemo } from "react";
import { useWallStore, wallStore } from "../../stores/wallStore";
import { useUiStore } from "../../stores/uiStore";

export default function WallList() {
  const walls = useWallStore((state) => state.walls);
  const selectedWallId = useWallStore((state) => state.selectedWallId);
  const setSelectedObject = useUiStore((state) => state.setSelectedObject);
  const setSelectedTool = useUiStore((state) => state.setSelectedTool);

  const numWalls = walls.length;
  const canAddWall = numWalls < 4;
  const canRemoveWall = numWalls > 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Lista de paredes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {walls.map((wall, index) => {
          const isSelected = wall.id === selectedWallId;
          const rot = wall.rotation ?? 0;
          return (
            <button
              key={wall.id}
              type="button"
              className="button button-ghost"
              onClick={() => {
                wallStore.getState().selectWall(wall.id);
                wallStore.getState().setOpen(true);
                setSelectedTool("layout");
                setSelectedObject({ type: "wall", id: wall.id });
              }}
              style={{
                justifyContent: "flex-start",
                flexDirection: "column",
                alignItems: "stretch",
                textAlign: "left",
                background: isSelected ? "rgba(59, 130, 246, 0.15)" : "transparent",
                border: isSelected ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid transparent",
              }}
            >
              <span style={{ fontWeight: 500 }}>Parede {index + 1}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {wall.lengthCm} × {wall.heightCm} cm, esp. {wall.thicknessCm} cm, {rot}°
              </span>
            </button>
          );
        })}
        {walls.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma parede. Use &quot;Resetar Sala&quot;.</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => wallStore.getState().resetRoom()}
          style={{ flex: "1 1 100%" }}
        >
          Resetar Sala
        </button>
        {canAddWall && (
          <button
            type="button"
            className="button button-ghost"
            onClick={() => wallStore.getState().createWall()}
            style={{ flex: 1 }}
          >
            Adicionar Parede
          </button>
        )}
        <button
          type="button"
          className="button button-ghost"
          onClick={() => selectedWallId && wallStore.getState().removeWall(selectedWallId)}
          disabled={!selectedWallId || !canRemoveWall}
          style={{ flex: 1, opacity: selectedWallId && canRemoveWall ? 1 : 0.6 }}
        >
          Remover Parede
        </button>
      </div>
      {numWalls >= 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Paredes:</span>
          <button
            type="button"
            className="button button-ghost"
            style={{ padding: "4px 8px", fontSize: 12, background: numWalls === 3 ? "rgba(59,130,246,0.2)" : undefined }}
            onClick={() => wallStore.getState().setNumWalls(3)}
          >
            3
          </button>
          <button
            type="button"
            className="button button-ghost"
            style={{ padding: "4px 8px", fontSize: 12, background: numWalls === 4 ? "rgba(59,130,246,0.2)" : undefined }}
            onClick={() => wallStore.getState().setNumWalls(4)}
          >
            4
          </button>
        </div>
      )}
    </div>
  );
}
