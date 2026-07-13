// @pimo-soon — funcionalidade incompleta, será expandida na próxima fase

import { useEffect, useMemo, useState } from "react";
import Panel from "../../components/ui/Panel";
import { AdminPageHeader, AdminStickyActionBar, adminPageShellStyle } from "../../components/admin/AdminUi";
import { invariantRulesStore } from "../../core/invariants/config/invariantRulesStore";
import { listInvariantValidators } from "../../core/invariants/registry";
import type { InvariantRuleConfig, InvariantSeverity, InvariantSystemConfig } from "../../core/invariants/types";

const SEVERITY_OPTIONS: InvariantSeverity[] = ["info", "warning", "error"];

function newRuleId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function InvariantRulesAdminPage() {
  const [draft, setDraft] = useState<InvariantSystemConfig>(() => invariantRulesStore.get());
  const [saved, setSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState<Partial<InvariantRuleConfig>>({
    validatorId: "drill-holes-out-of-bounds",
    severity: "warning",
    enabled: true,
  });

  const validators = useMemo(() => listInvariantValidators(), []);

  useEffect(() => invariantRulesStore.subscribe(() => setDraft(invariantRulesStore.get())), []);

  const onSave = () => {
    invariantRulesStore.set(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onReset = () => {
    invariantRulesStore.reset();
    setDraft(invariantRulesStore.get());
  };

  const toggleRule = (ruleId: string, enabled: boolean) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)),
    }));
  };

  const updateRuleField = (ruleId: string, patch: Partial<InvariantRuleConfig>) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
    }));
  };

  const removeRule = (ruleId: string) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
  };

  const addCustomRule = () => {
    const validator = validators.find((v) => v.id === newRule.validatorId);
    if (!validator) return;
    const rule: InvariantRuleConfig = {
      id: newRuleId(),
      validatorId: validator.id,
      name: newRule.name?.trim() || validator.defaultName,
      description: newRule.description?.trim() || validator.defaultDescription,
      severity: newRule.severity ?? validator.defaultSeverity,
      enabled: newRule.enabled !== false,
      isCustom: true,
    };
    setDraft((prev) => ({ ...prev, rules: [...prev.rules, rule] }));
    setShowAddForm(false);
    setNewRule({ validatorId: validator.id, severity: validator.defaultSeverity, enabled: true });
  };

  return (
    <div style={adminPageShellStyle}>
      <AdminPageHeader
        title="Invariant Rules"
        subtitle="Motor de validação industrial — detecta problemas sem bloquear o fluxo (excepto quando a geração estiver bloqueada)."
      />

      <p
        style={{
          margin: "0 0 12px",
          padding: "6px 10px",
          fontSize: 11,
          lineHeight: 1.4,
          color: "var(--text-muted)",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.22)",
          borderRadius: 6,
        }}
      >
        Sistema Invariant — versão inicial (incompleto) · @pimo-soon
      </p>

      <AdminStickyActionBar>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {saved ? "Configuração guardada." : "Alterações pendentes até guardar."}
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`button button-sm${!draft.blockGenerationOnErrors ? " button-primary" : ""}`}
            onClick={() => setDraft((p) => ({ ...p, blockGenerationOnErrors: false }))}
          >
            Permitir geração com erros
          </button>
          <button
            type="button"
            className={`button button-sm${draft.blockGenerationOnErrors ? " button-primary" : ""}`}
            onClick={() => setDraft((p) => ({ ...p, blockGenerationOnErrors: true }))}
          >
            Bloquear geração com erros
          </button>
          <button type="button" className="button button-sm" onClick={onReset}>
            Repor padrão
          </button>
          <button type="button" className="button button-primary button-sm" onClick={onSave}>
            Guardar
          </button>
        </div>
      </AdminStickyActionBar>

      <Panel title="Estado global">
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Modo actual:{" "}
          <strong style={{ color: "var(--text-main)" }}>
            {draft.blockGenerationOnErrors
              ? "Bloquear geração com erros"
              : "Permitir geração com erros"}
          </strong>
          . As notificações são sempre registadas no painel do sino.
        </p>
      </Panel>

      <Panel title="Regras activas">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button type="button" className="button button-sm" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Cancelar" : "Adicionar regra"}
          </button>
        </div>
        {showAddForm ? (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              display: "grid",
              gap: 10,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Validador (função)
              <select
                className="input input-sm"
                value={newRule.validatorId ?? ""}
                onChange={(e) => setNewRule((p) => ({ ...p, validatorId: e.target.value }))}
              >
                {validators.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.defaultName} — {v.phases.join(", ")}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Nome
              <input
                className="input input-sm"
                placeholder="Nome da regra"
                value={newRule.name ?? ""}
                onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Descrição
              <input
                className="input input-sm"
                placeholder="Descrição"
                value={newRule.description ?? ""}
                onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Severidade
              <select
                className="input input-sm"
                value={newRule.severity ?? "warning"}
                onChange={(e) =>
                  setNewRule((p) => ({ ...p, severity: e.target.value as InvariantSeverity }))
                }
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button button-primary button-sm" onClick={addCustomRule}>
              Criar regra
            </button>
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: 8 }}>Activa</th>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>Validador</th>
                <th style={{ padding: 8 }}>Severidade</th>
                <th style={{ padding: 8 }}>Descrição</th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {draft.rules.map((rule) => (
                <tr key={rule.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => toggleRule(rule.id, e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      className="input input-sm"
                      value={rule.name}
                      onChange={(e) => updateRuleField(rule.id, { name: e.target.value })}
                    />
                  </td>
                  <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{rule.validatorId}</td>
                  <td style={{ padding: 8 }}>
                    <select
                      className="input input-sm"
                      value={rule.severity}
                      onChange={(e) =>
                        updateRuleField(rule.id, { severity: e.target.value as InvariantSeverity })
                      }
                    >
                      {SEVERITY_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 8, maxWidth: 280 }}>
                    <input
                      className="input input-sm"
                      value={rule.description}
                      onChange={(e) => updateRuleField(rule.id, { description: e.target.value })}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    {rule.isCustom ? (
                      <button type="button" className="button button-sm" onClick={() => removeRule(rule.id)}>
                        Remover
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Validadores disponíveis (código)">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
          {validators.map((v) => (
            <li key={v.id}>
              <code>{v.id}</code> — {v.defaultDescription} (fases: {v.phases.join(", ")})
            </li>
          ))}
        </ul>
        <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
          Para adicionar novos validadores em código, consulte{" "}
          <code>src/core/invariants/README.md</code>.
        </p>
      </Panel>
    </div>
  );
}
