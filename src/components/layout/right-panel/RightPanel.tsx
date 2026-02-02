import { useState } from "react";
import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import GerarArquivoModal from "./GerarArquivoModal";

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
  const [showGerarArquivoModal, setShowGerarArquivoModal] = useState(false);

  const handleGerarArquivoConfirm = (opcoes: {
    tipoPdf: boolean;
    tipoExcel: boolean;
    cutlist: boolean;
    pdfTecnico: boolean;
    download: boolean;
    email: boolean;
    whatsapp: boolean;
  }) => {
    if (opcoes.tipoExcel) {
      alert("Exportação para Excel estará disponível em breve.");
    }
    if (opcoes.tipoPdf && opcoes.download) {
      if (opcoes.cutlist) actions.exportarPDF();
      if (opcoes.pdfTecnico) actions.exportarPdfTecnico();
    }
  };

  return (
    <aside className="panel-content panel-content--side">
      <div className="section-title" style={{ marginBottom: 8 }}>Ações</div>

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

        <div className="row row-gap-sm" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => actions.duplicateWorkspaceBox()}
            disabled={!selectedId || boxes.length === 0}
            className="button button-ghost"
            style={{ flex: 1, opacity: selectedId ? 1 : 0.6 }}
          >
            Duplicar
          </button>
          <button
            onClick={() => setShowGerarArquivoModal(true)}
            className="button button-ghost"
            style={{ flex: 1 }}
          >
            Gerar Arquivo
          </button>
        </div>

        {showGerarArquivoModal && (
          <GerarArquivoModal
            onClose={() => setShowGerarArquivoModal(false)}
            onConfirm={handleGerarArquivoConfirm}
            hasBoxes={(project.boxes?.length ?? 0) > 0}
          />
        )}

        {/* Lista de Caixas */}
        <div className="section-title" style={{ marginTop: 16, marginBottom: 8 }}>
          Lista de Caixas
        </div>
        <div
          className="boxes-list"
          style={{
            maxHeight: 300,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
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

      </div>
    </aside>
  );
}
