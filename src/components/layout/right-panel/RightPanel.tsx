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

  return (
    <aside className="panel-content panel-content--side">
      <div className="section-title">
        Ações
      </div>

      <div className="stack-tight">
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
                    {isSelected && viewerApi && (
                      <>
                        <button
                          type="button"
                          onClick={() => viewerApi.setTransformMode("translate")}
                          className="button button-ghost"
                          style={{ fontSize: 11, padding: "4px 8px" }}
                          title="Mover caixa no viewer (arrastar)"
                        >
                          Mover
                        </button>
                        <button
                          type="button"
                          onClick={() => viewerApi.setTransformMode("rotate")}
                          className="button button-ghost"
                          style={{ fontSize: 11, padding: "4px 8px" }}
                          title="Rodar caixa no viewer"
                        >
                          Rodar
                        </button>
                      </>
                    )}
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
