import { useMemo } from "react";
import { useWallStore, wallStore } from "../../stores/wallStore";
import WallList from "./WallList";
import WallSettings from "./WallSettings";

export default function SidebarWalls() {
  const walls = useWallStore((state) => state.walls);
  const selectedWallId = useWallStore((state) => state.selectedWallId);
  const isOpen = useWallStore((state) => state.isOpen);
  const mainWallIndex = useWallStore((state) => state.mainWallIndex);
  const setMainWallIndex = useWallStore((state) => state.setMainWallIndex);

  const selectedWall = useMemo(
    () => walls.find((wall) => wall.id === selectedWallId) ?? null,
    [walls, selectedWallId]
  );

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Criar Sala</div>
          {isOpen && (
            <label
              title="Parede frontal (onde encosta a cozinha)"
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 12,
                gap: 6,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>Frente:</span>
              <select
                aria-label="Parede frontal"
                value={mainWallIndex}
                onChange={(e) => setMainWallIndex(Number(e.target.value) ?? 0)}
                style={{
                  padding: "2px 6px",
                  fontSize: 11,
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  minWidth: 72,
                }}
              >
                <option value={0}>Parede 0</option>
                <option value={1}>Parede 1</option>
                <option value={2}>Parede 2</option>
                <option value={3}>Parede 3</option>
              </select>
            </label>
          )}
          <WallList />
          <WallSettings selectedWall={selectedWall} />
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => wallStore.getState().resetRoom()}
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
              Reiniciar Sala
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
