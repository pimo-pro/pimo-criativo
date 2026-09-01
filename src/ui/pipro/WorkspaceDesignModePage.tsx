/**
 * Página ADMIN — Workspace Design Mode (pipro).
 * Viewer + controlos + painel industrial (cutlist / DRILL / CNC / orla / metadata).
 * Suporta `?id=pipro-model-…` para editar modelo guardado.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AdminSidebar } from "../layout/AdminSidebar";
import { PIPRO_WORKSPACE_PATH } from "../routes/piproPaths";
import { PiproDesignWorkspace } from "../../core/pipro/PiproDesignWorkspace";
import { loadPiproModel } from "../../core/pipro/piproModelsRegistry";
import { INDUSTRIAL_FEATURES } from "../../core/unifiedIndustrialBox/industrialFeatures";
import type { IndustrialFeatureId } from "../../core/unifiedIndustrialBox/types";
import { PiproDesignViewer } from "./PiproDesignViewer";

const sectionTitle: CSSProperties = { margin: "12px 0 6px", fontSize: 14 };
const muted: CSSProperties = { color: "var(--text-muted)" };
const rowBorder: CSSProperties = {
  marginBottom: 4,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  paddingBottom: 4,
};

export function WorkspaceDesignModePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  const workspace = useMemo(() => new PiproDesignWorkspace(), []);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    if (editId) {
      const record = loadPiproModel(editId);
      if (record) workspace.loadFromRecord(record);
      else {
        workspace.createBaseBox({
          nome: "Modelo pipro vazio",
          featureIds: [],
          engineEnabled: true,
        });
      }
    } else {
      workspace.createBaseBox({
        nome: "Modelo pipro vazio",
        featureIds: [],
        engineEnabled: true,
      });
    }
    queueMicrotask(() => refresh());
  }, [editId, workspace]);

  const panel = workspace.getIndustrialPanelData();
  const summary = panel.summary;
  const features = INDUSTRIAL_FEATURES;

  const toggleFeature = (id: IndustrialFeatureId) => {
    const set = new Set(workspace.state.featureIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    workspace.setFeatures([...set]);
    refresh();
  };

  const onSave = () => {
    workspace.save();
    refresh();
  };

  return (
    <div
      data-testid="workspace-design-mode-page"
      style={{
        display: "flex",
        gap: 16,
        minHeight: "100vh",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <aside style={{ width: 220, flexShrink: 0 }}>
        <AdminSidebar
          activePath={location.pathname || PIPRO_WORKSPACE_PATH}
          onNavigate={(path) => navigate(path)}
        />
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Workspace Design Mode</h1>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Motor unificado ({summary.engineId}) — features A–D; biblioteca pipro.
            {workspace.modelId ? ` · A editar: ${workspace.modelId}` : ""}
          </p>
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={workspace.state.engineEnabled}
              onChange={(e) => {
                workspace.setEngineEnabled(e.target.checked);
                refresh();
              }}
            />
            Motor industrial unificado
          </label>
          <button
            type="button"
            onClick={() => {
              navigate(PIPRO_WORKSPACE_PATH);
              workspace.createBaseBox({
                nome: "Modelo pipro vazio",
                featureIds: [],
                engineEnabled: true,
              });
              refresh();
            }}
          >
            Novo modelo vazio
          </button>
          <button
            type="button"
            onClick={() => {
              workspace.rebuild();
              refresh();
            }}
          >
            Rebuild
          </button>
          <button type="button" onClick={onSave}>
            Guardar pipro
          </button>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, minHeight: 420 }}>
          <PiproDesignViewer
            dimensions={workspace.state.dimensions}
            pieces={workspace.pieces}
            showDrill
            showOrla
            showCnc
          />

          <aside
            data-testid="pipro-industrial-right-panel"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: 12,
              overflow: "auto",
              maxHeight: "70vh",
              fontSize: 12,
            }}
          >
            <div data-testid="pipro-panel-badge" style={{ marginBottom: 8, fontWeight: 600 }}>
              Motor: {summary.engineEnabled ? "ON" : "OFF"} · peças: {summary.pieceCount} · features:{" "}
              {summary.activeFeatureIds.join(", ") || "—"}
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>Features industriais (A–D)</h2>
            {features.map((f) => (
              <label key={f.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={workspace.state.featureIds.includes(f.id)}
                  onChange={() => toggleFeature(f.id)}
                />
                <span>
                  [{f.phase}] {f.nomeTecnico}
                </span>
              </label>
            ))}

            <h2 style={sectionTitle}>Dimensões (mm)</h2>
            {(["largura", "altura", "profundidade", "espessura"] as const).map((key) => (
              <label
                key={key}
                style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}
              >
                <span>{key}</span>
                <input
                  type="number"
                  value={workspace.state.dimensions[key]}
                  style={{ width: 90 }}
                  onChange={(e) => {
                    workspace.setDimensions({ [key]: Number(e.target.value) || 0 });
                    refresh();
                  }}
                />
              </label>
            ))}

            <h2 style={sectionTitle}>Resumo industrial</h2>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
              <li>Cutlist: {summary.cutlistCount} peças</li>
              <li>DRILL: {summary.drillPieceCount} · furos: {summary.holeCount}</li>
              <li>CNC: {summary.cncPieceCount}</li>
              <li>Orla: {summary.orlaPieceCount}</li>
              <li>Features activas: {summary.activeFeatureIds.join(", ") || "—"}</li>
              <li>Regras: {summary.ruleIds.length}</li>
            </ul>

            <h2 style={sectionTitle}>Cutlist</h2>
            <div data-testid="pipro-panel-cutlist">
              {panel.cutlist.map((p) => (
                <div key={p.id} style={rowBorder}>
                  <div style={{ fontWeight: 600 }}>{p.industrialLabel || p.nome}</div>
                  <div style={muted}>
                    {p.tipo} · {Math.round(p.dimensoes.largura)}×{Math.round(p.dimensoes.altura)}×
                    {Math.round(p.espessura)}
                  </div>
                </div>
              ))}
            </div>

            <h2 style={sectionTitle}>Técnico</h2>
            <div data-testid="pipro-panel-tecnico">
              {panel.tecnico.map((p) => (
                <div key={p.id} style={rowBorder}>
                  <div style={{ fontWeight: 600 }}>{p.label || p.nome}</div>
                  <div style={muted}>
                    {p.tipo} · {p.kind} · {p.dims}
                  </div>
                </div>
              ))}
            </div>

            <h2 style={sectionTitle}>DRILL</h2>
            <div data-testid="pipro-panel-drill">
              {panel.drill.length === 0 ? (
                <div style={muted}>—</div>
              ) : (
                panel.drill.map((p) => (
                  <div key={p.id} style={rowBorder}>
                    <div style={{ fontWeight: 600 }}>{p.tipo}</div>
                    <div style={muted}>furos: {p.holes.length}</div>
                    {p.holes.map((h, hi) => (
                      <div key={`${p.id}-h-${hi}`} style={{ ...muted, fontSize: 10 }}>
                        #{hi + 1} x={h.x ?? "—"} y={h.y ?? "—"} d={h.diameter ?? "—"}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <h2 style={sectionTitle}>CNC</h2>
            <div data-testid="pipro-panel-cnc">
              {panel.cnc.length === 0 ? (
                <div style={muted}>—</div>
              ) : (
                panel.cnc.map((p) => (
                  <div key={p.id} style={rowBorder}>
                    {p.tipo} · {p.nome}
                  </div>
                ))
              )}
            </div>

            <h2 style={sectionTitle}>Orla</h2>
            <div data-testid="pipro-panel-orla">
              {panel.orla.length === 0 ? (
                <div style={muted}>—</div>
              ) : (
                panel.orla.map((p) => (
                  <div key={p.id} style={rowBorder}>
                    {p.tipo} · [{p.sides.join(", ")}]
                  </div>
                ))
              )}
            </div>

            <h2 style={sectionTitle}>Peças industriais</h2>
            <div data-testid="pipro-panel-pecas">
              {panel.pecasIndustriais.map((p) => (
                <div key={p.id} style={rowBorder}>
                  <div style={{ fontWeight: 600 }}>{p.nome}</div>
                  <div style={muted}>
                    {p.tipo} · {p.machineTarget ?? "—"} · orla [{(p.orlaSides ?? []).join(",") || "—"}]
                  </div>
                </div>
              ))}
            </div>

            <h2 style={sectionTitle}>Labels industriais</h2>
            <div data-testid="pipro-panel-labels">
              {panel.labelsIndustriais.length === 0 ? (
                <div style={muted}>—</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {panel.labelsIndustriais.map((label, idx) => (
                    <li key={`${label}-${idx}`}>{label}</li>
                  ))}
                </ul>
              )}
            </div>

            <h2 style={sectionTitle}>Metadata industrial</h2>
            <pre
              data-testid="pipro-panel-metadata"
              style={{ whiteSpace: "pre-wrap", fontSize: 10, margin: 0 }}
            >
              {JSON.stringify(
                {
                  modelo: panel.modelo,
                  metadata: panel.metadata,
                  ruleIds: summary.ruleIds,
                  modelId: workspace.modelId,
                },
                null,
                2
              )}
            </pre>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default WorkspaceDesignModePage;
