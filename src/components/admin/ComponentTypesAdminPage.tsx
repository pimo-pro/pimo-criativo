/**
 * Admin → Configurações → Component Types
 * Gestão da base de tipos de componentes (estrutura, porta, gaveta, acabamento).
 */

import { useMemo, useState } from "react";
import Panel from "../ui/Panel";
import type { ComponentType } from "../../core/components/componentTypes";
import { COMPONENT_TYPES_DEFAULT } from "../../core/components/componentTypes";
import type { FerragemIndustrial } from "../../core/industriais/ferragensIndustriais";
import { gerarFerragensIndustriais, agruparPorComponente } from "../../core/industriais/ferragensIndustriais";
import { useComponentTypes } from "../../hooks/useComponentTypes";
import { useFerragens } from "../../hooks/useFerragens";

const CATEGORIAS: ComponentType["categoria"][] = ["estrutura", "porta", "gaveta", "acabamento"];
const LADOS_OPCOES = ["direita", "esquerda", "topo", "fundo"];
const TIPOS_FURO: NonNullable<ComponentType["regras_de_furo"]>[number]["tipo"][] = [
  "cavilha", "parafuso", "dobradica", "corredica", "suporte_prateleira", "prego",
];
const TIPOS_CONEXAO: NonNullable<ComponentType["regras_de_montagem"]>[number]["tipo_conexao"][] = [
  "parafuso", "cavilha", "dobradiça", "cola",
];

export default function ComponentTypesAdminPage() {
  const { componentTypes, setComponentTypes } = useComponentTypes();
  const { ferragens } = useFerragens();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<ComponentType>({
    id: "",
    nome: "",
    categoria: "estrutura",
    possui_lados: false,
    lados: [],
    recebe_furos: false,
    aparece_no_cutlist: true,
    aparece_no_pdf: true,
  });
  const [saveFeedback, setSaveFeedback] = useState(false);

  const updateOne = (id: string, patch: Partial<ComponentType>) => {
    setComponentTypes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 1500);
  };

  const handleAddNew = () => {
    if (!newItem.id.trim() || !newItem.nome.trim()) {
      alert("Preencha id e nome.");
      return;
    }
    if (componentTypes.some((c) => c.id === newItem.id.trim())) {
      alert("Já existe um tipo com este id.");
      return;
    }
    const item: ComponentType = {
      ...newItem,
      id: newItem.id.trim(),
      nome: newItem.nome.trim(),
      lados: newItem.possui_lados ? [...(newItem.lados || [])] : [],
    };
    setComponentTypes((prev) => [...prev, item]);
    setAddingNew(false);
    setNewItem({
      id: "",
      nome: "",
      categoria: "estrutura",
      possui_lados: false,
      lados: [],
      recebe_furos: false,
      aparece_no_cutlist: true,
      aparece_no_pdf: true,
    });
  };

  const handleResetDefaults = () => {
    if (!confirm("Repor todos os Component Types para os valores padrão? As alterações atuais serão perdidas.")) return;
    setComponentTypes(JSON.parse(JSON.stringify(COMPONENT_TYPES_DEFAULT)));
  };

  const labelStyle = { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 };

  const ferragensIndustriais = useMemo(
    () => gerarFerragensIndustriais(componentTypes, ferragens),
    [componentTypes, ferragens]
  );
  const porComponente = useMemo(
    () => agruparPorComponente(ferragensIndustriais),
    [ferragensIndustriais]
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {componentTypes.length} tipo(s) de componente
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="button"
            onClick={() => setAddingNew(true)}
          >
            Adicionar novo Component Type
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={handleResetDefaults}
          >
            Repor padrão
          </button>
          {saveFeedback && (
            <span style={{ fontSize: 12, color: "var(--blue-light)" }}>Alterações guardadas</span>
          )}
        </div>
      </div>

      <Panel title="Ferragens Industriais (preview)">
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
          Lista gerada automaticamente a partir de ferragens_default e regras_de_furo. Somente leitura.
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {ferragensIndustriais.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Nenhuma ferragem industrial gerada.
            </div>
          ) : (
            <div className="list-vertical" style={{ gap: 8 }}>
              {(Array.from(porComponente.entries()) as [string, FerragemIndustrial[]][]).map(([componenteId, itens]) => (
                <div
                  key={componenteId}
                  style={{
                    padding: 10,
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "var(--radius)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{componenteId}</div>
                  {itens.map((item: FerragemIndustrial, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 11,
                        padding: "4px 0",
                        borderBottom: idx < itens.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", minWidth: 100 }}>{item.ferragem_id}</span>
                      <span style={{ minWidth: 36 }}>×{item.quantidade}</span>
                      {item.aplicar_em.length > 0 && (
                        <span style={{ color: "var(--text-muted)" }}>
                          aplicar_em: {item.aplicar_em.join(", ")}
                        </span>
                      )}
                      {item.tipo_furo && (
                        <span style={{ color: "var(--blue-light)" }}>Ø{item.tipo_furo}</span>
                      )}
                      {item.profundidade != null && (
                        <span style={{ color: "var(--text-muted)" }}>prof. {item.profundidade}mm</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {addingNew && (
        <Panel title="Novo Component Type">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={labelStyle}>ID</div>
                <input
                  className="input"
                  value={newItem.id}
                  onChange={(e) => setNewItem((p) => ({ ...p, id: e.target.value }))}
                  placeholder="ex: novo_tipo"
                />
              </div>
              <div>
                <div style={labelStyle}>Nome</div>
                <input
                  className="input"
                  value={newItem.nome}
                  onChange={(e) => setNewItem((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome exibido"
                />
              </div>
              <div>
                <div style={labelStyle}>Categoria</div>
                <select
                  className="input"
                  value={newItem.categoria}
                  onChange={(e) => setNewItem((p) => ({ ...p, categoria: e.target.value as ComponentType["categoria"] }))}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={newItem.possui_lados}
                    onChange={(e) =>
                      setNewItem((p) => ({
                        ...p,
                        possui_lados: e.target.checked,
                        lados: e.target.checked ? LADOS_OPCOES : [],
                      }))
                    }
                  />
                  {" "}Possui lados
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={newItem.recebe_furos}
                    onChange={(e) => setNewItem((p) => ({ ...p, recebe_furos: e.target.checked }))}
                  />
                  {" "}Recebe furos
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={newItem.aparece_no_cutlist}
                    onChange={(e) => setNewItem((p) => ({ ...p, aparece_no_cutlist: e.target.checked }))}
                  />
                  {" "}Aparece no cutlist
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={newItem.aparece_no_pdf}
                    onChange={(e) => setNewItem((p) => ({ ...p, aparece_no_pdf: e.target.checked }))}
                  />
                  {" "}Aparece no PDF
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="button" onClick={handleAddNew}>
                Guardar novo tipo
              </button>
              <button type="button" className="button button-ghost" onClick={() => setAddingNew(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Component Types">
        <div className="list-vertical" style={{ gap: 12 }}>
          {componentTypes.map((ct) => {
            const isExpanded = expandedId === ct.id;
            return (
              <div
                key={ct.id}
                className="card"
                style={{
                  padding: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "var(--radius)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : ct.id)}
                >
                  <div>
                    <span style={{ fontWeight: 600, marginRight: 8 }}>{ct.id}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{ct.nome}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    >
                      {ct.categoria}
                    </span>
                  </div>
                  <span style={{ fontSize: 12 }}>{isExpanded ? "▼" : "▶"}</span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={labelStyle}>Nome</div>
                        <input
                          className="input"
                          value={ct.nome}
                          onChange={(e) => updateOne(ct.id, { nome: e.target.value })}
                        />
                      </div>
                      <div>
                        <div style={labelStyle}>Categoria</div>
                        <select
                          className="input"
                          value={ct.categoria}
                          onChange={(e) => updateOne(ct.id, { categoria: e.target.value as ComponentType["categoria"] })}
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <label style={{ fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={ct.possui_lados}
                            onChange={(e) =>
                              updateOne(ct.id, {
                                possui_lados: e.target.checked,
                                lados: e.target.checked ? [...(ct.lados || []), ...LADOS_OPCOES.filter((l) => !(ct.lados || []).includes(l))].slice(0, 4) : [],
                              })
                            }
                          />
                          {" "}Possui lados
                        </label>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <label style={{ fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={ct.recebe_furos}
                            onChange={(e) => updateOne(ct.id, { recebe_furos: e.target.checked })}
                          />
                          {" "}Recebe furos
                        </label>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <label style={{ fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={ct.aparece_no_cutlist}
                            onChange={(e) => updateOne(ct.id, { aparece_no_cutlist: e.target.checked })}
                          />
                          {" "}Aparece no cutlist
                        </label>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <label style={{ fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={ct.aparece_no_pdf}
                            onChange={(e) => updateOne(ct.id, { aparece_no_pdf: e.target.checked })}
                          />
                          {" "}Aparece no PDF
                        </label>
                      </div>
                    </div>

                    {ct.possui_lados && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={labelStyle}>Lados</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {LADOS_OPCOES.map((lado) => {
                            const checked = (ct.lados || []).includes(lado);
                            return (
                              <label key={lado} style={{ fontSize: 12 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? (ct.lados || []).filter((x) => x !== lado)
                                      : [...(ct.lados || []), lado];
                                    updateOne(ct.id, { lados: next });
                                  }}
                                />
                                {" "}{lado}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>Ferragens default</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(ct.ferragens_default || []).map((f, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <select
                              className="input"
                              style={{ width: 160 }}
                              value={f.ferragem_id}
                              onChange={(e) => {
                                const next = [...(ct.ferragens_default || [])];
                                next[i] = { ...next[i], ferragem_id: e.target.value };
                                updateOne(ct.id, { ferragens_default: next });
                              }}
                            >
                              <option value="">Selecionar...</option>
                              {ferragens.map((fer) => (
                                <option key={fer.id} value={fer.id}>
                                  {fer.nome}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input"
                              type="number"
                              style={{ width: 60 }}
                              placeholder="qtd/lado"
                              value={f.quantidade_por_lado ?? ""}
                              onChange={(e) => {
                                const next = [...(ct.ferragens_default || [])];
                                next[i] = { ...next[i], quantidade_por_lado: e.target.value ? Number(e.target.value) : undefined };
                                updateOne(ct.id, { ferragens_default: next });
                              }}
                            />
                            <input
                              className="input"
                              type="number"
                              style={{ width: 60 }}
                              placeholder="qtd fixa"
                              value={f.quantidade_fixa ?? ""}
                              onChange={(e) => {
                                const next = [...(ct.ferragens_default || [])];
                                next[i] = { ...next[i], quantidade_fixa: e.target.value ? Number(e.target.value) : undefined };
                                updateOne(ct.id, { ferragens_default: next });
                              }}
                            />
                            <button
                              type="button"
                              className="button button-ghost"
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              onClick={() =>
                                updateOne(
                                  ct.id,
                                  { ferragens_default: (ct.ferragens_default || []).filter((_, j) => j !== i) }
                                )
                              }
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="button button-ghost"
                          style={{ fontSize: 11, alignSelf: "flex-start" }}
                          onClick={() =>
                            updateOne(ct.id, {
                              ferragens_default: [...(ct.ferragens_default || []), { ferragem_id: "", aplicar_em: [] }],
                            })
                          }
                        >
                          + Ferragem
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>Regras de furo</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(ct.regras_de_furo || []).map((r, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 10,
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: "var(--radius)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <select
                                className="input"
                                style={{ width: 140 }}
                                value={r.tipo}
                                onChange={(e) => {
                                  const next = [...(ct.regras_de_furo || [])];
                                  next[i] = { ...next[i], tipo: e.target.value as (typeof next)[0]["tipo"], aplicar_em: next[i].aplicar_em };
                                  updateOne(ct.id, { regras_de_furo: next });
                                }}
                              >
                                {TIPOS_FURO.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ø</span>
                                <input
                                  className="input"
                                  type="number"
                                  style={{ width: 56 }}
                                  placeholder="mm"
                                  value={r.diametro ?? ""}
                                  onChange={(e) => {
                                    const next = [...(ct.regras_de_furo || [])];
                                    next[i] = { ...next[i], diametro: e.target.value ? Number(e.target.value) : undefined };
                                    updateOne(ct.id, { regras_de_furo: next });
                                  }}
                                />
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Prof.</span>
                                <input
                                  className="input"
                                  type="number"
                                  style={{ width: 56 }}
                                  placeholder="mm"
                                  value={r.profundidade ?? ""}
                                  onChange={(e) => {
                                    const next = [...(ct.regras_de_furo || [])];
                                    next[i] = { ...next[i], profundidade: e.target.value ? Number(e.target.value) : undefined };
                                    updateOne(ct.id, { regras_de_furo: next });
                                  }}
                                />
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>qtd/lado</span>
                                <input
                                  className="input"
                                  type="number"
                                  style={{ width: 56 }}
                                  placeholder="—"
                                  value={r.quantidade_por_lado ?? ""}
                                  onChange={(e) => {
                                    const next = [...(ct.regras_de_furo || [])];
                                    next[i] = { ...next[i], quantidade_por_lado: e.target.value ? Number(e.target.value) : undefined };
                                    updateOne(ct.id, { regras_de_furo: next });
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                className="button button-ghost"
                                style={{ fontSize: 11, padding: "4px 8px" }}
                                onClick={() =>
                                  updateOne(ct.id, {
                                    regras_de_furo: (ct.regras_de_furo || []).filter((_, j) => j !== i),
                                  })
                                }
                              >
                                Remover
                              </button>
                            </div>
                            <div>
                              <div style={{ ...labelStyle, marginBottom: 4 }}>Aplicar em</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {LADOS_OPCOES.map((lado) => {
                                  const checked = (r.aplicar_em || []).includes(lado);
                                  return (
                                    <label key={lado} style={{ fontSize: 12 }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          const next = [...(ct.regras_de_furo || [])];
                                          const currentApply = next[i].aplicar_em || [];
                                          next[i] = {
                                            ...next[i],
                                            aplicar_em: checked
                                              ? currentApply.filter((x) => x !== lado)
                                              : [...currentApply, lado],
                                          };
                                          updateOne(ct.id, { regras_de_furo: next });
                                        }}
                                      />
                                      {" "}{lado}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="button button-ghost"
                          style={{ fontSize: 11, alignSelf: "flex-start" }}
                          onClick={() =>
                            updateOne(ct.id, {
                              regras_de_furo: [
                                ...(ct.regras_de_furo || []),
                                { tipo: "cavilha", diametro: 8, aplicar_em: [] },
                              ],
                            })
                          }
                        >
                          + Regra furo
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>Regras de montagem</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(ct.regras_de_montagem || []).map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              className="input"
                              style={{ width: 120 }}
                              placeholder="conecta_com"
                              value={r.conecta_com}
                              onChange={(e) => {
                                const next = [...(ct.regras_de_montagem || [])];
                                next[i] = { ...next[i], conecta_com: e.target.value };
                                updateOne(ct.id, { regras_de_montagem: next });
                              }}
                            />
                            <select
                              className="input"
                              style={{ width: 120 }}
                              value={r.tipo_conexao}
                              onChange={(e) => {
                                const next = [...(ct.regras_de_montagem || [])];
                                next[i] = { ...next[i], tipo_conexao: e.target.value as (typeof next)[0]["tipo_conexao"] };
                                updateOne(ct.id, { regras_de_montagem: next });
                              }}
                            >
                              {TIPOS_CONEXAO.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="button button-ghost"
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              onClick={() =>
                                updateOne(ct.id, {
                                  regras_de_montagem: (ct.regras_de_montagem || []).filter((_, j) => j !== i),
                                })
                              }
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="button button-ghost"
                          style={{ fontSize: 11, alignSelf: "flex-start" }}
                          onClick={() =>
                            updateOne(ct.id, {
                              regras_de_montagem: [...(ct.regras_de_montagem || []), { conecta_com: "", tipo_conexao: "parafuso" }],
                            })
                          }
                        >
                          + Regra montagem
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
