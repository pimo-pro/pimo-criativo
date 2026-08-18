import { useMemo, type CSSProperties } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";

/**
 * Painel de medições da régua unificada (global) + medições legadas da caixa selecionada.
 */
export default function InternalMeasurementsPanel() {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const boxId = project.selectedWorkspaceBoxId;

  const unifiedEntries = useMemo(
    () => project.measurements?.unified ?? [],
    [project.measurements?.unified]
  );

  const legacyEntries = useMemo(
    () => (project.measurements?.internal ?? []).filter((e) => e.boxId === boxId),
    [project.measurements?.internal, boxId]
  );

  const rulerActive = viewerApi?.getMeasurementMode?.() === true;

  if (unifiedEntries.length === 0 && legacyEntries.length === 0 && !rulerActive) return null;

  return (
    <div
      role="region"
      aria-label="Medições"
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 6,
        pointerEvents: "auto",
        minWidth: 220,
        maxWidth: 280,
        maxHeight: "40vh",
        overflow: "auto",
        fontSize: 12,
        color: "#e2e8f0",
        background: "rgba(15, 23, 42, 0.88)",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        borderRadius: 8,
        padding: "8px 10px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Medições (régua)</div>
      {unifiedEntries.length === 0 ? (
        <div style={{ opacity: 0.75, marginBottom: 6 }}>Clique em dois pontos para medir.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {unifiedEntries.map((entry) => (
            <li key={entry.id} style={rowStyle}>
              <span style={{ opacity: entry.visible ? 1 : 0.45 }}>{entry.valueMm.toFixed(1)} mm</span>
              <span style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => actions.toggleUnifiedMeasurementVisibility(entry.id)}
                  style={btnStyle}
                  title={entry.visible ? "Ocultar" : "Mostrar"}
                >
                  {entry.visible ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  type="button"
                  onClick={() => actions.removeUnifiedMeasurement(entry.id)}
                  style={btnStyle}
                  title="Apagar"
                >
                  Apagar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {unifiedEntries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          <button type="button" onClick={() => actions.hideAllUnifiedMeasurements()} style={btnStyle}>
            Ocultar todas
          </button>
          <button type="button" onClick={() => actions.showAllUnifiedMeasurements()} style={btnStyle}>
            Mostrar todas
          </button>
          <button type="button" onClick={() => actions.clearUnifiedMeasurements()} style={btnStyle}>
            Apagar todas
          </button>
        </div>
      )}

      {legacyEntries.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: "10px 0 6px", opacity: 0.8 }}>Medições antigas (caixa)</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {legacyEntries.map((entry) => (
              <li key={entry.id} style={rowStyle}>
                <span style={{ opacity: entry.visible ? 1 : 0.45 }}>{entry.valueMm.toFixed(1)} mm</span>
                <span style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => actions.toggleInternalMeasurementVisibility(entry.id)}
                    style={btnStyle}
                    title={entry.visible ? "Ocultar" : "Mostrar"}
                  >
                    {entry.visible ? "Ocultar" : "Mostrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.removeInternalMeasurement(entry.id)}
                    style={btnStyle}
                    title="Apagar"
                  >
                    Apagar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            <button type="button" onClick={() => actions.clearInternalMeasurements(boxId)} style={btnStyle}>
              Apagar antigas
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "4px 0",
  borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
};

const btnStyle: CSSProperties = {
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(30, 41, 59, 0.9)",
  color: "#e2e8f0",
  cursor: "pointer",
};
