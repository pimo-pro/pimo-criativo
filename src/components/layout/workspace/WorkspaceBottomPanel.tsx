import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";

export default function WorkspaceBottomPanel() {
  const { project } = useProject();
  return (
    <section
      style={{
        width: "100%",
        background: "rgba(10,16,30,0.96)",
        borderTop: "1px solid var(--border)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxHeight: 360,
        overflowY: "auto",
      }}
    >
      <Panel title="Estado do Sistema">
        <div style={{ lineHeight: 1.4 }}>
          {project.estaCarregando
            ? "A calcular..."
            : project.erro
            ? project.erro
            : project.design
            ? `Design Gerado (${project.estrutura3D?.pecas.length || 0} peças)`
            : "Pronto para Gerar"}
        </div>
      </Panel>

    </section>
  );
}
