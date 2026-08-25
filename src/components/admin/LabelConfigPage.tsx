/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Panel from "../ui/Panel";
import { useProject } from "../../context/useProject";
import {
  normalizeRulesConfig,
  type RulesConfig,
} from "../../core/rules/rulesConfig";
import type { PaletteGroup } from "../../core/labelConfig/labelConfig";
import {
  AdminPageHeader,
  AdminStickyActionBar,
  adminLabelStyle,
  adminPageShellStyle,
} from "./AdminUi";
import { useAdminFeedback } from "../../hooks/useAdminFeedback";
import {
  buildDefaultLabelSystemV5,
  type LabelSystemV5,
  type QrPolicy,
} from "../../core/labelSystem/LabelSystemV5";
import { normalizeLabelSystemV5 } from "../../core/labelSystem/resolveLabelSystemConfig";
import { hasStoredLabelDesignerConfig, loadLabelDesignerConfig } from "../../core/labelDesigner/labelDesignerStorage";
import EtiquetaDesignerPage from "./EtiquetaDesignerPage";
import AdminLabelPreview from "./AdminLabelPreview";
import { useSettings } from "../../context/SettingsContext";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PALETTE_CODES: PaletteGroup["code"][] = ["D", "O", "OD", "C", "L", "E"];
const QR_POLICY_OPTIONS: { value: QrPolicy; label: string; description: string }[] = [
  { value: "v5", label: "v5 (ID industrial)", description: "Código industrial da etiqueta (buildIndustrialId)" },
  { value: "short", label: "Short (= v5)", description: "Mesmo ID industrial — ShortCode legado removido" },
  { value: "dual", label: "Dual (= v5)", description: "Mesmo ID industrial (sem segundo algoritmo)" },
];
type LabelTab = "Geral" | "Produção" | "Layout" | "Preview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={adminLabelStyle}>{label}</span>
      <input
        className="input"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/** Converte LabelSystemV5 de volta para os campos legados (backward compat). */
function toLegacyFields(schema: LabelSystemV5, current: RulesConfig): Partial<RulesConfig> {
  return {
    etiqueta: {
      ...current.etiqueta,
      tamanhoQr: schema.dimensions.qrSizeMm,
      larguraMm: schema.dimensions.widthMm,
      alturaMm: schema.dimensions.heightMm,
    },
    labelV5: {
      bottomStrip_mm: schema.sections.bottomStrip_mm,
      materialHeight_mm: schema.sections.materialHeight_mm,
      medidasHeight_mm: schema.sections.medidasHeight_mm,
      productionHeight_mm: schema.sections.productionHeight_mm,
      observationHeight_mm: schema.sections.observationHeight_mm,
      paletteGroups: schema.palette.groups.map((g) => ({ code: g.code })),
      productionSteps: schema.sequence.productionSteps.map((s) => ({ ...s })),
      manualPieceNames: [...schema.sequence.manualPieceNames],
      noOrlarThickness_mm: schema.sequence.noOrlarThickness_mm,
    },
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function LabelConfigPage() {
  const feedback = useAdminFeedback();
  const { project, actions } = useProject();
  const { settings } = useSettings();
  const perfilAtivoId = project.rulesProfiles.perfilAtivoId;
  const perfilAtivo = project.rulesProfiles.perfis.find((p) => p.id === perfilAtivoId);

  const [activeTab, setActiveTab] = useState<LabelTab>("Geral");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // ── Draft: LabelSystemV5 é o SSOT ──────────────────────────────────────────
  const [draft, setDraft] = useState<LabelSystemV5>(() => {
    const rules = project.rules;
    // Migrar localStorage → profile se necessário (F3)
    const localStorageCfg = hasStoredLabelDesignerConfig() ? loadLabelDesignerConfig() : undefined;
    return normalizeLabelSystemV5(
      rules.labelSystemV5 ?? null,
      rules,
      settings ?? null,
      localStorageCfg
    );
  });

  useEffect(() => {
    const rules = project.rules;
    const localStorageCfg = hasStoredLabelDesignerConfig() ? loadLabelDesignerConfig() : undefined;
    setDraft(
      normalizeLabelSystemV5(
        rules.labelSystemV5 ?? null,
        rules,
        settings ?? null,
        localStorageCfg
      )
    );
  }, [project.rules, perfilAtivoId, settings]);

  // ── Helpers de actualização ────────────────────────────────────────────────

  const updateDimensions = useCallback((patch: Partial<LabelSystemV5["dimensions"]>) => {
    setDraft((prev) => ({ ...prev, dimensions: { ...prev.dimensions, ...patch } }));
  }, []);

  const updateSections = useCallback((patch: Partial<LabelSystemV5["sections"]>) => {
    setDraft((prev) => ({ ...prev, sections: { ...prev.sections, ...patch } }));
  }, []);

  const updateSequence = useCallback((patch: Partial<LabelSystemV5["sequence"]>) => {
    setDraft((prev) => ({ ...prev, sequence: { ...prev.sequence, ...patch } }));
  }, []);

  const updatePalette = useCallback((patch: Partial<LabelSystemV5["palette"]>) => {
    setDraft((prev) => ({ ...prev, palette: { ...prev.palette, ...patch } }));
  }, []);

  const syncStepOrders = (steps: LabelSystemV5["sequence"]["productionSteps"]) =>
    steps.map((s, i) => ({ ...s, defaultOrder: i + 1 }));

  const [dragStepIndex, setDragStepIndex] = useState<number | null>(null);

  const reorderProductionSteps = (from: number, to: number) => {
    if (from === to) return;
    setDraft((prev) => {
      const next = [...prev.sequence.productionSteps];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      return { ...prev, sequence: { ...prev.sequence, productionSteps: syncStepOrders(next) } };
    });
  };

  // ── Salvar ─────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const current = normalizeRulesConfig(project.rules);
    const cleanDraft: LabelSystemV5 = {
      ...draft,
      palette: {
        groups: draft.palette.groups.filter((g) => PALETTE_CODES.includes(g.code)),
      },
      sequence: {
        ...draft.sequence,
        productionSteps: syncStepOrders(
          draft.sequence.productionSteps.filter((s) => s.id.trim().length > 0)
        ),
        manualPieceNames: draft.sequence.manualPieceNames
          .map((n) => n.trim())
          .filter(Boolean),
      },
      observations: draft.observations.map((o) => o.trim()).filter(Boolean),
    };

    // Escreve LabelSystemV5 + mantém campos legados em sync (backward compat)
    const legacyPatch = toLegacyFields(cleanDraft, current);
    const rulesToSave: RulesConfig = {
      ...current,
      ...legacyPatch,
      labelSystemV5: cleanDraft,
    };
    actions.updateRulesInProfile(perfilAtivoId, rulesToSave);
    feedback.success("Configuração de etiquetas (v5) guardada no perfil activo.");
  };

  const handleReset = () => {
    if (!confirmResetOpen) return;
    setDraft(buildDefaultLabelSystemV5());
    setConfirmResetOpen(false);
    feedback.success("Valores repostos para o padrão (ainda não guardados).");
  };

  // ── Palette helpers ────────────────────────────────────────────────────────

  const addPaletteGroup = () => {
    const used = new Set(draft.palette.groups.map((g) => g.code));
    const nextCode = PALETTE_CODES.find((code) => !used.has(code));
    if (!nextCode) {
      feedback.warning("Todos os grupos de palete já estão na lista.");
      return;
    }
    updatePalette({ groups: [...draft.palette.groups, { code: nextCode }] });
  };

  // ── Observações helpers ────────────────────────────────────────────────────

  const addObservation = () => setDraft((p) => ({ ...p, observations: [...p.observations, ""] }));
  const removeObservation = (i: number) =>
    setDraft((p) => ({ ...p, observations: p.observations.filter((_, idx) => idx !== i) }));
  const updateObservation = (i: number, val: string) =>
    setDraft((p) => {
      const next = [...p.observations];
      next[i] = val;
      return { ...p, observations: next };
    });

  // ── QR logo helper ─────────────────────────────────────────────────────────

  const qrLogoDisplay = useMemo(() => {
    if (draft.qrLogo === null) return "sem logo";
    if (!draft.qrLogo) return "herdar de Settings → etiquetasQr";
    if (draft.qrLogo.startsWith("data:")) return "logo inline (data URL)";
    return draft.qrLogo;
  }, [draft.qrLogo]);

  // ─────────────────────────────────────────────────────────────────────────

  const tabStyle = (tab: LabelTab): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: "var(--radius)",
    background: activeTab === tab ? "rgba(59,130,246,0.25)" : "transparent",
    border: activeTab === tab ? "1px solid rgba(59,130,246,0.5)" : "1px solid transparent",
    color: activeTab === tab ? "var(--text-main)" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: activeTab === tab ? 600 : 400,
  });

  return (
    <div style={{ ...adminPageShellStyle, maxWidth: 1200 }}>
      <AdminPageHeader
        title="Configuração de Etiquetas (v5)"
        subtitle={`Label System V5 — SSOT para toda a configuração de etiquetas, QR e designer. Schema v${draft.schemaVersion}.`}
      />

      <AdminStickyActionBar>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Perfil: <strong style={{ color: "var(--text-main)" }}>{perfilAtivo?.nome ?? perfilAtivoId}</strong>
          </span>
          {/* Tab nav */}
          <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
            {(["Geral", "Produção", "Layout", "Preview"] as LabelTab[]).map((tab) => (
              <button key={tab} type="button" style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmResetOpen(true)}>
            Repor padrão
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Guardar perfil
          </button>
        </div>
      </AdminStickyActionBar>

      {confirmResetOpen ? (
        <Panel title="Confirmar reposição">
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Repõe toda a configuração LabelSystemV5 para os valores padrão. Os dados legados são preservados.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmResetOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleReset}>
              Confirmar reposição
            </button>
          </div>
        </Panel>
      ) : null}

      {/* ── Tab: GERAL ──────────────────────────────────────────────────────── */}
      {activeTab === "Geral" && (
        <>
          <Panel title="Schema">
            <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)" }}>Versão do schema:</span>
              <strong style={{ color: "var(--text-main)" }}>{draft.schemaVersion}</strong>
              <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                (incrementado automaticamente em migrações não-compatíveis)
              </span>
            </div>
          </Panel>

          <Panel title="Dimensões físicas">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <NumberField
                label="Largura (mm)"
                value={draft.dimensions.widthMm}
                min={40}
                max={200}
                onChange={(v) => updateDimensions({ widthMm: v })}
              />
              <NumberField
                label="Altura (mm)"
                value={draft.dimensions.heightMm}
                min={30}
                max={150}
                onChange={(v) => updateDimensions({ heightMm: v })}
              />
              <NumberField
                label="Tamanho QR (mm)"
                value={draft.dimensions.qrSizeMm}
                min={10}
                max={60}
                onChange={(v) => updateDimensions({ qrSizeMm: v })}
              />
            </div>
          </Panel>

          <Panel title="Política de QR">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {QR_POLICY_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="qrPolicy"
                    value={opt.value}
                    checked={draft.qrPolicy === opt.value}
                    onChange={() => setDraft((p) => ({ ...p, qrPolicy: opt.value }))}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ color: "var(--text-main)", fontWeight: 500 }}>{opt.label}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Logo no QR">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Valor actual: <code style={{ color: "var(--text-main)" }}>{qrLogoDisplay}</code>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11 }}
                  onClick={() => setDraft((p) => ({ ...p, qrLogo: "" }))}
                >
                  Herdar de Settings
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11 }}
                  onClick={() => setDraft((p) => ({ ...p, qrLogo: null }))}
                >
                  Sem logo
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                Para definir um logo inline (data URL), edite directamente o JSON do perfil ou use Settings → etiquetasQr.
              </p>
            </div>
          </Panel>

          <Panel title="Observações fixas">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {draft.observations.map((obs, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    value={obs}
                    maxLength={60}
                    placeholder={`Observação ${i + 1}`}
                    onChange={(e) => updateObservation(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => removeObservation(i)}>
                    Remover
                  </button>
                </div>
              ))}
              {draft.observations.length < 3 && (
                <button type="button" className="btn btn-secondary" onClick={addObservation}>
                  Adicionar observação
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              Máximo 3 linhas de observação impressas em todas as etiquetas deste perfil.
            </p>
          </Panel>

          <Panel title="Peças manuais">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={draft.manualPieces}
                onChange={(e) => setDraft((p) => ({ ...p, manualPieces: e.target.checked }))}
              />
              Incluir peças manuais (fora de CNC) na listagem de etiquetas
            </label>
          </Panel>
        </>
      )}

      {/* ── Tab: PRODUÇÃO ───────────────────────────────────────────────────── */}
      {activeTab === "Produção" && (
        <>
          <Panel title="Alturas das secções internas">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <NumberField
                label="Faixa inferior (mm)"
                value={draft.sections.bottomStrip_mm}
                min={4}
                max={20}
                onChange={(v) => updateSections({ bottomStrip_mm: v })}
              />
              <NumberField
                label="Altura material (mm)"
                value={draft.sections.materialHeight_mm}
                min={4}
                max={20}
                onChange={(v) => updateSections({ materialHeight_mm: v })}
              />
              <NumberField
                label="Altura medidas (mm)"
                value={draft.sections.medidasHeight_mm}
                min={3}
                max={15}
                onChange={(v) => updateSections({ medidasHeight_mm: v })}
              />
              <NumberField
                label="Altura produção (mm)"
                value={draft.sections.productionHeight_mm}
                min={10}
                max={40}
                onChange={(v) => updateSections({ productionHeight_mm: v })}
              />
              <NumberField
                label="Altura observações (mm)"
                value={draft.sections.observationHeight_mm}
                min={3}
                max={15}
                onChange={(v) => updateSections({ observationHeight_mm: v })}
              />
            </div>
          </Panel>

          <Panel title="Grupos de palete">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {draft.palette.groups.map((group, index) => (
                <div key={`${group.code}-${index}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    className="input"
                    value={group.code}
                    onChange={(event) => {
                      const code = event.target.value as PaletteGroup["code"];
                      const next = draft.palette.groups.map((g, i) => (i === index ? { code } : g));
                      updatePalette({ groups: next });
                    }}
                  >
                    {PALETTE_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => updatePalette({ groups: draft.palette.groups.filter((_, i) => i !== index) })}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary" onClick={addPaletteGroup}>
              Adicionar grupo
            </button>
          </Panel>

          <Panel title="Etapas de produção" description="Arrastar para reordenar; renomear label.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {draft.sequence.productionSteps.map((step, index) => (
                <div
                  key={`${step.id}-${index}`}
                  draggable
                  onDragStart={() => setDragStepIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragStepIndex == null) return;
                    reorderProductionSteps(dragStepIndex, index);
                    setDragStepIndex(null);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr 120px auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: "var(--radius)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      dragStepIndex === index
                        ? "rgba(59,130,246,0.15)"
                        : "rgba(255,255,255,0.04)",
                    cursor: "grab",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⋮⋮</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>ID: {step.id}</span>
                    <input
                      className="input"
                      value={step.label}
                      onChange={(event) => {
                        const next = draft.sequence.productionSteps.map((s, i) =>
                          i === index ? { ...s, label: event.target.value } : s
                        );
                        updateSequence({ productionSteps: next });
                      }}
                      placeholder="Nome apresentado"
                    />
                  </div>
                  <NumberField
                    label="Ordem"
                    value={step.defaultOrder}
                    min={1}
                    max={20}
                    onChange={(value) => {
                      const next = draft.sequence.productionSteps.map((s, i) =>
                        i === index ? { ...s, defaultOrder: value } : s
                      );
                      updateSequence({ productionSteps: next });
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (draft.sequence.productionSteps.length <= 1) {
                        feedback.warning("Deve existir pelo menos uma etapa.");
                        return;
                      }
                      updateSequence({
                        productionSteps: syncStepOrders(
                          draft.sequence.productionSteps.filter((_, i) => i !== index)
                        ),
                      });
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Regras especiais">
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={adminLabelStyle}>Peças manuais (manualPieceNames)</span>
              <input
                className="input"
                value={draft.sequence.manualPieceNames.join(", ")}
                onChange={(event) =>
                  updateSequence({
                    manualPieceNames: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="SPURT_TRAS, ENCHIMENTO"
              />
            </label>
            <NumberField
              label="Espessura máx. sem orlar (mm)"
              value={draft.sequence.noOrlarThickness_mm}
              min={0}
              max={30}
              onChange={(v) => updateSequence({ noOrlarThickness_mm: v })}
            />
          </Panel>
        </>
      )}

      {/* ── Tab: LAYOUT ─────────────────────────────────────────────────────── */}
      {activeTab === "Layout" && (
        <Panel title="Designer de Layout">
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            O layout é guardado no perfil (LabelSystemV5.designerLayout) ao clicar{" "}
            <strong>Guardar perfil</strong> acima. Use "Salvar" no designer para preparar as alterações antes de guardar.
          </p>
          <EtiquetaDesignerPage
            externalConfig={draft.designerLayout}
            onExternalSave={(cfg) => setDraft((prev) => ({ ...prev, designerLayout: cfg }))}
            embedded
          />
        </Panel>
      )}

      {/* ── Tab: PREVIEW ────────────────────────────────────────────────────── */}
      {activeTab === "Preview" && (
        <Panel title="Pré-visualização v5">
          <AdminLabelPreview
            rules={project.rules}
            settings={null}
            labelSystemV5={draft}
          />
        </Panel>
      )}
    </div>
  );
}
