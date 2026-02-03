/**
 * Painel Modelos Prontos — Biblioteca de Design Templates.
 * Categorias, grid de modelos e botão Carregar Modelo.
 */

import { useState } from "react";
import { useProject } from "../../../context/useProject";
import {
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  getTemplateById,
} from "../../../templates/templatesIndex";
import type { TemplateCategory } from "../../../templates/types";
import Panel from "../../ui/Panel";

export default function PainelModelosProntos() {
  const { actions } = useProject();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("Cozinha");

  const templates = getTemplatesByCategory(selectedCategory);

  const handleLoadTemplate = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) return;
    actions.loadProjectFromTemplate(templateId);
  };

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Modelos Prontos</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Carregue um modelo para substituir o projeto atual.
          </p>

          <Panel title="Categorias" description="Selecione uma categoria">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    background: selectedCategory === cat ? "rgba(59, 130, 246, 0.25)" : "var(--surface)",
                    border: `1px solid ${selectedCategory === cat ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 6,
                    color: "var(--text-main)",
                    cursor: "pointer",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Modelos" description={`${templates.length} modelo(s) em ${selectedCategory}`}>
            {templates.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhum modelo nesta categoria.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: 12,
                }}
              >
                {templates.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 6,
                      padding: 8,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4/3",
                        background: "var(--bg)",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        color: "var(--text-muted)",
                      }}
                    >
                      {t.thumbnail ? (
                        <img
                          src={t.thumbnail}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }}
                        />
                      ) : (
                        "◫"
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-main)" }}>
                      {t.nome}
                    </div>
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ fontSize: 10, padding: "4px 8px" }}
                      onClick={() => handleLoadTemplate(t.id)}
                    >
                      Carregar Modelo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
