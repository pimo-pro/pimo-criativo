import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import CutListView from "../../ui/CutListView";
import CutlistPanel from "../../panels/CutlistPanel";

export default function BottomPanel() {
  const { project } = useProject();
  const microTextStyle = { fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" };

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

        <Panel title="Preço Total do Projeto">
          <div className="text-md">
            {project.precoTotalProjeto !== null
              ? `${project.precoTotalProjeto.toFixed(2)}€`
              : "--"}
          </div>
        </Panel>

        <CutListView />
        <CutlistPanel />

        {project.acessorios && project.acessorios.length > 0 && (
          <Panel title="Ferragens">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {project.acessorios.map((acessorio) => (
                <div
                  key={acessorio.id}
                  style={{
                    padding: "6px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "var(--text-main)", fontWeight: 600, fontSize: 12 }}>
                        {acessorio.nome}
                      </div>
                      <div style={{ ...microTextStyle, marginTop: 4 }}>
                        {acessorio.quantidade} un. × {acessorio.precoUnitario.toFixed(2)}€
                      </div>
                    </div>
                    <div style={{ color: "var(--text-main)", fontWeight: 600, fontSize: 12 }}>
                      {acessorio.precoTotal.toFixed(2)}€
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {project.precoTotalProjeto !== null && (
          <Panel title="Preço por caixa">
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--blue-light)" }}>
              {project.precoTotalProjeto.toFixed(2)}€
            </div>
            {project.precoTotalPecas !== null && project.precoTotalAcessorios !== null && (
              <div style={{ ...microTextStyle, marginTop: 6 }}>
                Peças: {project.precoTotalPecas.toFixed(2)}€ + Acessórios:{" "}
                {project.precoTotalAcessorios.toFixed(2)}€ + Margem 10%
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* Secção Direita: Estado da Atualização */}
      <div className="bottom-panel-meta">
        Última Atualização: {formatarData(project.ultimaAtualizacao)}
      </div>
    </div>
  );
}
