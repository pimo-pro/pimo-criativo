import { useMemo, useState } from "react";
import Panel from "../ui/Panel";
import type { MaterialIndustrial } from "../../core/manufacturing/materials";
import { useMaterials } from "../../hooks/useMaterials";

export default function MaterialsManager() {
  const { materials, setMaterials } = useMaterials();

  const [form, setForm] = useState<MaterialIndustrial>({
    nome: "",
    espessuraPadrao: 18,
    custo_m2: 0,
    cor: "",
  });

  const canSave = useMemo(
    () => form.nome.trim().length > 0 && form.espessuraPadrao > 0 && form.custo_m2 >= 0,
    [form]
  );

  const handleAdd = () => {
    setForm({ nome: "", espessuraPadrao: 18, custo_m2: 0, cor: "" });
  };

  const handleSave = () => {
    if (!canSave) return;
    const normalized: MaterialIndustrial = {
      nome: form.nome.trim(),
      espessuraPadrao: Math.max(0, Number(form.espessuraPadrao)),
      custo_m2: Math.max(0, Number(form.custo_m2)),
      cor: form.cor?.trim() || undefined,
    };
    setMaterials((prev) => [...prev, normalized]);
    setForm({ nome: "", espessuraPadrao: 18, custo_m2: 0, cor: "" });
  };

  return (
    <div className="stack">
      <Panel title="Materiais existentes">
        <div className="list-vertical">
          {materials.map((material) => (
            <div
              key={`${material.nome}-${material.espessuraPadrao}`}
              className="card"
            >
              <div>
                <div className="card-title">{material.nome}</div>
                <div className="muted-text">
                  Espessura: {material.espessuraPadrao}mm · Custo: {material.custo_m2}€/m²
                </div>
              </div>
              {material.cor && (
                <div
                  title={material.cor}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: material.cor,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Adicionar Material">
        <div className="stack-tight">
          <button className="button" onClick={handleAdd}>
            Adicionar Material
          </button>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Nome"
              value={form.nome}
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            />
            <input
              className="input"
              type="number"
              placeholder="Espessura padrão (mm)"
              value={form.espessuraPadrao}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, espessuraPadrao: Number(e.target.value) }))
              }
            />
            <input
              className="input"
              type="number"
              placeholder="Custo por m²"
              value={form.custo_m2}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, custo_m2: Number(e.target.value) }))
              }
            />
            <input
              className="input"
              placeholder="Cor (opcional)"
              value={form.cor ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, cor: e.target.value }))}
            />
          </div>
          <button
            className="button"
            style={{
              background: canSave ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
              border: canSave ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.6,
            }}
            onClick={handleSave}
            disabled={!canSave}
          >
            Guardar
          </button>
        </div>
      </Panel>
    </div>
  );
}
