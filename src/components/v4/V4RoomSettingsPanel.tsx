import { useState } from "react";
import type { V4RoomConfig } from "../../v4/state/V4RoomConfig";
import { V4RoomShapeGrid } from "./V4RoomShapeGrid";
import { V4RoomWallInputs } from "./V4RoomWallInputs";
import { getShapeById, defaultWallValues } from "../../v4/state/V4RoomShapes";

interface V4RoomSettingsProps {
  config: V4RoomConfig;
  onUpdate: (partial: Partial<V4RoomConfig>) => void;
}

const SEP = (
  <div style={{ height: 1, background: "var(--v4-border, #30363d)", margin: "4px 0" }} />
);

const LABEL_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--v4-text-subtle, #8b949e)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function V4RoomSettingsPanel({ config, onUpdate }: V4RoomSettingsProps) {
  const [selectedShapeId, setSelectedShapeId] = useState("rectangle");
  const [wallValues, setWallValues]            = useState<Record<string, number>>(
    () => defaultWallValues(getShapeById("rectangle"))
  );
  const [height, setHeight]     = useState(config.height / 10);
  const [wallColor, setWallColor]   = useState(config.wallColor);
  const [floorColor, setFloorColor] = useState(config.floorColor);
  const [showCeiling, setShowCeiling] = useState(config.showCeiling);

  function handleSelectShape(shapeId: string) {
    setSelectedShapeId(shapeId);
    setWallValues(defaultWallValues(getShapeById(shapeId)));
  }

  function handleWallChange(wallId: string, value: number) {
    setWallValues((prev) => ({ ...prev, [wallId]: value }));
  }

  function handleApply() {
    const shape = getShapeById(selectedShapeId);
    const built = shape.buildConfig(wallValues, height, config);
    onUpdate({
      ...built,
      wallColor,
      floorColor,
      showCeiling,
    });
  }

  const shape = getShapeById(selectedShapeId);

  return (
    <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <p style={LABEL_STYLE}>Configuração da Sala</p>

      {SEP}

      {/* Shape grid */}
      <V4RoomShapeGrid
        selectedShapeId={selectedShapeId}
        onSelectShape={handleSelectShape}
      />

      {SEP}

      {/* Wall inputs */}
      <p style={LABEL_STYLE}>Medidas das paredes</p>
      <V4RoomWallInputs
        shape={shape}
        wallValues={wallValues}
        height={height}
        onChange={handleWallChange}
        onHeightChange={setHeight}
      />

      {SEP}

      {/* Colours */}
      <p style={LABEL_STYLE}>Cores</p>

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--v4-text-muted)" }}>Paredes</span>
        <input
          type="color"
          value={wallColor}
          onChange={(e) => setWallColor(e.target.value)}
          style={{ width: 32, height: 24, padding: 2, border: "1px solid var(--v4-border)", borderRadius: 4, cursor: "pointer", background: "none" }}
        />
      </label>

      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--v4-text-muted)" }}>Chão</span>
        <input
          type="color"
          value={floorColor}
          onChange={(e) => setFloorColor(e.target.value)}
          style={{ width: 32, height: 24, padding: 2, border: "1px solid var(--v4-border)", borderRadius: 4, cursor: "pointer", background: "none" }}
        />
      </label>

      {SEP}

      {/* Ceiling toggle */}
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
        <span style={{ fontSize: 12, color: "var(--v4-text-muted)" }}>Mostrar teto</span>
        <input
          type="checkbox"
          checked={showCeiling}
          onChange={(e) => setShowCeiling(e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--v4-accent, #3b82f6)" }}
        />
      </label>

      {/* Apply */}
      <button
        type="button"
        className="v4-btn v4-btn--primary"
        onClick={handleApply}
        style={{ marginTop: 4 }}
      >
        Aplicar
      </button>
    </div>
  );
}
