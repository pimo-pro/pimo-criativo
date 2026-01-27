import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";

export default function BottomPanel() {
  const { project } = useProject();

  const formatarData = (data: Date | null): string => {
    if (!data) return "Nunca";
    const agora = new Date();
    const diffMs = agora.getTime() - data.getTime();
    const diffSeg = Math.floor(diffMs / 1000);

    if (diffSeg < 5) return "Agora";
    if (diffSeg < 60) return `Há ${diffSeg}s`;
    if (diffSeg < 3600) return `Há ${Math.floor(diffSeg / 60)}min`;
    return data.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resultados = project.resultados;

  return (
    <div className="bottom-panel-root">
      {/* Secção Esquerda: Resultados */}
      <div className="bottom-panel-results">
        <Panel title="Resultados Atuais">
          {resultados ? (
            <div className="text-md">
              <span className="text-muted text-strong text-xs">Preço estimado:</span>{" "}
              <strong>{resultados.precoFinal.toFixed(2)} €</strong>
              <span className="text-muted text-strong text-xs ml-sm">Peças:</span>{" "}
              <strong>{resultados.numeroPecas}</strong>
              <span className="text-muted text-strong text-xs ml-sm">Painéis:</span>{" "}
              <strong>{resultados.numeroPaineis}</strong>
              {resultados.desperdicioPercentual > 0 && (
                <>
                  {" "}
                  <span className="text-muted text-strong text-xs ml-sm">Desperdício:</span>{" "}
                  <strong>{resultados.desperdicioPercentual.toFixed(1)}%</strong>
                </>
              )}
              {project.estrutura3D && project.estrutura3D.pecas.length > 0 && (
                <>
                  {" "}
                  <span className="text-muted text-strong text-xs ml-sm">Elementos 3D:</span>{" "}
                  <strong>{project.estrutura3D.pecas.length}</strong>
                </>
              )}
            </div>
          ) : (
            <div className="text-muted text-xs">A calcular resultados...</div>
          )}
        </Panel>
      </div>

      {/* Secção Direita: Estado da Atualização */}
      <div className="bottom-panel-meta">
        Última Atualização: {formatarData(project.ultimaAtualizacao)}
      </div>
    </div>
  );
}
