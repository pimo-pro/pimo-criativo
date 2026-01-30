/**
 * Gestão de regras dinâmicas por modelo GLB (Admin).
 * Permite adicionar, editar e ativar/desativar regras por modelo do catálogo.
 */

import { useState } from "react";
import Panel from "../ui/Panel";
import { useCadModels } from "../../hooks/useCadModels";
import {
  getModelRules,
  addModelRule,
  setRuleEnabled,
  removeModelRule,
} from "../../core/rules/modelRules";
import type {
  SingleRule,
  DimensionRule,
  MaterialRule,
  CompatibilityRule,
} from "../../core/rules/types";

function ruleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function RulesManager() {
  const { models: cadModels } = useCadModels();
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [addKind, setAddKind] = useState<"dimension" | "material" | "compatibility">("dimension");
  const [dimension, setDimension] = useState<"largura" | "altura" | "profundidade">("altura");
  const [minMm, setMinMm] = useState("");
  const [maxMm, setMaxMm] = useState("");
  const [allowedMaterials, setAllowedMaterials] = useState("");
  const [maxInstances, setMaxInstances] = useState("1");
  const [, setRefresh] = useState(0);

  const selectedModel = cadModels.find((c) => c.id === selectedModelId);
  const modelRules = selectedModelId ? getModelRules(selectedModelId) : undefined;
  const rules = modelRules?.rules ?? [];

  const handleAddRule = () => {
    if (!selectedModelId) return;
    let rule: SingleRule;
    if (addKind === "dimension") {
      rule = {
        kind: "dimension",
        id: ruleId(),
        enabled: true,
        dimension,
        minMm: minMm ? Number(minMm) : undefined,
        maxMm: maxMm ? Number(maxMm) : undefined,
      } as DimensionRule;
    } else if (addKind === "material") {
      rule = {
        kind: "material",
        id: ruleId(),
        enabled: true,
        allowedMaterials: allowedMaterials
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      } as MaterialRule;
    } else {
      rule = {
        kind: "compatibility",
        id: ruleId(),
        enabled: true,
        maxInstancesPerBox: maxInstances ? parseInt(maxInstances, 10) : undefined,
      } as CompatibilityRule;
    }
    addModelRule(selectedModelId, rule);
    setMinMm("");
    setMaxMm("");
    setAllowedMaterials("");
    setMaxInstances("1");
    setRefresh((r) => r + 1);
  };

  const handleRemoveRule = (ruleId: string) => {
    if (!selectedModelId) return;
    removeModelRule(selectedModelId, ruleId);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <Panel
        title="Regras dinâmicas por modelo GLB"
        description="Defina regras de dimensão, material e compatibilidade por modelo. As regras são validadas quando o modelo está numa caixa."
      />
      <Panel title="Selecionar modelo">
        <select
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          className="select"
        >
          <option value="">— Selecionar modelo —</option>
          {cadModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome} ({m.categoria})
            </option>
          ))}
        </select>
      </Panel>

      {selectedModelId && (
        <>
          <Panel title={`Regras: ${selectedModel?.nome ?? selectedModelId}`}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: 10,
                    background: "var(--surface)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => {
                        setRuleEnabled(selectedModelId, r.id, !r.enabled);
                        setRefresh((x) => x + 1);
                      }}
                    />
                    <span>
                      [{r.kind}] {r.id}
                      {r.kind === "dimension" && ` ${(r as DimensionRule).dimension} ${(r as DimensionRule).minMm ?? "?"}-${(r as DimensionRule).maxMm ?? "?"} mm`}
                      {r.kind === "material" && ` ${(r as MaterialRule).allowedMaterials.join(", ")}`}
                      {r.kind === "compatibility" && ` máx ${(r as CompatibilityRule).maxInstancesPerBox} por caixa`}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(r.id)}
                    className="panel-button"
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            {rules.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma regra. Adicione abaixo.</p>
            )}
          </Panel>

          <Panel title="Adicionar regra">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Tipo</label>
                <select
                  value={addKind}
                  onChange={(e) => setAddKind(e.target.value as typeof addKind)}
                  className="select"
                >
                  <option value="dimension">Dimensão (min/max mm)</option>
                  <option value="material">Material (permitidos)</option>
                  <option value="compatibility">Compatibilidade (máx por caixa)</option>
                </select>
              </div>
              {addKind === "dimension" && (
                <>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Dimensão</label>
                    <select
                      value={dimension}
                      onChange={(e) => setDimension(e.target.value as typeof dimension)}
                      className="select"
                    >
                      <option value="largura">Largura</option>
                      <option value="altura">Altura</option>
                      <option value="profundidade">Profundidade</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Mín (mm)</label>
                      <input
                        type="number"
                        value={minMm}
                        onChange={(e) => setMinMm(e.target.value)}
                        placeholder="opcional"
                        className="input"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Máx (mm)</label>
                      <input
                        type="number"
                        value={maxMm}
                        onChange={(e) => setMaxMm(e.target.value)}
                        placeholder="opcional"
                        className="input"
                      />
                    </div>
                  </div>
                </>
              )}
              {addKind === "material" && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Materiais permitidos (separados por vírgula)</label>
                  <input
                    type="text"
                    value={allowedMaterials}
                    onChange={(e) => setAllowedMaterials(e.target.value)}
                    placeholder="MDF, Contraplacado, Carvalho"
                    className="input"
                  />
                </div>
              )}
              {addKind === "compatibility" && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Máximo de instâncias por caixa</label>
                  <input
                    type="number"
                    min={1}
                    value={maxInstances}
                    onChange={(e) => setMaxInstances(e.target.value)}
                    className="input"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={handleAddRule}
                className="panel-button"
                style={{ alignSelf: "flex-start" }}
              >
                Adicionar regra
              </button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
