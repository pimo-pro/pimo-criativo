import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import CutlistPanel from "../../panels/CutlistPanel";

export default function BottomPanel() {
  const { project } = useProject();
  const microTextStyle = { fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)" };

  const resultados = project.resultados;
  const totalFerragens =
    project.acessorios?.reduce((sum, item) => sum + item.quantidade, 0) ?? 0;
  const totalPecas = resultados?.numeroPecas ?? 0;
  const totalItens = totalPecas + totalFerragens;
  const precoTotal = project.precoTotalProjeto ?? resultados?.precoFinal ?? null;
  const precoPorPeca =
    precoTotal !== null && totalPecas > 0 ? precoTotal / totalPecas : null;
  const custoMateriais = resultados?.precoMaterial ?? null;
  const custoPecas = project.precoTotalPecas ?? null;
  const custoFerragens = project.precoTotalAcessorios ?? null;
  const custoMontagem =
    precoTotal !== null && custoPecas !== null && custoFerragens !== null
      ? precoTotal - (custoPecas + custoFerragens)
      : null;
  const precoPorCaixa = project.precoTotalProjeto ?? null;

  return (
    <div className="bottom-panel-root">
      <CutlistPanel />

      <Panel title="Resumo Financeiro do Projeto">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>Quantidades</div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Peças totais</span>
            <span style={{ color: "var(--text-main)" }}>{totalPecas}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Ferragens totais</span>
            <span style={{ color: "var(--text-main)" }}>{totalFerragens}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Total de itens</span>
            <span style={{ color: "var(--text-main)" }}>{totalItens}</span>
          </div>

          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "6px 0",
            }}
          />

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>Custos</div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Materiais</span>
            <span style={{ color: "var(--text-main)" }}>
              {custoMateriais !== null ? `${custoMateriais.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Peças</span>
            <span style={{ color: "var(--text-main)" }}>
              {custoPecas !== null ? `${custoPecas.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Ferragens</span>
            <span style={{ color: "var(--text-main)" }}>
              {custoFerragens !== null ? `${custoFerragens.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Montagem</span>
            <span style={{ color: "var(--text-main)" }}>
              {custoMontagem !== null ? `${custoMontagem.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span style={{ color: "var(--text-main)" }}>Total geral</span>
            <span style={{ color: "var(--blue-light)" }}>
              {precoTotal !== null ? `${precoTotal.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Preço por peça</span>
            <span style={{ color: "var(--text-main)" }}>
              {precoPorPeca !== null ? `${precoPorPeca.toFixed(2)} €` : "--"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", ...microTextStyle }}>
            <span>Preço por caixa</span>
            <span style={{ color: "var(--text-main)" }}>
              {precoPorCaixa !== null ? `${precoPorCaixa.toFixed(2)} €` : "--"}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
