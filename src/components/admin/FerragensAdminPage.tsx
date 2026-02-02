/**
 * Admin → Ferragens
 * Catálogo completo de ferragens para fabricação de móveis.
 */

import { useState } from "react";
import Panel from "../ui/Panel";
import type { Ferragem } from "../../core/ferragens/ferragens";
import { useFerragens } from "../../hooks/useFerragens";

const CATEGORIAS: Ferragem["categoria"][] = [
  "parafuso",
  "cavilha",
  "dobradica",
  "corredica",
  "suporte",
  "prego",
  "acessorio",
];

export default function FerragensAdminPage() {
  const { ferragens, setFerragens } = useFerragens();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState<Ferragem>({
    id: "",
    nome: "",
    categoria: "parafuso",
    medidas: "",
    descricao: "",
  });

  const handleEdit = (ferragem: Ferragem) => {
    setEditingId(ferragem.id);
    setForm({ ...ferragem });
  };

  const handleSaveEdit = () => {
    if (!editingId || !form.nome.trim()) return;
    setFerragens((prev) =>
      prev.map((f) => (f.id === editingId ? { ...form, nome: form.nome.trim() } : f))
    );
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleAddNew = () => {
    if (!form.id.trim() || !form.nome.trim()) {
      alert("Preencha id e nome.");
      return;
    }
    if (ferragens.some((f) => f.id === form.id.trim())) {
      alert("Já existe uma ferragem com este id.");
      return;
    }
    const newFerragem: Ferragem = {
      id: form.id.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria,
      medidas: form.medidas?.trim() || undefined,
      descricao: form.descricao?.trim() || undefined,
    };
    setFerragens((prev) => [...prev, newFerragem]);
    setAddingNew(false);
    setForm({ id: "", nome: "", categoria: "parafuso", medidas: "", descricao: "" });
  };

  const handleRemove = (id: string) => {
    if (!confirm("Remover esta ferragem?")) return;
    setFerragens((prev) => prev.filter((f) => f.id !== id));
  };

  const labelStyle = { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {ferragens.length} ferragem(ns) registada(s)
        </span>
        <button
          type="button"
          className="button"
          onClick={() => setAddingNew(true)}
        >
          Adicionar Ferragem
        </button>
      </div>

      {addingNew && (
        <Panel title="Nova Ferragem">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={labelStyle}>ID</div>
                <input
                  className="input"
                  value={form.id}
                  onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                  placeholder="ex: parafuso_5x60"
                />
              </div>
              <div>
                <div style={labelStyle}>Nome</div>
                <input
                  className="input"
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome exibido"
                />
              </div>
              <div>
                <div style={labelStyle}>Categoria</div>
                <select
                  className="input"
                  value={form.categoria}
                  onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value as Ferragem["categoria"] }))}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Medidas (opcional)</div>
                <input
                  className="input"
                  value={form.medidas ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, medidas: e.target.value }))}
                  placeholder="ex: 4mm × 50mm"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={labelStyle}>Descrição (opcional)</div>
                <input
                  className="input"
                  value={form.descricao ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descrição da ferragem"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="button" onClick={handleAddNew}>
                Guardar ferragem
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setAddingNew(false);
                  setForm({ id: "", nome: "", categoria: "parafuso", medidas: "", descricao: "" });
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Ferragens Registadas">
        <div className="list-vertical" style={{ gap: 10 }}>
          {ferragens.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Nenhuma ferragem registada. Clique em "Adicionar Ferragem" para começar.
            </div>
          ) : (
            ferragens.map((ferragem) => {
              const isEditing = editingId === ferragem.id;
              return (
                <div
                  key={ferragem.id}
                  className="card"
                  style={{
                    padding: 14,
                    border: isEditing ? "1px solid var(--blue-light)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "var(--radius)",
                    background: isEditing ? "rgba(59, 130, 246, 0.08)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={labelStyle}>ID (não editável)</div>
                          <input className="input" value={ferragem.id} readOnly disabled style={{ opacity: 0.5 }} />
                        </div>
                        <div>
                          <div style={labelStyle}>Nome</div>
                          <input
                            className="input"
                            value={form.nome}
                            onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div style={labelStyle}>Categoria</div>
                          <select
                            className="input"
                            value={form.categoria}
                            onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value as Ferragem["categoria"] }))}
                          >
                            {CATEGORIAS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={labelStyle}>Medidas</div>
                          <input
                            className="input"
                            value={form.medidas ?? ""}
                            onChange={(e) => setForm((p) => ({ ...p, medidas: e.target.value }))}
                          />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={labelStyle}>Descrição</div>
                          <input
                            className="input"
                            value={form.descricao ?? ""}
                            onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="button" onClick={handleSaveEdit}>
                          Guardar
                        </button>
                        <button type="button" className="button button-ghost" onClick={handleCancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{ferragem.nome}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            ID: {ferragem.id} · Categoria: {ferragem.categoria}
                            {ferragem.medidas && ` · Medidas: ${ferragem.medidas}`}
                          </div>
                          {ferragem.descricao && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                              {ferragem.descricao}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="button button-ghost"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => handleEdit(ferragem)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button button-ghost"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => handleRemove(ferragem.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
