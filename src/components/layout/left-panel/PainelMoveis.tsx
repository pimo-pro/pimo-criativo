/**
 * Painel Móveis = Catálogo CAD (biblioteca).
 * Sempre renderizado dentro do LeftPanel (wrapper left-panel-content).
 * Sem position absolute / center / z-index alto.
 */

import { useEffect, useState } from "react";
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
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  useEffect(() => {
    reloadCadModels();
  }, [reloadCadModels]);

  const cadModelsFiltrados = categoriaFiltro
    ? cadModels.filter(
        (m) =>
          m.categoria === categoriaFiltro ||
          m.categoria === getCategoriaNome(categoriaFiltro)
      )
    : cadModels;

  return (
    <div className="panel-content panel-content--side">
      <div className="section-title">Móveis</div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Catálogo de modelos CAD. Cada modelo é adicionado como nova caixa (módulo completo).
      </p>

      <Panel title="Catálogo CAD" description="Modelos disponíveis (incluindo uploads do Admin).">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Filtrar por categoria
            </label>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="select"
              style={{ marginTop: 4, width: "100%" }}
            >
              <option value="">Todas</option>
              {CATEGORIAS_CAD.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {cadModelsFiltrados.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Nenhum modelo no catálogo. Registe modelos em Admin → Modelos CAD.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {cadModelsFiltrados.map((model) => {
                const dims = getModelDimensions(model, project);
                return (
                  <li
                    key={model.id}
                    style={{
                      padding: 10,
                      background: "var(--surface)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {model.nome}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      {model.categoria}
                      {model.descricao ? ` · ${model.descricao}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      Dimensões (L × A × P):{" "}
                      {dims
                        ? `${dims.largura} × ${dims.altura} × ${dims.profundidade} mm`
                        : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                      Ficheiro: {formatFileStatus(model.arquivo ?? "")}
                    </div>
                    <button
                      type="button"
                      className="panel-button"
                      onClick={() => actions.addCadModelAsNewBox(model.id)}
                      style={{ width: "100%", fontSize: 12 }}
                    >
                      Adicionar como nova caixa
                    </button>
                  </li>
                );
              })}
            </ul>
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
