import { useProject } from "../../../context/useProject";

export default function RightPanel() {
  const { project, actions } = useProject();

  return (
    <aside className="panel-content panel-content--side">
      {/* Título da Secção */}
      <div className="section-title">
        Ações
      </div>

      <div className="stack-tight">
        {/* Botão Gerar */}
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

        <button
          onClick={() => actions.addWorkspaceBox()}
          className="button button-ghost"
        >
          Adicionar caixote
        </button>

        <div className="row row-gap-sm">
          <button
            onClick={() => actions.duplicateWorkspaceBox()}
            className="button button-ghost"
            style={{ flex: 1 }}
          >
            Duplicar
          </button>
          <button
            onClick={() => actions.removeWorkspaceBox()}
            disabled={project.workspaceBoxes.length <= 1}
            className="button button-ghost"
            style={{
              flex: 1,
              background:
                project.workspaceBoxes.length <= 1
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(255,255,255,0.04)",
              cursor: project.workspaceBoxes.length <= 1 ? "not-allowed" : "pointer",
              opacity: project.workspaceBoxes.length <= 1 ? 0.6 : 1,
            }}
          >
            Remover caixa
          </button>
        </div>

        {/* Botão Exportar */}
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
