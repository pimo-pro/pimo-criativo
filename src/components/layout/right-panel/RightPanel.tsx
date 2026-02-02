import { useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";

const cardStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  marginBottom: 8,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-main)",
  marginBottom: 6,
};

const cardDimsStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginBottom: 8,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

export default function RightPanel() {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const selectedId = project.selectedWorkspaceBoxId;
  const boxes = project.workspaceBoxes;
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className="panel-content panel-content--side right-panel-scrollable"
      style={{
        maxHeight: 300,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>Ações</div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="button button-ghost"
          style={{ padding: "4px 8px", fontSize: 12 }}
          title={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      <div
        className="stack-tight"
        style={{
          flex: "1 1 0",
          overflowY: expanded ? "auto" : "hidden",
          minHeight: 0,
        }}
      >
        {/* Gerar Design 3D */}
        <button
          onClick={() => actions.gerarDesign()}
          disabled={project.estaCarregando}
          className="button button-primary"
          style={{
            background: project.estaCarregando
              ? "rgba(59, 130, 246, 0.5)"
              : "var(--blue-light)",
            cursor: project.estaCarregando ? "not-allowed" : "pointer",
          }}
        >
          {project.estaCarregando ? "A Calcular..." : "Gerar Design 3D"}
        </button>

        {/* Adicionar caixote: cria um novo card na lista; o Viewer recebe via sync */}
        <button
          onClick={() => actions.addWorkspaceBox()}
          className="button button-ghost"
        >
          Adicionar caixote
        </button>

        {/* Lista de Caixas */}
        <div className="section-title" style={{ marginTop: 16, marginBottom: 8 }}>
          Lista de Caixas
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {boxes.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
              Nenhuma caixa. Clique em &quot;Adicionar caixote&quot; ou &quot;Gerar Design 3D&quot;.
            </div>
          ) : (
            boxes.map((box) => {
              const d = box.dimensoes;
              const isSelected = box.id === selectedId;
              return (
                <div
                  key={box.id}
                  style={{
                    ...cardStyle,
                    borderColor: isSelected ? "var(--blue-light)" : "rgba(255,255,255,0.08)",
                    background: isSelected ? "rgba(59, 130, 246, 0.12)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={cardTitleStyle}>{box.nome}</div>
                  <div style={cardDimsStyle}>
                    {d?.largura != null && d?.altura != null && d?.profundidade != null
                      ? `${d.largura} × ${d.altura} × ${d.profundidade} mm`
                      : "—"}
                  </div>
                  <div style={rowStyle}>
                    <button
                      type="button"
                      onClick={() => {
                        actions.selectBox(box.id);
                        viewerApi?.highlightBox?.(box.id);
                      }}
                      className="button button-ghost"
                      style={{
                        flex: 1,
                        fontSize: 11,
                        padding: "4px 8px",
                      }}
                    >
                      Selecionar
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.removeWorkspaceBoxById(box.id)}
                      className="button button-ghost"
                      style={{
                        flex: 1,
                        fontSize: 11,
                        padding: "4px 8px",
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resultados Atuais */}
        <div className="section-title" style={{ marginTop: 20, marginBottom: 8 }}>
          Resultados Atuais
        </div>
        <div className="row row-gap-sm">
          <button
            onClick={() => actions.duplicateWorkspaceBox()}
            disabled={!selectedId || boxes.length === 0}
            className="button button-ghost"
            style={{ flex: 1, opacity: selectedId ? 1 : 0.6 }}
          >
            Duplicar
          </button>
        </div>
        <button
          onClick={() => actions.exportarPDF()}
          className="button button-ghost"
        >
          Exportar Cut List (PDF)
        </button>
      </div>
    </aside>
  );
}
