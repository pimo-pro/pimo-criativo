import { useState } from "react";

import Button from "@/components/ui/Button";
import type { ProjetosFocusLevel } from "@/app/PROJETOS/ProjetosShowroomPanel";

type Props = {
  focusLevel: ProjetosFocusLevel;
  boxExplode: boolean;
  boxIntensity: number;
  pieceExplode: boolean;
  pieceIntensity: number;
  onBoxExplodeChange: (enabled: boolean) => void;
  onBoxIntensityChange: (value: number) => void;
  onPieceExplodeChange: (enabled: boolean) => void;
  onPieceIntensityChange: (value: number) => void;
};

export default function ShowroomViewerControls({
  focusLevel,
  boxExplode,
  boxIntensity,
  pieceExplode,
  pieceIntensity,
  onBoxExplodeChange,
  onBoxIntensityChange,
  onPieceExplodeChange,
  onPieceIntensityChange,
}: Props) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        style={toggleBtnStyle}
        title="Mostrar controlos do viewer"
      >
        Viewer
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        borderRadius: 10,
        background: "rgba(255,255,255,0.94)",
        border: "1px solid #e4e4e7",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        minWidth: 200,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#3f3f46" }}>Viewer PROJETOS</span>
        <button type="button" onClick={() => setVisible(false)} style={{ ...toggleBtnStyle, position: "static" }}>
          ×
        </button>
      </div>

      {(focusLevel === "project" || focusLevel === "box") && (
        <div style={{ display: "grid", gap: 6 }}>
          <Button
            variant={boxExplode ? "primary" : "outline"}
            style={{ fontSize: 12, padding: "6px 10px" }}
            onClick={() => onBoxExplodeChange(!boxExplode)}
          >
            {boxExplode ? "Reunir caixas" : "Separar caixas"}
          </Button>
          {boxExplode ? (
            <label style={{ fontSize: 11, color: "#52525b" }}>
              Distância
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={boxIntensity}
                onChange={(e) => onBoxIntensityChange(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          ) : null}
        </div>
      )}

      {(focusLevel === "box" || focusLevel === "piece") && (
        <div style={{ display: "grid", gap: 6 }}>
          <Button
            variant={pieceExplode ? "primary" : "outline"}
            style={{ fontSize: 12, padding: "6px 10px" }}
            onClick={() => onPieceExplodeChange(!pieceExplode)}
          >
            {pieceExplode ? "Reunir peças" : "Separar peças"}
          </Button>
          {pieceExplode ? (
            <label style={{ fontSize: 11, color: "#52525b" }}>
              Explode interno
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={pieceIntensity}
                onChange={(e) => onPieceIntensityChange(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}

const toggleBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 5,
  border: "1px solid var(--pi-btn-ghost-border, #d4d4d8)",
  background: "var(--pi-btn-ghost-bg, #fff)",
  borderRadius: "var(--pi-btn-radius, 6px)",
  padding: "4px 8px",
  fontSize: 11,
  cursor: "pointer",
};

// eslint-disable-next-line react-refresh/only-export-components
export function useShowroomExplodeDefaults(focusLevel: ProjetosFocusLevel) {
  const [boxExplode, setBoxExplode] = useState(false);
  const [boxIntensity, setBoxIntensity] = useState(0.45);
  const [pieceExplode, setPieceExplode] = useState(false);
  const [pieceIntensity, setPieceIntensity] = useState(0.35);
  const [focusSnapshot, setFocusSnapshot] = useState(focusLevel);

  if (focusLevel !== focusSnapshot) {
    setFocusSnapshot(focusLevel);
    if (focusLevel === "piece") setBoxExplode(false);
    if (focusLevel === "project") setPieceExplode(false);
  }

  return {
    boxExplode,
    boxIntensity,
    pieceExplode,
    pieceIntensity,
    setBoxExplode,
    setBoxIntensity,
    setPieceExplode,
    setPieceIntensity,
  };
}
