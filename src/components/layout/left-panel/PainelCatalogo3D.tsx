/**
 * Painel Catálogo 3D — Biblioteca de módulos padrão.
 * Categorias, grid de itens e botão Adicionar.
 */

import { useMemo, useState } from "react";
import { useProject } from "../../../context/useProject";
import { CATALOG_ITEMS } from "../../../catalog/catalogIndex";
import Panel from "../../ui/Panel";

export default function PainelCatalogo3D() {
  const { actions } = useProject();
  const [termoBusca3D, setTermoBusca3D] = useState("");
  const [categoriaSelecionada3D, setCategoriaSelecionada3D] = useState<
    "todos" | "cozinha" | "roupeiro" | "banheiro" | "quarto-infantil"
  >("todos");
  const [modeloSelecionado3D, setModeloSelecionado3D] = useState<string>("");

  // Filtragem por categoria
  const itemsPorCategoria = useMemo(
    () =>
      categoriaSelecionada3D === "todos"
        ? CATALOG_ITEMS
        : CATALOG_ITEMS.filter((item) => item.categoria === categoriaSelecionada3D),
    [categoriaSelecionada3D]
  );

  // Filtragem combinada: categoria + busca + modelo selecionado
  const itemsFiltrados = useMemo(() => {
    const termo = termoBusca3D.trim().toLowerCase();
    let base = itemsPorCategoria;
    if (termo) {
      base = base.filter((item) => item.nome.toLowerCase().includes(termo));
    }
    if (modeloSelecionado3D) {
      base = base.filter((item) => item.id === modeloSelecionado3D);
    }
    return base;
  }, [itemsPorCategoria, termoBusca3D, modeloSelecionado3D]);

  const handleAddItem = (itemId: string) => {
    actions.addWorkspaceBoxFromCatalog(itemId);
  };

  return (
    <div className="left-panel-content">
      <div className="left-panel-scroll">
        <aside className="panel-content panel-content--side">
          <div className="section-title">Catálogo 3D</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Adicione módulos padrão ao seu projeto.
          </p>

          {/* Campo de busca */}
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
              value={termoBusca3D}
              onChange={(e) => setTermoBusca3D(e.target.value)}
              placeholder="Pesquisar por nome…"
              className="input input-sm"
            />
          </div>

          {/* Dropdown de categorias */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Categoria
            </label>
            <select
              value={categoriaSelecionada3D}
              onChange={(e) => {
                const value = e.target.value as typeof categoriaSelecionada3D;
                setCategoriaSelecionada3D(value);
                setModeloSelecionado3D("");
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Modelo
            </label>
            <select
              value={modeloSelecionado3D}
              onChange={(e) => setModeloSelecionado3D(e.target.value)}
              className="select"
              style={{ width: "100%" }}
            >
              <option value="">Todos os modelos da categoria</option>
              {itemsPorCategoria.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Lista de chips (versão premium) */}
          {itemsFiltrados.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {itemsFiltrados.map((item) => {
                const isSelectedChip = modeloSelecionado3D === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItem(item.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      padding: "8px 10px",
                      minWidth: 0,
                      maxWidth: "100%",
                      borderRadius: 8,
                      border: isSelectedChip
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",
                      backgroundColor: isSelectedChip
                        ? "rgba(59, 130, 246, 0.12)"
                        : "var(--surface)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelectedChip) {
                        e.currentTarget.style.backgroundColor = "var(--bg)";
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelectedChip) {
                        e.currentTarget.style.backgroundColor = "var(--surface)";
                        e.currentTarget.style.borderColor = "var(--border)";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {/* Espaço reservado para thumbnail futura */}
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: "var(--bg)",
                          border: "1px solid var(--border-subtle)",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      />
                      {/* Nome do modelo (negrito, truncado) */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          maxWidth: 180,
                        }}
                      >
                        {item.nome}
                      </span>
                    </div>
                    {/* Categoria e dimensões (texto secundário) */}
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        maxWidth: 220,
                        lineHeight: 1.4,
                      }}
                    >
                      {categoriaSelecionada3D === "todos"
                        ? item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1)
                        : categoriaSelecionada3D === "quarto-infantil"
                        ? "Quarto Infantil"
                        : categoriaSelecionada3D.charAt(0).toUpperCase() + categoriaSelecionada3D.slice(1)}
                      {" · "}
                      {item.dimensoesDefault.largura_mm}×
                      {item.dimensoesDefault.altura_mm}×
                      {item.dimensoesDefault.profundidade_mm} mm
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <Panel
            title="Módulos"
            description={`${itemsFiltrados.length} módulo(s) no catálogo`}
          >
            {itemsFiltrados.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhum módulo encontrado com os filtros selecionados.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 12,
                }}
              >
                {itemsFiltrados.map((item) => (
                  <div
                    key={item.id}
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
                        borderRadius: 6,
                        border: "1px solid var(--border-subtle)",
                        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.12)",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        color: "var(--text-muted)",
                      }}
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
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
                      ) : (
                        "◫"
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-main)" }}>
                      {item.nome}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.dimensoesDefault.largura_mm}×
                      {item.dimensoesDefault.altura_mm}×
                      {item.dimensoesDefault.profundidade_mm} mm
                    </div>
                    {item.descricao && (
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--text-muted)",
                          opacity: 0.8,
                        }}
                      >
                        {item.descricao}
                      </div>
                    )}
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ fontSize: 10, padding: "4px 8px", marginTop: 4 }}
                      onClick={() => handleAddItem(item.id)}
                    >
                      Adicionar
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
