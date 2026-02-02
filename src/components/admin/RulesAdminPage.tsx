/**
 * Página de administração de Regras Dinâmicas.
 * Edita as regras do perfil ativo (project.rules).
 */

import { useEffect, useState } from "react";
import { useProject } from "../../context/useProject";
import { defaultRulesConfig } from "../../core/rules/rulesConfig";
import type { RulesConfig, PortaRange, PeRange } from "../../core/rules/rulesConfig";
import Panel from "../ui/Panel";

export default function RulesAdminPage() {
  const { project, actions } = useProject();
  const perfilAtivoId = project.rulesProfiles.perfilAtivoId;
  const [rules, setRules] = useState<RulesConfig>(project.rules);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setRules(project.rules);
  }, [project.rules, perfilAtivoId]);

  const handleSave = () => {
    actions.updateRulesInProfile(perfilAtivoId, rules);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    if (!confirm("Repor as regras deste perfil para os valores padrão?")) return;
    const defaults = JSON.parse(JSON.stringify(defaultRulesConfig)) as RulesConfig;
    setRules(defaults);
    actions.updateRulesInProfile(perfilAtivoId, defaults);
  };

  const updatePortaRange = (index: number, field: keyof PortaRange, value: number) => {
    const nextRanges = [...rules.portas.ranges];
    nextRanges[index] = { ...nextRanges[index], [field]: value };
    setRules((prev) => ({ ...prev, portas: { ...prev.portas, ranges: nextRanges } }));
  };

  const addPortaRange = () => {
    const last = rules.portas.ranges[rules.portas.ranges.length - 1];
    const newRange: PortaRange = { min: (last?.max ?? 0) + 1, max: (last?.max ?? 0) + 50, dobradicas: 2 };
    setRules((prev) => ({ ...prev, portas: { ...prev.portas, ranges: [...prev.portas.ranges, newRange] } }));
  };

  const removePortaRange = (index: number) => {
    if (rules.portas.ranges.length <= 1) {
      alert("Deve existir pelo menos um range.");
      return;
    }
    const next = rules.portas.ranges.filter((_, i) => i !== index);
    setRules((prev) => ({ ...prev, portas: { ...prev.portas, ranges: next } }));
  };

  const updatePeRange = (index: number, field: keyof PeRange, value: number) => {
    const nextRanges = [...rules.pes.ranges];
    nextRanges[index] = { ...nextRanges[index], [field]: value };
    setRules((prev) => ({ ...prev, pes: { ...prev.pes, ranges: nextRanges } }));
  };

  const addPeRange = () => {
    const last = rules.pes.ranges[rules.pes.ranges.length - 1];
    const newRange: PeRange = { min: (last?.max ?? 0) + 1, max: (last?.max ?? 0) + 50, pes: 4 };
    setRules((prev) => ({ ...prev, pes: { ...prev.pes, ranges: [...prev.pes.ranges, newRange] } }));
  };

  const removePeRange = (index: number) => {
    if (rules.pes.ranges.length <= 1) {
      alert("Deve existir pelo menos um range.");
      return;
    }
    const next = rules.pes.ranges.filter((_, i) => i !== index);
    setRules((prev) => ({ ...prev, pes: { ...prev.pes, ranges: next } }));
  };

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Regras Dinâmicas</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleReset} className="button button-ghost">
            Repor Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="button button-primary"
            style={{ background: isSaved ? "rgba(34,197,94,0.85)" : undefined }}
          >
            {isSaved ? "✓ Guardado" : "Guardar"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Regras da Porta */}
        <Panel title="Regras da Porta" description="Altura (cm) → Número de dobradiças">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.portas.ranges.map((range, index) => (
              <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="number"
                  value={range.min}
                  onChange={(e) => updatePortaRange(index, "min", Number(e.target.value))}
                  placeholder="Min"
                  className="input input-xs"
                  style={{ width: 80 }}
                />
                <span>–</span>
                <input
                  type="number"
                  value={range.max}
                  onChange={(e) => updatePortaRange(index, "max", Number(e.target.value))}
                  placeholder="Max"
                  className="input input-xs"
                  style={{ width: 80 }}
                />
                <span>cm →</span>
                <input
                  type="number"
                  value={range.dobradicas}
                  onChange={(e) => updatePortaRange(index, "dobradicas", Number(e.target.value))}
                  placeholder="Dobradiças"
                  className="input input-xs"
                  style={{ width: 80 }}
                />
                <button type="button" onClick={() => removePortaRange(index)} className="button button-ghost" style={{ padding: "4px 8px" }}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" onClick={addPortaRange} className="button button-ghost" style={{ marginTop: 4 }}>
              + Adicionar range
            </button>
          </div>
        </Panel>

        {/* Regras da Prateleira */}
        <Panel title="Regras da Prateleira" description="Suportes por prateleira">
          <div className="panel-field-row">
            <span className="panel-label">Suportes por prateleira:</span>
            <input
              type="number"
              value={rules.prateleiras.suportesPorPrateleira}
              onChange={(e) => setRules((prev) => ({ ...prev, prateleiras: { ...prev.prateleiras, suportesPorPrateleira: Number(e.target.value) } }))}
              className="input input-xs"
              style={{ width: 80 }}
            />
          </div>
        </Panel>

        {/* Regras dos Pés */}
        <Panel title="Regras dos Pés" description="Largura (cm) → Número de pés">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.pes.ranges.map((range, index) => (
              <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="number"
                  value={range.min}
                  onChange={(e) => updatePeRange(index, "min", Number(e.target.value))}
                  placeholder="Min"
                  className="input input-xs"
                  style={{ width: 80 }}
                />
                <span>–</span>
                <input
                  type="number"
                  value={range.max}
                  onChange={(e) => updatePeRange(index, "max", Number(e.target.value))}
                  placeholder="Max"
                  className="input input-xs"
                  style={{ width: 80 }}
                />
                <span>cm →</span>
                <input
                  type="number"
                  value={range.pes}
                  onChange={(e) => updatePeRange(index, "pes", Number(e.target.value))}
                  placeholder="Pés"
                  className="input input-xs"
                  style={{ width: 80 }}
                />
                <button type="button" onClick={() => removePeRange(index)} className="button button-ghost" style={{ padding: "4px 8px" }}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" onClick={addPeRange} className="button button-ghost" style={{ marginTop: 4 }}>
              + Adicionar range
            </button>
          </div>
        </Panel>

        {/* Regras de Altura */}
        <Panel title="Regras de Altura" description="Divisor transversal">
          <div className="panel-field-row">
            <span className="panel-label">Altura mínima para divisor (cm):</span>
            <input
              type="number"
              value={rules.altura.divisorTransversalMin}
              onChange={(e) => setRules((prev) => ({ ...prev, altura: { ...prev.altura, divisorTransversalMin: Number(e.target.value) } }))}
              className="input input-xs"
              style={{ width: 80 }}
            />
          </div>
        </Panel>

        {/* Regras de Largura */}
        <Panel title="Regras de Largura" description="Divisor longitudinal">
          <div className="panel-field-row">
            <span className="panel-label">Largura mínima para divisor (cm):</span>
            <input
              type="number"
              value={rules.largura.divisorLongitudinalMin}
              onChange={(e) => setRules((prev) => ({ ...prev, largura: { ...prev.largura, divisorLongitudinalMin: Number(e.target.value) } }))}
              className="input input-xs"
              style={{ width: 80 }}
            />
          </div>
        </Panel>

        {/* Regras de Furos */}
        <Panel title="Regras de Furos" description="Furação para prateleiras (mm)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="panel-field-row">
              <span className="panel-label">Margem topo (mm):</span>
              <input
                type="number"
                value={rules.furos.margemTopo}
                onChange={(e) => setRules((prev) => ({ ...prev, furos: { ...prev.furos, margemTopo: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
            <div className="panel-field-row">
              <span className="panel-label">Margem base (mm):</span>
              <input
                type="number"
                value={rules.furos.margemBase}
                onChange={(e) => setRules((prev) => ({ ...prev, furos: { ...prev.furos, margemBase: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
            <div className="panel-field-row">
              <span className="panel-label">Recuo borda (mm):</span>
              <input
                type="number"
                value={rules.furos.recuoBorda}
                onChange={(e) => setRules((prev) => ({ ...prev, furos: { ...prev.furos, recuoBorda: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
            <div className="panel-field-row">
              <span className="panel-label">Distância entre furos (mm):</span>
              <input
                type="number"
                value={rules.furos.distanciaEntreFuros}
                onChange={(e) => setRules((prev) => ({ ...prev, furos: { ...prev.furos, distanciaEntreFuros: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
            <div className="panel-field-row">
              <span className="panel-label">Profundidade furo (mm):</span>
              <input
                type="number"
                value={rules.furos.profundidadeFuro}
                onChange={(e) => setRules((prev) => ({ ...prev, furos: { ...prev.furos, profundidadeFuro: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
            <div className="panel-field-row">
              <span className="panel-label">Diâmetro furo (mm):</span>
              <input
                type="number"
                value={rules.furos.diametroFuro}
                onChange={(e) => setRules((prev) => ({ ...prev, furos: { ...prev.furos, diametroFuro: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
          </div>
        </Panel>

        {/* Regras de Madeira / Estrutura */}
        <Panel title="Regras de Madeira / Estrutura" description="COSTA, laterais, profundidade">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="panel-field-row">
              <span className="panel-label">Espessura COSTA (mm):</span>
              <input
                type="number"
                value={rules.madeira.espessuraCosta}
                onChange={(e) => setRules((prev) => ({ ...prev, madeira: { ...prev.madeira, espessuraCosta: Number(e.target.value) } }))}
                className="input input-xs"
                style={{ width: 80 }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={rules.madeira.calcularAlturaLaterais}
                onChange={(e) => setRules((prev) => ({ ...prev, madeira: { ...prev.madeira, calcularAlturaLaterais: e.target.checked } }))}
              />
              Calcular altura laterais = altura_total - (espessura_cima + espessura_fundo)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={rules.madeira.profundidadeFixa}
                onChange={(e) => setRules((prev) => ({ ...prev, madeira: { ...prev.madeira, profundidadeFixa: e.target.checked } }))}
              />
              Profundidade fixa (não muda com dimensões)
            </label>
          </div>
        </Panel>
      </div>
    </div>
  );
}
