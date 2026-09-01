import { useCallback, useMemo, useState } from "react";

import Panel from "../../ui/Panel";
import { useSettings } from "../../../context/SettingsContext";
import { getActivePimoViewerApi } from "../../../core/viewer/pimoViewerRuntime";
import {
  DEFAULT_ORLA_VISUAL_RULES,
  ORLA_EDGE_LABELS,
  ORLA_RULE_KEY_LABELS,
  ORLA_VISUAL_EDGE_IDS,
  resolveEffectiveOrlaVisualRules,
  sanitizeOrlaRulesInput,
  type OrlaVisualEdgeId,
  type OrlaVisualRuleKey,
  type OrlaVisualRulesMap,
} from "../../../3d/viewer-engine/orla/orlaVisualRules";

const RULE_KEYS = Object.keys(DEFAULT_ORLA_VISUAL_RULES) as OrlaVisualRuleKey[];

function rulesEqual(a: OrlaVisualRulesMap, b: OrlaVisualRulesMap): boolean {
  return RULE_KEYS.every((key) => {
    const left = a[key] ?? [];
    const right = b[key] ?? [];
    if (left.length !== right.length) return false;
    return left.every((edge, index) => edge === right[index]);
  });
}

export default function OrlaRulesSettingsPanel() {
  const { settings, updateSettings } = useSettings();
  const [draft, setDraft] = useState<OrlaVisualRulesMap>(() =>
    resolveEffectiveOrlaVisualRules(settings.orlaRules)
  );
  const [savedRules, setSavedRules] = useState<OrlaVisualRulesMap>(() =>
    resolveEffectiveOrlaVisualRules(settings.orlaRules)
  );
  const [syncedOrlaRules, setSyncedOrlaRules] = useState(settings.orlaRules);
  if (settings.orlaRules !== syncedOrlaRules) {
    const effective = resolveEffectiveOrlaVisualRules(settings.orlaRules);
    setSyncedOrlaRules(settings.orlaRules);
    setDraft(effective);
    setSavedRules(effective);
  }
  const [message, setMessage] = useState<string | null>(null);

  const isDirty = useMemo(() => !rulesEqual(draft, savedRules), [draft, savedRules]);

  const toggleEdge = useCallback((ruleKey: OrlaVisualRuleKey, edge: OrlaVisualEdgeId) => {
    setDraft((prev) => {
      const current = prev[ruleKey] ?? [];
      const next = current.includes(edge)
        ? current.filter((item) => item !== edge)
        : [...current, edge];
      return { ...prev, [ruleKey]: next };
    });
    setMessage(null);
  }, []);

  const handleSave = useCallback(() => {
    const sanitized = sanitizeOrlaRulesInput(draft);
    const result = updateSettings({ orlaRules: sanitized });
    if (result.success) {
      const effective = resolveEffectiveOrlaVisualRules(result.settings.orlaRules);
      setDraft(effective);
      setSavedRules(effective);
      setMessage("Regras de ORLA guardadas.");
      getActivePimoViewerApi()?.syncOrlaVisuals?.();
    } else {
      setMessage(result.errors[0] ?? "Não foi possível guardar as regras.");
    }
  }, [draft, updateSettings]);

  const handleResetDefaults = useCallback(() => {
    setDraft({ ...DEFAULT_ORLA_VISUAL_RULES });
    setMessage(null);
  }, []);

  const handleClearOverrides = useCallback(() => {
    const result = updateSettings({ orlaRules: {} });
    if (result.success) {
      const effective = resolveEffectiveOrlaVisualRules({});
      setDraft(effective);
      setSavedRules(effective);
      setMessage("Regras repostas para os valores por defeito.");
      getActivePimoViewerApi()?.syncOrlaVisuals?.();
    }
  }, [updateSettings]);

  return (
    <Panel title="Configuração de ORLA por Tipo de Peça">
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 12 }}>
        Define quais arestas mostram fita de ORLA no viewer 3D. Não altera metros industriais nem cutlist.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {RULE_KEYS.map((ruleKey) => (
          <div
            key={ruleKey}
            style={{
              border: "1px solid var(--border-subtle, var(--border))",
              borderRadius: 6,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-main)" }}>
              {ORLA_RULE_KEY_LABELS[ruleKey]}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 14px",
              }}
            >
              {ORLA_VISUAL_EDGE_IDS.map((edge) => {
                const checked = (draft[ruleKey] ?? []).includes(edge);
                return (
                  <label
                    key={`${ruleKey}-${edge}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "var(--text-main)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEdge(ruleKey, edge)}
                    />
                    {ORLA_EDGE_LABELS[edge]}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 14,
          alignItems: "center",
        }}
      >
        <button type="button" className="button button-primary" disabled={!isDirty} onClick={handleSave}>
          Guardar regras
        </button>
        <button type="button" className="button button-ghost" onClick={handleResetDefaults}>
          Repor tabela oficial
        </button>
        <button type="button" className="button button-ghost" onClick={handleClearOverrides}>
          Limpar personalizações
        </button>
        {message ? (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{message}</span>
        ) : null}
      </div>
    </Panel>
  );
}
