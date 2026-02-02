import { useMemo, useState } from "react";
import Panel from "../ui/Panel";
import type { MaterialIndustrial, IndustrialTool } from "../../core/manufacturing/materials";
import { CHAPA_PADRAO_LARGURA, CHAPA_PADRAO_ALTURA, DENSIDADE_PADRAO } from "../../core/manufacturing/materials";
import { useMaterials } from "../../hooks/useMaterials";
import { useIndustrialTools } from "../../hooks/useIndustrialTools";

export default function MaterialsManager() {
  const { materials, setMaterials } = useMaterials();
  const { tools, setTools } = useIndustrialTools();

  // Form para materiais
  const [form, setForm] = useState<MaterialIndustrial>({
    nome: "",
    espessuraPadrao: 18,
    custo_m2: 0,
    cor: "",
    larguraChapa: CHAPA_PADRAO_LARGURA,
    alturaChapa: CHAPA_PADRAO_ALTURA,
    densidade: DENSIDADE_PADRAO,
  });

  // Form para ferramentas
  const [toolForm, setToolForm] = useState<IndustrialTool>({
    id: "",
    nome: "",
    kerf: 3.0,
    tipoMaquina: "Serra",
    diametro: undefined,
  });

  const canSaveMaterial = useMemo(
    () => form.nome.trim().length > 0 && form.espessuraPadrao > 0 && form.custo_m2 >= 0,
    [form]
  );

  const canSaveTool = useMemo(
    () => toolForm.nome.trim().length > 0 && toolForm.kerf > 0 && toolForm.tipoMaquina.trim().length > 0,
    [toolForm]
  );

  // Calcular peso da chapa (kg)
  const calcularPesoChapa = (m: MaterialIndustrial): number | null => {
    const largura = m.larguraChapa ?? CHAPA_PADRAO_LARGURA;
    const altura = m.alturaChapa ?? CHAPA_PADRAO_ALTURA;
    const espessura = m.espessuraPadrao;
    const densidade = m.densidade ?? DENSIDADE_PADRAO;
    // volume em m³ = (largura_mm * altura_mm * espessura_mm) / 1e9
    const volumeM3 = (largura * altura * espessura) / 1_000_000_000;
    return volumeM3 * densidade;
  };

  const handleAddMaterial = () => {
    setForm({
      nome: "",
      espessuraPadrao: 18,
      custo_m2: 0,
      cor: "",
      larguraChapa: CHAPA_PADRAO_LARGURA,
      alturaChapa: CHAPA_PADRAO_ALTURA,
      densidade: DENSIDADE_PADRAO,
    });
  };

  const handleSaveMaterial = () => {
    if (!canSaveMaterial) return;
    const normalized: MaterialIndustrial = {
      nome: form.nome.trim(),
      espessuraPadrao: Math.max(0, Number(form.espessuraPadrao)),
      custo_m2: Math.max(0, Number(form.custo_m2)),
      cor: form.cor?.trim() || undefined,
      larguraChapa: Number(form.larguraChapa) || CHAPA_PADRAO_LARGURA,
      alturaChapa: Number(form.alturaChapa) || CHAPA_PADRAO_ALTURA,
      densidade: Number(form.densidade) || DENSIDADE_PADRAO,
    };
    setMaterials((prev) => [...prev, normalized]);
    handleAddMaterial();
  };

  const handleAddTool = () => {
    setToolForm({
      id: "",
      nome: "",
      kerf: 3.0,
      tipoMaquina: "Serra",
      diametro: undefined,
    });
  };

  const handleSaveTool = () => {
    if (!canSaveTool) return;
    const normalized: IndustrialTool = {
      id: `tool_${Date.now()}`,
      nome: toolForm.nome.trim(),
      kerf: Math.max(0, Number(toolForm.kerf)),
      tipoMaquina: toolForm.tipoMaquina.trim(),
      diametro: toolForm.diametro ? Number(toolForm.diametro) : undefined,
    };
    setTools((prev) => [...prev, normalized]);
    handleAddTool();
  };

  const handleRemoveTool = (id: string) => {
    setTools((prev) => prev.filter((t) => t.id !== id));
  };

  const labelStyle = { fontSize: 11, color: "var(--text-muted)", marginBottom: 2 };

  return (
    <div className="stack">
      {/* Materiais existentes */}
      <Panel title="Materiais existentes">
        <div className="list-vertical">
          {materials.map((material) => {
            const pesoChapa = calcularPesoChapa(material);
            return (
              <div
                key={`${material.nome}-${material.espessuraPadrao}`}
                className="card"
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="card-title">{material.nome}</div>
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
                <div className="muted-text" style={{ fontSize: 11, lineHeight: 1.6 }}>
                  <div>Espessura padrão: {material.espessuraPadrao} mm · Custo: {material.custo_m2} €/m²</div>
                  <div>
                    Chapa: {material.larguraChapa ?? CHAPA_PADRAO_LARGURA} × {material.alturaChapa ?? CHAPA_PADRAO_ALTURA} mm
                  </div>
                  <div>
                    Densidade: {material.densidade ?? DENSIDADE_PADRAO} kg/m³ · Peso da chapa: {pesoChapa !== null ? `${pesoChapa.toFixed(2)} kg` : "--"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Adicionar Material */}
      <Panel title="Adicionar Material">
        <div className="stack-tight">
          <button className="button" onClick={handleAddMaterial}>
            Novo Material
          </button>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={labelStyle}>Nome</div>
              <input
                className="input"
                placeholder="Nome"
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Cor (opcional)</div>
              <input
                className="input"
                placeholder="Cor"
                value={form.cor ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, cor: e.target.value }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Espessura padrão (mm)</div>
              <input
                className="input"
                type="number"
                placeholder="Espessura"
                value={form.espessuraPadrao}
                onChange={(e) => setForm((prev) => ({ ...prev, espessuraPadrao: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Custo por m²</div>
              <input
                className="input"
                type="number"
                placeholder="Custo €/m²"
                value={form.custo_m2}
                onChange={(e) => setForm((prev) => ({ ...prev, custo_m2: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Largura da chapa (mm)</div>
              <input
                className="input"
                type="number"
                placeholder="Largura chapa"
                value={form.larguraChapa ?? CHAPA_PADRAO_LARGURA}
                onChange={(e) => setForm((prev) => ({ ...prev, larguraChapa: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Altura da chapa (mm)</div>
              <input
                className="input"
                type="number"
                placeholder="Altura chapa"
                value={form.alturaChapa ?? CHAPA_PADRAO_ALTURA}
                onChange={(e) => setForm((prev) => ({ ...prev, alturaChapa: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Densidade (kg/m³)</div>
              <input
                className="input"
                type="number"
                placeholder="Densidade"
                value={form.densidade ?? DENSIDADE_PADRAO}
                onChange={(e) => setForm((prev) => ({ ...prev, densidade: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Peso da chapa (calculado)</div>
              <input
                className="input"
                type="text"
                readOnly
                value={(() => {
                  const peso = calcularPesoChapa(form);
                  return peso !== null ? `${peso.toFixed(2)} kg` : "--";
                })()}
                style={{ background: "rgba(255,255,255,0.02)", cursor: "default" }}
              />
            </div>
          </div>
          <button
            className="button"
            style={{
              background: canSaveMaterial ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
              border: canSaveMaterial ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
              cursor: canSaveMaterial ? "pointer" : "not-allowed",
              opacity: canSaveMaterial ? 1 : 0.6,
            }}
            onClick={handleSaveMaterial}
            disabled={!canSaveMaterial}
          >
            Guardar Material
          </button>
        </div>
      </Panel>

      {/* Ferramentas Industriais */}
      <Panel title="Ferramentas Industriais">
        <div className="list-vertical" style={{ marginBottom: 12 }}>
          {tools.length === 0 ? (
            <div className="muted-text" style={{ fontSize: 12 }}>Nenhuma ferramenta registada.</div>
          ) : (
            tools.map((tool) => (
              <div
                key={tool.id}
                className="card"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div className="card-title">{tool.nome}</div>
                  <div className="muted-text" style={{ fontSize: 11 }}>
                    Kerf: {tool.kerf} mm · Máquina: {tool.tipoMaquina}
                    {tool.diametro ? ` · Ø ${tool.diametro} mm` : ""}
                  </div>
                </div>
                <button
                  className="button button-ghost"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => handleRemoveTool(tool.id)}
                >
                  Remover
                </button>
              </div>
            ))
          )}
        </div>

        <div className="stack-tight">
          <button className="button" onClick={handleAddTool}>
            Nova Ferramenta
          </button>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={labelStyle}>Nome</div>
              <input
                className="input"
                placeholder="Nome da ferramenta"
                value={toolForm.nome}
                onChange={(e) => setToolForm((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Tipo de máquina</div>
              <input
                className="input"
                placeholder="Serra, CNC, etc."
                value={toolForm.tipoMaquina}
                onChange={(e) => setToolForm((prev) => ({ ...prev, tipoMaquina: e.target.value }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Kerf (espessura de corte, mm)</div>
              <input
                className="input"
                type="number"
                step="0.1"
                placeholder="Kerf"
                value={toolForm.kerf}
                onChange={(e) => setToolForm((prev) => ({ ...prev, kerf: Number(e.target.value) }))}
              />
            </div>
            <div>
              <div style={labelStyle}>Diâmetro (opcional, mm)</div>
              <input
                className="input"
                type="number"
                placeholder="Diâmetro"
                value={toolForm.diametro ?? ""}
                onChange={(e) =>
                  setToolForm((prev) => ({
                    ...prev,
                    diametro: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>
          <button
            className="button"
            style={{
              background: canSaveTool ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
              border: canSaveTool ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
              cursor: canSaveTool ? "pointer" : "not-allowed",
              opacity: canSaveTool ? 1 : 0.6,
            }}
            onClick={handleSaveTool}
            disabled={!canSaveTool}
          >
            Guardar Ferramenta
          </button>
        </div>
      </Panel>
    </div>
  );
}
