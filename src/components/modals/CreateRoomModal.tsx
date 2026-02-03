/**
 * Modal para criar sala com 1–4 paredes.
 * Paredes apenas para visualização; não entram em cutlist ou produção.
 * Inclui Layout da Sala: Adicionar Porta / Adicionar Janela.
 */

import { useState, useEffect, useCallback } from "react";
import type { DoorWindowConfig, RoomConfig } from "../../context/projectTypes";
import { DEFAULT_WALL_THICKNESS_MM } from "../../3d/room/types";

type SelectedRoomElement = {
  elementId: string;
  wallId: number;
  type: "door" | "window";
  config: DoorWindowConfig;
};

type CreateRoomModalProps = {
  onCreateRoom: (config: RoomConfig) => void;
  onRemoveRoom: () => void;
  onSetPlacementMode: (mode: "door" | "window" | null) => void;
  onSetOnRoomElementPlaced: (cb: ((_w: number, _c: unknown, _t: "door" | "window") => void) | null) => void;
  onSetOnRoomElementSelected: (cb: ((_data: SelectedRoomElement | null) => void) | null) => void;
  onUpdateRoomElementConfig: (elementId: string, config: DoorWindowConfig) => boolean;
};

const DEFAULT_LENGTH_MM = 4000;
const DEFAULT_HEIGHT_MM = 2700;

export default function CreateRoomModal({
  onCreateRoom,
  onRemoveRoom,
  onSetPlacementMode,
  onSetOnRoomElementPlaced,
  onSetOnRoomElementSelected,
  onUpdateRoomElementConfig,
}: CreateRoomModalProps) {
  const [numWalls, setNumWalls] = useState<1 | 2 | 3 | 4>(4);
  const [placementMode, setPlacementMode] = useState<"door" | "window" | null>(null);
  const [selectedRoomElement, setSelectedRoomElement] = useState<SelectedRoomElement | null>(null);
  const [walls, setWalls] = useState<Array<{ lengthMm: number; heightMm: number }>>([
    { lengthMm: DEFAULT_LENGTH_MM, heightMm: DEFAULT_HEIGHT_MM },
    { lengthMm: DEFAULT_LENGTH_MM, heightMm: DEFAULT_HEIGHT_MM },
    { lengthMm: DEFAULT_LENGTH_MM, heightMm: DEFAULT_HEIGHT_MM },
    { lengthMm: DEFAULT_LENGTH_MM, heightMm: DEFAULT_HEIGHT_MM },
  ]);

  useEffect(() => {
    setWalls((prev) => {
      const next = [...prev];
      while (next.length < 4) {
        next.push({ lengthMm: DEFAULT_LENGTH_MM, heightMm: DEFAULT_HEIGHT_MM });
      }
      return next.slice(0, 4);
    });
  }, []);

  const handlePlacementDone = useCallback(() => {
    setPlacementMode(null);
  }, []);

  useEffect(() => {
    onSetOnRoomElementPlaced(handlePlacementDone);
    return () => onSetOnRoomElementPlaced(null);
  }, [onSetOnRoomElementPlaced, handlePlacementDone]);

  useEffect(() => {
    onSetOnRoomElementSelected((data: SelectedRoomElement | null) => setSelectedRoomElement(data));
    return () => onSetOnRoomElementSelected(null);
  }, [onSetOnRoomElementSelected]);

  const handleElementConfigChange = useCallback(
    (field: keyof DoorWindowConfig, value: number) => {
      if (!selectedRoomElement) return;
      const next: DoorWindowConfig = { ...selectedRoomElement.config, [field]: value };
      if (onUpdateRoomElementConfig(selectedRoomElement.elementId, next)) {
        setSelectedRoomElement((prev: SelectedRoomElement | null) => (prev ? { ...prev, config: next } : null));
      }
    },
    [selectedRoomElement, onUpdateRoomElementConfig]
  );

  const updateWall = (index: number, field: "lengthMm" | "heightMm", value: number) => {
    setWalls((prev) => {
      const next = [...prev];
      if (!next[index]) next[index] = { lengthMm: DEFAULT_LENGTH_MM, heightMm: DEFAULT_HEIGHT_MM };
      next[index] = { ...next[index], [field]: Math.max(100, Math.min(20000, value)) };
      return next;
    });
  };

  const handleCreate = () => {
    const config: RoomConfig = {
      numWalls,
      walls: walls.slice(0, numWalls),
      thicknessMm: DEFAULT_WALL_THICKNESS_MM,
    };
    onCreateRoom(config);
  };

  return (
    <div className="modal-list">
      <div className="modal-list-item">
        <div className="modal-list-info">
          <div className="modal-list-title">Número de paredes</div>
          <div className="modal-list-meta">Escolha quantas paredes formam a sala</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {([1, 2, 3, 4] as const).map((n) => (
          <button
            key={n}
            type="button"
            className="modal-action"
            style={{
              background: numWalls === n ? "rgba(59, 130, 246, 0.25)" : undefined,
              borderColor: numWalls === n ? "rgba(59, 130, 246, 0.6)" : undefined,
            }}
            onClick={() => setNumWalls(n)}
          >
            {n} parede{n > 1 ? "s" : ""}
          </button>
        ))}
      </div>

      <div className="modal-list-item">
        <div className="modal-list-info">
          <div className="modal-list-title">Dimensões (mm)</div>
          <div className="modal-list-meta">
            Comprimento e altura de cada parede. Espessura fixa: {DEFAULT_WALL_THICKNESS_MM} mm
          </div>
        </div>
      </div>
      {walls.slice(0, numWalls).map((w, i) => (
        <div
          key={i}
          className="modal-list-item"
          style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>Parede {i + 1}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ minWidth: 50 }}>Compr.</span>
              <input
                type="number"
                className="input input-sm"
                value={w.lengthMm}
                min={100}
                max={20000}
                step={100}
                onChange={(e) => updateWall(i, "lengthMm", Number(e.target.value) || 1000)}
                style={{ width: 90 }}
              />
              mm
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ minWidth: 50 }}>Altura</span>
              <input
                type="number"
                className="input input-sm"
                value={w.heightMm}
                min={100}
                max={4000}
                step={50}
                onChange={(e) => updateWall(i, "heightMm", Number(e.target.value) || 2700)}
                style={{ width: 90 }}
              />
              mm
            </label>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="modal-action" onClick={handleCreate}>
          Criar sala
        </button>
        <button
          type="button"
          className="modal-action"
          style={{ borderColor: "rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.18)" }}
          onClick={() => {
            setSelectedRoomElement(null);
            onRemoveRoom();
          }}
        >
          Remover sala
        </button>
      </div>

      <div className="modal-list-item" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="modal-list-info">
          <div className="modal-list-title">Layout da Sala</div>
          <div className="modal-list-meta">
            Adicione portas e janelas às paredes. Clique numa parede para inserir.
          </div>
        </div>
      </div>
      {placementMode ? (
        <div className="modal-list-item" style={{ background: "rgba(59, 130, 246, 0.12)", borderRadius: 6, padding: 8 }}>
          Clique numa parede para inserir {placementMode === "door" ? "a porta" : "a janela"}.
          <button
            type="button"
            className="modal-action"
            style={{ marginTop: 8 }}
            onClick={() => {
              setPlacementMode(null);
              onSetPlacementMode(null);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="modal-action"
            onClick={() => {
              setPlacementMode("door");
              onSetPlacementMode("door");
            }}
          >
            Adicionar Porta
          </button>
          <button
            type="button"
            className="modal-action"
            onClick={() => {
              setPlacementMode("window");
              onSetPlacementMode("window");
            }}
          >
            Adicionar Janela
          </button>
        </div>
      )}

      {selectedRoomElement && (
        <div
          className="modal-list-item"
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 8,
          }}
        >
          <div className="modal-list-info">
            <div className="modal-list-title">
              Editar {selectedRoomElement.type === "door" ? "Porta" : "Janela"}
            </div>
            <div className="modal-list-meta">
              Parede {selectedRoomElement.wallId + 1}. Clique fora para desselecionar.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ minWidth: 80 }}>Largura (mm)</span>
              <input
                type="number"
                className="input input-sm"
                value={selectedRoomElement.config.widthMm}
                min={100}
                max={3000}
                step={10}
                onChange={(e) =>
                  handleElementConfigChange("widthMm", Math.max(100, Number(e.target.value) || 100))
                }
                style={{ width: 90 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ minWidth: 80 }}>Altura (mm)</span>
              <input
                type="number"
                className="input input-sm"
                value={selectedRoomElement.config.heightMm}
                min={100}
                max={4000}
                step={10}
                onChange={(e) =>
                  handleElementConfigChange("heightMm", Math.max(100, Number(e.target.value) || 100))
                }
                style={{ width: 90 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ minWidth: 80 }}>Alt. piso (mm)</span>
              <input
                type="number"
                className="input input-sm"
                value={selectedRoomElement.config.floorOffsetMm}
                min={0}
                max={4000}
                step={10}
                onChange={(e) =>
                  handleElementConfigChange("floorOffsetMm", Math.max(0, Number(e.target.value) || 0))
                }
                style={{ width: 90 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ minWidth: 80 }}>Pos. horiz. (mm)</span>
              <input
                type="number"
                className="input input-sm"
                value={selectedRoomElement.config.horizontalOffsetMm}
                min={0}
                max={20000}
                step={10}
                onChange={(e) =>
                  handleElementConfigChange(
                    "horizontalOffsetMm",
                    Math.max(0, Number(e.target.value) || 0)
                  )
                }
                style={{ width: 90 }}
              />
            </label>
          </div>
          <button
            type="button"
            className="modal-action"
            style={{ alignSelf: "flex-start" }}
            onClick={() => setSelectedRoomElement(null)}
          >
            Desselecionar
          </button>
        </div>
      )}
    </div>
  );
}
