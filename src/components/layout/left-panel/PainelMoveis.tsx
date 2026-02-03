/**
 * Painel Móveis = Catálogo CAD (biblioteca).
 * Sempre renderizado dentro do LeftPanel (wrapper left-panel-content).
 * Sem position absolute / center / z-index alto.
 */

import { useEffect, useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import { useCadModels } from "../../../hooks/useCadModels";
import { CATEGORIAS_CAD, getCategoriaNome } from "../../../core/cad/categories";
import type { CadModel, CadModelDimensions } from "../../../core/cad/cadModels";
import type { ProjectState } from "../../../context/projectTypes";

/** Obtém dimensões (mm) de um modelo CAD: primeiro cadModel.dimensions, depois bbox das peças extraídas. */
function getModelDimensions(
  model: CadModel,
  project: ProjectState
): CadModelDimensions | null {
  if (model.dimensions && [model.dimensions.largura, model.dimensions.altura, model.dimensions.profundidade].every(Number.isFinite)) {
    return model.dimensions;
  }
  const extracted = project.extractedPartsByBoxId ?? {};
  for (const box of project.workspaceBoxes ?? []) {
    const byInstance = extracted[box.id];
    if (!byInstance) continue;
    for (const instance of box.models ?? []) {
      if (instance.modelId !== model.id) continue;
      const parts = byInstance[instance.id];
      if (!Array.isArray(parts) || parts.length === 0) continue;
      const largura = Math.max(...parts.map((p) => p.dimensoes.largura));
      const altura = Math.max(...parts.map((p) => p.dimensoes.altura));
      const profundidade = Math.max(...parts.map((p) => p.dimensoes.profundidade));
      return { largura, altura, profundidade };
    }
  }
  return null;
}

function formatFileStatus(arquivo: string): string {
  if (!arquivo) return "Ausente";
  if (arquivo.startsWith("data:model/gltf-binary") || arquivo.startsWith("data:application/octet-stream")) return "Carregado (base64)";
  if (arquivo.startsWith("data:")) return "Carregado";
  if (arquivo.startsWith("http")) return "URL registada";
  return "Ficheiro registado";
}

export default function PainelMoveis() {
  const { project, actions } = useProject();
  const { models: cadModels, reload: reloadCadModels } = useCadModels();
  const [termoBusca, setTermoBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<
    "todos" | "cozinha" | "roupeiro" | "banheiro" | "quarto-infantil"
  >("todos");
  const [modeloSelecionado, setModeloSelecionado] = useState<string>("");

  useEffect(() => {
    reloadCadModels();
  }, [reloadCadModels]);

  const filtrarPorCategoriaBase = (
    modelCategoria: string,
    categoriaBase: typeof categoriaSelecionada
  ) => {
    if (categoriaBase === "todos") return true;
    const cat = modelCategoria.toLowerCase();
    if (categoriaBase === "cozinha") return cat.includes("cozinha");
    if (categoriaBase === "roupeiro") return cat.includes("roupeiro") || cat.includes("guarda-roupa");
    if (categoriaBase === "banheiro") return cat.includes("banheiro") || cat.includes("wc");
    if (categoriaBase === "quarto-infantil")
      return cat.includes("quarto infantil") || cat.includes("quarto-infantil") || cat.includes("quarto");
    return true;
  };

  const modelosPorCategoria = useMemo(
    () =>
      cadModels.filter((m) =>
        filtrarPorCategoriaBase(m.categoria ?? "", categoriaSelecionada)
      ),
    [cadModels, categoriaSelecionada]
  );

  const modelosFiltrados = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    let base = modelosPorCategoria;
    if (termo) {
      base = base.filter((m) => m.nome.toLowerCase().includes(termo));
    }
    if (modeloSelecionado) {
      base = base.filter((m) => m.id === modeloSelecionado);
    }
    return base;
  }, [modelosPorCategoria, termoBusca, modeloSelecionado]);

  const handleAdicionarModelo = (modelId: string) => {
    actions.addCadModelAsNewBox(modelId);
  };

  return (
    <div className="panel-content panel-content--side">
      <div className="section-title">Móveis</div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Catálogo de modelos CAD. Cada modelo é adicionado como nova caixa (módulo completo).
      </p>

      <Panel title="Catálogo CAD" description="Modelos disponíveis (incluindo uploads do Admin).">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Campo de busca */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              Buscar modelo
            </label>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Pesquisar por nome…"
              className="input input-sm"
            />
          </div>

          {/* Dropdown de categorias base */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              Categoria
            </label>
            <select
              value={categoriaSelecionada}
              onChange={(e) => {
                const value = e.target.value as typeof categoriaSelecionada;
                setCategoriaSelecionada(value);
                setModeloSelecionado("");
              }}
              className="select"
              style={{ width: "100%" }}
            >
              <option value="todos">Todos</option>
              <option value="cozinha">Cozinha</option>
              <option value="roupeiro">Roupeiro</option>
              <option value="banheiro">Banheiro</option>
              <option value="quarto-infantil">Quarto Infantil</option>
            </select>
          </div>

          {/* Dropdown de modelos dependente da categoria */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              Modelo
            </label>
            <select
              value={modeloSelecionado}
              onChange={(e) => setModeloSelecionado(e.target.value)}
              className="select"
              style={{ width: "100%" }}
            >
              <option value="">Todos os modelos da categoria</option>
              {modelosPorCategoria.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Lista de chips de modelos */}
          {modelosFiltrados.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Nenhum modelo no catálogo. Registe modelos em Admin → Modelos CAD.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 4,
              }}
            >
              {modelosFiltrados.map((model) => {
                const dims = getModelDimensions(model, project);
                const isSelectedChip = modeloSelecionado === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleAdicionarModelo(model.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      padding: "6px 8px",
                      minWidth: 0,
                      maxWidth: "100%",
                      borderRadius: 999,
                      border: isSelectedChip
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",
                      backgroundColor: isSelectedChip
                        ? "rgba(59, 130, 246, 0.12)"
                        : "var(--surface)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: "var(--bg)",
                          border: "1px solid var(--border-subtle)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          maxWidth: 160,
                        }}
                      >
                        {model.nome}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        maxWidth: 200,
                      }}
                    >
                      {getCategoriaNome(model.categoria)}
                      {dims
                        ? ` · ${dims.largura}×${dims.altura}×${dims.profundidade} mm`
                        : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => reloadCadModels()}
          className="panel-button"
          style={{ marginTop: 8 }}
        >
          Recarregar catálogo
        </button>
      </Panel>
    </div>
  );
}
