import { useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { getViewerMaterialId } from "../../../core/materials/service";
import { getSettings } from "../../../core/settings/settingsService";
import { DRAWER_HEIGHT_MODES } from "../../../core/drawers/drawerUiConstants";
import type { DrawerHeightMode } from "../../../core/drawers/drawerHeightModeTypes";
import { validateBoxDrawerConfiguration } from "../../../core/drawers/drawerUiValidation";
import {
  resolveDrawerBodyHeightMm,
  resolveDrawerDisplayName,
} from "../../../core/drawers/drawerLayerCustomization";
import { normalizeDrawerPresets } from "../../../core/drawers/drawerPresets";
import DrawerConfigPanel, {
  DrawerCustomHeightsTable,
  getDrawerStatusBadges,
} from "../../panels/DrawerConfigPanel";
import DrawerGlobalHardwarePanel from "./DrawerGlobalHardwarePanel";
import { resolveActiveDrawersLayer } from "../../../core/drawers/drawerModeloAGate";
import { markHardwareSourceIndividual } from "../../../core/drawers/drawerHardware";
import type { WorkspaceBox } from "../../../core/types";

type GavetasPopoverPanelProps = {
  box: WorkspaceBox;
  /** Quantidade actual (box.gavetas). */
  value: number;
  min?: number;
  max?: number;
  onCountChange: (n: number) => void;
};

const alertStyle = (level: "warning" | "error") => ({
  fontSize: 11,
  padding: "8px 10px",
  borderRadius: 6,
  marginBottom: 8,
  background: level === "error" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)",
  color: level === "error" ? "#fca5a5" : "#fde68a",
  border: `1px solid ${level === "error" ? "rgba(239,68,68,0.35)" : "rgba(234,179,8,0.35)"}`,
});

const badgeStyle = {
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.08)",
  color: "var(--text-muted)",
};

/**
 * Ficha completa de gavetas (padrão Divisórios / Remate):
 * quantidade + configurações por gaveta + sistema de corrediça no mesmo cartão.
 */
export default function GavetasPopoverPanel({
  box,
  value,
  min = 0,
  max = 99,
  onCountChange,
}: GavetasPopoverPanelProps) {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const [expandedDrawerIds, setExpandedDrawerIds] = useState<Record<string, boolean>>({});
  const [showHeightEditor, setShowHeightEditor] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const v = Math.max(min, Math.min(max, Math.floor(value)));
  const drawers = resolveActiveDrawersLayer(box);
  const settings = getSettings().gavetas;
  const heightMode = box.drawerHeightMode ?? settings.gavetaAlturaModoPadrao;
  const drawerPresets = normalizeDrawerPresets(project.drawerPresets);
  const boxAlerts = validateBoxDrawerConfiguration(box, settings);
  const errorAlerts = [
    ...(box.drawerConfigError
      ? [{ level: "error" as const, message: box.drawerConfigError }]
      : []),
    ...boxAlerts.filter((a) => a.level === "error"),
  ];
  const warningAlerts = [
    ...(box.drawerConfigWarnings ?? []).map((message) => ({
      level: "warning" as const,
      message,
    })),
    ...boxAlerts.filter((a) => a.level === "warning"),
  ];
  const uniqueWarnings = Array.from(new Map(warningAlerts.map((a) => [a.message, a])).values());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Quantidade — mesmo layout do StepperPopover */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>Gavetas</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onCountChange(Math.max(min, v - 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            -
          </button>
          <span style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{v}</span>
          <button
            type="button"
            onClick={() => onCountChange(Math.min(max, v + 1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-main)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      </div>

      {drawers.length > 0 && (
        <DrawerGlobalHardwarePanel
          drawers={drawers}
          onApply={(draft) => actions.applyDrawerHardwareGlobal(box.id, draft)}
        />
      )}

      {errorAlerts.map((alert, index) => (
        <div key={`err-${index}`} style={alertStyle("error")}>
          {alert.message}
        </div>
      ))}
      {uniqueWarnings.map((alert, index) => (
        <div key={`warn-${index}`} style={alertStyle("warning")}>
          {alert.message}
        </div>
      ))}

      {drawers.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          Sem gavetas. Aumente a quantidade para configurar frentes e corrediças.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 12 }}>Configurações das gavetas</strong>
            <span className="muted-text" style={{ fontSize: 11 }}>
              {drawers.length} un.
            </span>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Modo de altura</span>
            <select
              className="select select-xs"
              value={heightMode}
              onChange={(e) => actions.setDrawerHeightMode(e.target.value as DrawerHeightMode)}
            >
              {DRAWER_HEIGHT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 11, color: "var(--text-muted)" }}>Presets de gavetas</strong>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nome do preset</span>
              <input
                className="input input-xs"
                type="text"
                value={presetName}
                placeholder="Ex.: Cozinha 3 gavetas"
                onChange={(e) => setPresetName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="button button-ghost"
              disabled={!presetName.trim()}
              onClick={() => {
                const name = presetName.trim();
                if (!name) return;
                actions.saveDrawerPresetFromBox(box.id, name);
                setPresetName("");
              }}
            >
              Guardar como preset
            </button>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Aplicar preset</span>
              <select
                className="select select-xs"
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                <option value="">— Selecionar preset —</option>
                {drawerPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.nome} ({preset.drawerCount} gav., {preset.drawerHeightMode})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button button-primary"
              disabled={!selectedPresetId}
              onClick={() => {
                if (!selectedPresetId) return;
                actions.applyDrawerPresetToBox(box.id, selectedPresetId);
              }}
            >
              Aplicar preset
            </button>
          </div>

          <button
            type="button"
            className="button button-ghost"
            style={{ width: "100%" }}
            onClick={() => {
              if (heightMode !== "custom") {
                actions.setDrawerHeightMode("custom");
              }
              setShowHeightEditor((prev) => !prev);
            }}
          >
            {showHeightEditor ? "Ocultar Alturas" : "Editar Alturas"}
          </button>

          {showHeightEditor && (
            <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 10 }}>
              <DrawerCustomHeightsTable
                box={box}
                onHeightChange={(drawerId, height) => {
                  const drawer = drawers.find((d) => d.id === drawerId);
                  const frontOverride = drawer?.metadata?.frontHeightMm;
                  actions.updateDrawerLayerItem(drawerId, {
                    bodyHeight: height,
                    height:
                      frontOverride != null && frontOverride > 0 ? frontOverride : height,
                  });
                }}
              />
            </div>
          )}

          {drawers.map((item, index) => {
            const expanded = expandedDrawerIds[item.id] !== false;
            const badges = getDrawerStatusBadges(item);
            return (
              <div
                key={item.id}
                style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 10 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDrawerIds((prev) => ({
                      ...prev,
                      [item.id]: prev[item.id] === false ? true : false,
                    }))
                  }
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 0,
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {resolveDrawerDisplayName(item, index)}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {Math.round(item.width)}×{Math.round(item.height)} mm
                    {item.metadata?.frontHeightMm != null &&
                    item.metadata.frontHeightMm > 0 &&
                    Math.round(item.metadata.frontHeightMm) !==
                      Math.round(resolveDrawerBodyHeightMm(item))
                      ? ` (corpo ${Math.round(resolveDrawerBodyHeightMm(item))} mm)`
                      : ""}
                  </span>
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {badges.map((badge) => (
                      <span key={badge} style={badgeStyle}>
                        {badge}
                      </span>
                    ))}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                    {expanded ? "Ocultar" : "Configurar"}
                  </span>
                </button>

                {expanded && (
                  <>
                    <DrawerConfigPanel
                      drawer={item}
                      index={index}
                      box={box}
                      showHardware
                      onUpdate={(partial) =>
                        actions.updateDrawerLayerItem(item.id, markHardwareSourceIndividual(partial))
                      }
                      onFrontMaterialChange={(materialId) => {
                        actions.setDrawerMaterial(box.id, item.id, materialId);
                        const nextItems = (box.drawersLayer ?? []).map((d) =>
                          d.id === item.id
                            ? {
                                ...d,
                                material: materialId,
                                materialId,
                                metadata: { ...d.metadata, frontMaterial: materialId },
                              }
                            : d
                        );
                        viewerApi?.updateDrawerMaterial?.(
                          box.id,
                          item.id,
                          getViewerMaterialId(materialId),
                          nextItems
                        );
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => actions.setDrawerLayerItemOpen(item.id, !item.isOpen)}
                      >
                        {item.isOpen ? "Fechar" : "Abrir"}
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => actions.removeDrawerLayerItem(item.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
