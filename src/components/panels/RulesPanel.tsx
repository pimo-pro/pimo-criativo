/**
 * Painel dedicado a regras dinâmicas por modelo GLB.
 * Lista violações e permite ativar/desativar regras por modelo.
 */

import { useState } from "react";
import { useProject } from "../../context/useProject";
import {
  getModelRules,
  setRuleEnabled,
  getRulesForModel,
} from "../../core/rules/modelRules";
import { useCadModels } from "../../hooks/useCadModels";
import Panel from "../ui/Panel";
import RuleViolationsAlert from "../ui/RuleViolationsAlert";

export default function RulesPanel() {
  const { project } = useProject();
  const { models: cadModels } = useCadModels();
  const [, setRefresh] = useState(0);
  const violations = project.ruleViolations ?? [];
  const selectedBoxId = project.selectedWorkspaceBoxId;

  const handleToggleRule = (modelId: string, ruleId: string, enabled: boolean) => {
    setRuleEnabled(modelId, ruleId, enabled);
    setRefresh((r) => r + 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel
        title="Regras dinâmicas por modelo GLB"
        description="Cada modelo pode ter regras de dimensão, material, compatibilidade e comportamento. Violações aparecem aqui e no painel esquerdo."
      >
        <RuleViolationsAlert
          violations={violations}
          boxId={selectedBoxId}
        />
        {violations.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Nenhuma violação de regras no momento. Adicione regras aos modelos no Admin → Regras.
          </p>
        )}
      </Panel>

      <Panel title="Regras por modelo (catálogo)" description="Modelos com regras definidas.">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {cadModels.map((cad) => {
            const rules = getModelRules(cad.id);
            const activeRules = rules ? getRulesForModel(cad.id) : [];
            if (!rules || activeRules.length === 0) return null;
            return (
              <li
                key={cad.id}
                style={{
                  padding: 10,
                  background: "var(--surface)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{cad.nome}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 12 }}>
                  {rules.rules.map((r) => (
                    <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={() => handleToggleRule(cad.id, r.id, !r.enabled)}
                      />
                      <span>
                        [{r.kind}] {r.id}
                        {r.kind === "dimension" && " (dimensão)"}
                        {r.kind === "material" && " (material)"}
                        {r.kind === "compatibility" && " (compatibilidade)"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        {cadModels.every((c) => !getModelRules(c.id)?.rules?.length) && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Nenhum modelo tem regras definidas. Use o Admin → Regras para criar.
          </p>
        )}
      </Panel>
    </div>
  );
}
