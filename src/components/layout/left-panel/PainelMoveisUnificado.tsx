import { useEffect, useMemo, useState, useCallback } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import { useCadModels } from "../../../hooks/useCadModels";
import {
  buildUnifiedMoveis,
  getCategoriasMoveis,
  type UnifiedModelItem,
} from "../../../data/moveisUnificados";
// keep this file UI-only; do not change selectedTool here

const PAGE_SIZE = 10;

const getTipoLabel = (tipo: UnifiedModelItem["tipo"]) => {
  if (tipo === "pronto") return "Pronto";
  if (tipo === "3d") return "3D";
  return "CAD";
};

export default function PainelMoveisUnificado() {
  const { actions } = useProject();
  const { models: cadModels, reload: reloadCadModels } = useCadModels();
  const [termoBusca, setTermoBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("todos");
  const [itensVisiveis, setItensVisiveis] = useState(PAGE_SIZE);

  useEffect(() => {
    reloadCadModels();
  }, [reloadCadModels]);

  const categorias = useMemo(() => getCategoriasMoveis(), []);
  const itensUnificados = useMemo(() => buildUnifiedMoveis(cadModels), [cadModels]);

  const itensFiltrados = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    return itensUnificados.filter((item) => {
      if (categoriaSelecionada !== "todos" && item.categoriaId !== categoriaSelecionada) {
        return false;
      }
      if (!termo) return true;
      return (
        item.nome.toLowerCase().includes(termo) ||
        (item.descricao ?? "").toLowerCase().includes(termo)
      );
    });
  }, [categoriaSelecionada, itensUnificados, termoBusca]);

  useEffect(() => {
    setItensVisiveis(PAGE_SIZE);
  }, [categoriaSelecionada, termoBusca]);

  const handleAddItem = useCallback((item: UnifiedModelItem) => {
    if (item.tipo === "pronto") {
      actions.addTemplateAsNewBox(item.sourceId);
      return;
    }
    if (item.tipo === "3d") {
      actions.addWorkspaceBoxFromCatalog(item.sourceId);
      return;
    }
    actions.addCadModelAsNewBox(item.sourceId);
  }, [actions]);

  const itensPaginados = itensFiltrados.slice(0, itensVisiveis);
  const podeCarregarMais = itensFiltrados.length > itensVisiveis;

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Móveis</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 500,
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

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Categoria
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categorias.map((cat) => {
                const isSelected = categoriaSelecionada === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoriaSelecionada(cat.id)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 999,
                      border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      background: isSelected ? "rgba(59,130,246,0.2)" : "var(--surface)",
                      color: "var(--text-main)",
                      cursor: "pointer",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Panel title="Catálogo" description={`${itensFiltrados.length} item(ns) disponíveis`}>
            {itensFiltrados.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhum item encontrado com os filtros selecionados.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {itensPaginados.map((item) => {
                    const dims = item.dimensoes;
                    const info =
                      dims && [dims.largura_mm, dims.altura_mm, dims.profundidade_mm].every(Number.isFinite)
                        ? `${dims.largura_mm}×${dims.altura_mm}×${dims.profundidade_mm} mm`
                        : `${item.categoria} · ${getTipoLabel(item.tipo)}`;
                    const hasImage = Boolean(item.thumbnailUrl);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                      >
                        {hasImage && (
                          <div
                            style={{
                              width: 68,
                              height: 68,
                              background: "var(--bg)",
                              borderRadius: 8,
                              border: "1px solid var(--border-subtle)",
                              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={item.thumbnailUrl ?? ""}
                              alt={item.nome}
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-main)",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            }}
                          >
                            {item.nome}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              lineHeight: 1.3,
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            }}
                          >
                            {info}
                          </div>
                          {item.descricao && (
                            <div
                              style={{
                                fontSize: 9,
                                color: "var(--text-muted)",
                                opacity: 0.8,
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                              }}
                            >
                              {item.descricao}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="button button-ghost"
                          style={{ fontSize: 10, padding: "4px 8px" }}
                          onClick={() => handleAddItem(item)}
                        >
                          Adicionar
                        </button>
                      </div>
                    );
                  })}
                </div>
                {podeCarregarMais && (
                  <button
                    type="button"
                    className="button button-ghost"
                    style={{ width: "100%", marginTop: 12 }}
                    onClick={() => setItensVisiveis((prev) => prev + PAGE_SIZE)}
                  >
                    Carregar mais
                  </button>
                )}
              </>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
